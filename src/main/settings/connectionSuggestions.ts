import type Database from 'better-sqlite3';
import type { AddressSuggestion, ConnectionSuggestions } from '../../shared/contracts/pickers';
import { readState, reportedComfyUrl, writeState } from '../mcp/sync';
import { readSettings } from './repository';
import { checkComfy } from '../comfy/direct';

/**
 * Settings ▸ Connection: addresses to pick from for the ComfyUI origin and the MCP URL, so nobody has to remember
 * them: the ComfyUI address the MCP server named at the last sync, the saved values, the last few saved ones,
 * and a ComfyUI that answers on this computer at its usual ports. The text fields stay; these are only offers.
 */

export const MCP_URL_HISTORY_KEY = 'mcp_url_history';
export const COMFY_ORIGIN_HISTORY_KEY = 'comfy_origin_history';
export const HISTORY_LIMIT = 5;

/** Ports a ComfyUI usually runs on (the portable/manual install, the desktop app). Looked at, never assumed. */
export const COMFY_PROBE_PORTS: readonly number[] = [8188, 8000];
const PROBE_TIMEOUT_MS = 1_500;

type HistoryKey = typeof MCP_URL_HISTORY_KEY | typeof COMFY_ORIGIN_HISTORY_KEY;

/** An http(s) address with no user info, at most 500 characters, or null. */
function usableAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password ? trimmed : null;
  } catch {
    return null;
  }
}

export function readHistory(db: Database.Database, key: HistoryKey): string[] {
  try {
    const parsed = JSON.parse(readState(db)[key] ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(usableAddress).filter((value): value is string => value !== null).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/** Puts an address first in its history (most recent first, no repeats, at most HISTORY_LIMIT). */
export function rememberAddress(db: Database.Database, key: HistoryKey, value: string): void {
  const address = usableAddress(value);
  if (!address) return;
  const next = [address, ...readHistory(db, key).filter((item) => item !== address)].slice(0, HISTORY_LIMIT);
  writeState(db, { [key]: JSON.stringify(next) });
}

/**
 * Called after a settings save. When an address changed, the one it replaced and the new one both go to history,
 * so switching back is one pick.
 */
export function rememberSavedAddresses(db: Database.Database, before: { comfyOrigin: string; mcpUrl: string }, after: { comfyOrigin: string; mcpUrl: string }): void {
  for (const [key, field] of [[COMFY_ORIGIN_HISTORY_KEY, 'comfyOrigin'], [MCP_URL_HISTORY_KEY, 'mcpUrl']] as const) {
    if (before[field] === after[field]) continue;
    rememberAddress(db, key, before[field]);
    rememberAddress(db, key, after[field]);
  }
}

/** Reported first (what the server says now), then saved, then found on this computer, then recent. No repeats. */
export function assembleSuggestions(input: {
  saved: { comfyOrigin: string; mcpUrl: string };
  reportedComfy: string | null;
  probedComfy: string[];
  comfyHistory: string[];
  mcpHistory: string[];
}): ConnectionSuggestions {
  const build = (entries: Array<[string | null | undefined, AddressSuggestion['source']]>): AddressSuggestion[] => {
    const seen = new Set<string>();
    const out: AddressSuggestion[] = [];
    for (const [raw, source] of entries) {
      const value = usableAddress(raw);
      if (!value) continue;
      const key = value.replace(/\/+$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value, source });
    }
    return out;
  };
  return {
    comfyOrigins: build([
      [input.reportedComfy, 'reported'],
      [input.saved.comfyOrigin, 'saved'],
      ...input.probedComfy.map((value): [string, 'probe'] => [value, 'probe']),
      ...input.comfyHistory.map((value): [string, 'recent'] => [value, 'recent']),
    ]),
    mcpUrls: build([
      [input.saved.mcpUrl, 'saved'],
      ...input.mcpHistory.map((value): [string, 'recent'] => [value, 'recent']),
    ]),
  };
}

/**
 * A ComfyUI answering on this computer: `GET /system_stats` returns `{system:{…}}`. Asked through the read-only gate
 * (comfy/gate.ts), each port within `timeoutMs`.
 */
export async function probeComfy(fetchImpl: typeof fetch, timeoutMs = PROBE_TIMEOUT_MS): Promise<string[]> {
  const found = await Promise.all(COMFY_PROBE_PORTS.map(async (port) => {
    const origin = `http://127.0.0.1:${port}`;
    const read = await checkComfy(origin, fetchImpl, timeoutMs);
    return read.ok ? origin : null;
  }));
  return found.filter((origin): origin is string => origin !== null);
}

/**
 * `probe`: also look for a ComfyUI on this computer. Only when the person asks (the button), so opening Settings
 * sends nothing anywhere.
 */
export async function connectionSuggestions(db: Database.Database, fetchImpl: typeof fetch, options: { probe: boolean } = { probe: false }): Promise<ConnectionSuggestions> {
  const read = readSettings(db);
  const saved = read.source === 'corrupt' ? { comfyOrigin: '', mcpUrl: '' } : { comfyOrigin: read.values.comfyOrigin, mcpUrl: read.values.mcpUrl };
  return assembleSuggestions({
    saved,
    reportedComfy: reportedComfyUrl(db),
    probedComfy: options.probe ? await probeComfy(fetchImpl) : [],
    comfyHistory: readHistory(db, COMFY_ORIGIN_HISTORY_KEY),
    mcpHistory: readHistory(db, MCP_URL_HISTORY_KEY),
  });
}
