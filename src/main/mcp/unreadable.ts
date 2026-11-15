/**
 * What the catalog sync could not read, and why: the failure records of model files (kept in sync_state with a
 * reason code and the time of the last try), the files the person chose to skip, the model folders and catalog
 * sections whose list did not come, and the sorting of a failed read into "the file" versus "the connection".
 * Used by mcp/sync.ts (records failures, builds SyncStatus.unreadable, the log summary) and through the status by
 * Settings ▸ Sync ▸ "Could not be read", the model card and the end-of-sync toast.
 * Why a reason per record: a person must see what is broken and what to do about it; and a read that failed only
 * because the connection was already gone is not the file's fault and must never push the file into a long wait.
 */
import type { UnreadableItem, UnreadReason } from '../../shared/contracts/knowledge';
import { redactSecrets } from '../../shared/config/draft';
import { isNetworkError } from './client';

/** sync_state: failed metadata reads, { "directory/name": { attempts, lastAt, reason?, detail? } }. */
export const ENRICH_FAILURES_KEY = 'enrich_failures';
/** sync_state: files the person switched "Skip this file" on for, { "directory/name": { at, reason, detail? } }. */
export const ENRICH_SKIPPED_KEY = 'enrich_skipped';
/** sync_state: model folders and catalog sections whose list did not come at the last listing. */
export const UNREAD_PARTS_KEY = 'unread_parts';
/**
 * sync_state: set once the failure records written before reasons existed were cleared. Those older versions
 * counted a lost connection against every file read after it, so many healthy files waited for a day; they are
 * read again at the first sync of this version.
 */
export const FAILURES_RESET_KEY = 'enrich_failures_reset_1';

const HOUR = 60 * 60_000;

/** How long a file waits after its n-th failed metadata read: 1 h, then 6 h, then 24 h. */
export function enrichBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return HOUR;
  if (attempts === 2) return 6 * HOUR;
  return 24 * HOUR;
}

/** A file whose read broke the connection twice is not asked for again for a day (the longest wait). */
export const SUSPECT_ATTEMPTS = 3;

/** One stored failed read. Records from before reasons existed have no reason; they read as 'failed'. */
export interface FailureRecord {
  attempts: number;
  lastAt: number;
  reason?: UnreadReason;
  detail?: string;
}
export type FailureMap = Record<string, FailureRecord>;
/** One file the person chose to skip, with what was wrong when the switch was turned on. */
export interface SkipRecord {
  at: number;
  reason: UnreadReason;
  detail?: string;
}
/** A model folder or catalog section whose list did not come. */
export interface UnreadPart {
  kind: 'folder' | 'section';
  name: string;
  reason: UnreadReason;
}

const REASONS: readonly UnreadReason[] = ['dropped', 'notConnected', 'serverError', 'tooLarge', 'timeout', 'unreadable', 'failed', 'comfyDown', 'listing'];

function reasonOf(value: unknown): UnreadReason | undefined {
  return typeof value === 'string' && (REASONS as readonly string[]).includes(value) ? (value as UnreadReason) : undefined;
}

function parsedObject(text: string | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(text ?? '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The stored failed reads, with malformed entries dropped. */
export function readFailures(state: Record<string, string>): FailureMap {
  const result: FailureMap = {};
  for (const [key, entry] of Object.entries(parsedObject(state[ENRICH_FAILURES_KEY]))) {
    const item = entry as { attempts?: unknown; lastAt?: unknown; reason?: unknown; detail?: unknown } | null;
    if (!item || typeof item.attempts !== 'number' || typeof item.lastAt !== 'number') continue;
    const reason = reasonOf(item.reason);
    result[key] = {
      attempts: item.attempts,
      lastAt: item.lastAt,
      ...(reason ? { reason } : {}),
      ...(typeof item.detail === 'string' && item.detail ? { detail: item.detail } : {}),
    };
  }
  return result;
}

/** The files the person skips. */
export function readSkipped(state: Record<string, string>): Record<string, SkipRecord> {
  const result: Record<string, SkipRecord> = {};
  for (const [key, entry] of Object.entries(parsedObject(state[ENRICH_SKIPPED_KEY]))) {
    const item = entry as { at?: unknown; reason?: unknown; detail?: unknown } | null;
    if (!item || typeof item.at !== 'number') continue;
    result[key] = { at: item.at, reason: reasonOf(item.reason) ?? 'failed', ...(typeof item.detail === 'string' && item.detail ? { detail: item.detail } : {}) };
  }
  return result;
}

/** The folders and sections of the last listing that did not come. */
export function readUnreadParts(state: Record<string, string>): UnreadPart[] {
  try {
    const value = JSON.parse(state[UNREAD_PARTS_KEY] ?? '[]') as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      const part = item as { kind?: unknown; name?: unknown; reason?: unknown } | null;
      const reason = reasonOf(part?.reason);
      if (!part || (part.kind !== 'folder' && part.kind !== 'section') || typeof part.name !== 'string' || !reason) return [];
      return [{ kind: part.kind, name: part.name, reason }];
    });
  } catch {
    return [];
  }
}

/** The record key of a model file; the folder never holds a slash, the name may (a subfolder). */
export function fileKey(directory: string, name: string): string {
  return `${directory}/${name}`;
}

function splitKey(key: string): { directory: string; name: string } {
  const slash = key.indexOf('/');
  return slash < 0 ? { directory: '', name: key } : { directory: key.slice(0, slash), name: key.slice(slash + 1) };
}

/** One failed read sorted out: what went wrong, and the server's short text when it answered with an error. */
export interface ReadFailure {
  reason: UnreadReason;
  detail?: string;
}

/** The connection, not the file: such a failure is never counted against the file being read. */
export function isConnectionLoss(failure: ReadFailure): boolean {
  return failure.reason === 'dropped' || failure.reason === 'notConnected';
}

/*
 * The texts are matched, not the classes: the server in front of ComfyUI may itself be a gateway that passes on
 * the error of its own lost connection ("MCP error -32000: Connection closed", then "Not connected" for every
 * later call), and the transport here says "terminated" or "fetch failed" when a socket closes mid-answer.
 */
const NOT_CONNECTED = /\bnot connected\b/i;
const DROPPED = /\bconnection (?:closed|lost|reset)\b|\bterminated\b|other side closed|socket hang up|stream disconnected|\bECONNRESET\b|\bEPIPE\b/i;
const TIMED_OUT = /\btimed out\b|\btimeout\b/i;

/**
 * The short, safe form of a server's error text for the report: secrets redacted, addresses and absolute paths
 * cut out (the text is shown and copied), at most 160 characters.
 */
export function shortDetail(text: string): string {
  let result = redactSecrets(text)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '…')
    .replace(/(?:^|[\s"'(=])(?:\/[^\s"')]+){2,}/g, (match) => `${match.startsWith('/') ? '' : match[0]}…`)
    .replace(/\b[A-Za-z]:\\[^\s"')]+/g, '…')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
  if (result.length > 160) result = `${result.slice(0, 159)}…`;
  return result;
}

/** The error text of a server's answer: its `error.code` and `error.message` when the text is JSON, else the text. */
function answerText(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } | string } | null;
    const error = parsed?.error;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
      return [error.code, error.message].filter((part): part is string => typeof part === 'string' && part !== '').join(': ');
    }
  } catch {
    // Not JSON: the text itself.
  }
  return text;
}

/** Sorts a thrown error of a metadata read. A gate refusal is never passed here (the caller rethrows it). */
export function classifyReadError(error: unknown): ReadFailure {
  const name = error && typeof error === 'object' ? String((error as { name?: unknown }).name ?? '') : '';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (name === 'ResponseTooLargeError' || /larger than \d+ bytes/.test(message)) return { reason: 'tooLarge' };
  if (NOT_CONNECTED.test(message)) return { reason: 'notConnected' };
  if (DROPPED.test(message) || isNetworkError(error)) return { reason: 'dropped' };
  if (name === 'McpTimeoutError' || TIMED_OUT.test(message)) return { reason: 'timeout' };
  if (name === 'ProtocolError' && message) return { reason: 'serverError', detail: shortDetail(message) };
  return { reason: 'failed' };
}

/** Sorts an answer the server marked as an error (isError) by its text. */
export function classifyErrorAnswer(text: string | undefined): ReadFailure {
  const said = answerText(text ?? '');
  if (NOT_CONNECTED.test(said)) return { reason: 'notConnected' };
  if (DROPPED.test(said)) return { reason: 'dropped' };
  return said ? { reason: 'serverError', detail: shortDetail(said) } : { reason: 'serverError' };
}

/** The rows of the report: model files first (by folder and name), then folders, then sections. At most 500. */
export function unreadableRows(state: Record<string, string>): UnreadableItem[] {
  const failures = readFailures(state);
  const skipped = readSkipped(state);
  const rows: UnreadableItem[] = [];
  for (const [key, record] of Object.entries(failures)) {
    if (skipped[key]) continue;
    rows.push({
      kind: 'model',
      ...splitKey(key),
      reason: record.reason ?? 'failed',
      ...(record.detail ? { detail: record.detail } : {}),
      lastAt: record.lastAt,
      retryAt: record.lastAt + enrichBackoffMs(record.attempts),
      skipped: false,
    });
  }
  for (const [key, record] of Object.entries(skipped)) {
    rows.push({ kind: 'model', ...splitKey(key), reason: record.reason, ...(record.detail ? { detail: record.detail } : {}), lastAt: record.at, retryAt: null, skipped: true });
  }
  rows.sort((left, right) => (left.directory ?? '').localeCompare(right.directory ?? '') || left.name.localeCompare(right.name));
  for (const part of readUnreadParts(state)) rows.push({ kind: part.kind, name: part.name, reason: part.reason, lastAt: null, retryAt: null, skipped: false });
  return rows.slice(0, 500);
}

/** The one-line English summary main writes into the app log at the end of a run (no names, no address). */
export function logSummary(done: number, total: number, rows: readonly UnreadableItem[]): string {
  const files = rows.filter((row) => row.kind === 'model');
  const skipped = files.filter((row) => row.skipped).length;
  const byReason = new Map<string, number>();
  for (const row of files) if (!row.skipped) byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
  const reasons = [...byReason.entries()].map(([reason, count]) => `${reason}=${count}`).join(' ');
  const parts = rows.length - files.length;
  return `[Sync] Metadata read ${done} of ${total}; ${files.length - skipped} could not be read${reasons ? ` (${reasons})` : ''}; ${skipped} skipped${parts ? `; ${parts} lists not read` : ''}`;
}
