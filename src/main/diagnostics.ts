import { carriesSecret } from '../shared/config/draft';

/**
 * Help ▸ Copy diagnostics: a plain-text report the owner can paste into an issue. It never carries a key or
 * token: settings and preferences are copied field by field with secret-named fields dropped, every URL loses
 * its user info and query, and the whole text passes through the log redactor at the end.
 */

export interface DiagnosticsInput {
  generatedAt: string;
  versions: Record<string, string | undefined>;
  platform: { os: string; release: string; arch: string };
  locale: string;
  paths: Record<string, string | null | undefined>;
  settingsSource: string;
  settings: Record<string, unknown> | null;
  preferences: unknown;
  sync: unknown;
  catalog: Record<string, number | null>;
  keyHeld: boolean;
  logTail: string[];
  redact: (text: string) => string;
}

const SECRET_KEY = /(api[_-]?key|apikey|token|secret|password|passwd|authorization|credential|cookie|private[_-]?key)/i;

/** Origin and path only: user info, query and fragment can carry credentials. */
export function scrubUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return value;
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
}

/** A deep copy without secret-named fields; strings that look like URLs are scrubbed. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[…]';
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? scrubUrl(value) : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrubValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key) && key !== 'tokenHeld') {
      result[key] = '[omitted]';
      continue;
    }
    if (typeof child === 'string' && !/^https?:\/\//i.test(child) && carriesSecret({ value: child })) {
      result[key] = '[redacted]';
      continue;
    }
    result[key] = scrubValue(child, depth + 1);
  }
  return result;
}

function section(title: string, body: string): string {
  return `## ${title}\n${body.trimEnd()}\n`;
}

function json(value: unknown): string {
  try {
    return JSON.stringify(scrubValue(value), null, 2) ?? 'null';
  } catch {
    return '"[unserializable]"';
  }
}

export function buildDiagnosticsReport(input: DiagnosticsInput): string {
  const versions = Object.entries(input.versions).map(([name, version]) => `${name}: ${version || 'unknown'}`).join('\n');
  const paths = Object.entries(input.paths).map(([name, value]) => `${name}: ${value ?? 'unknown'}`).join('\n');
  const catalog = Object.entries(input.catalog).map(([name, count]) => `${name}: ${count ?? 'unknown'}`).join('\n');
  const text = [
    `# ComfyUI Graph Helper diagnostics\nGenerated: ${input.generatedAt}\n`,
    section('Versions', versions),
    section('Platform', `os: ${input.platform.os} ${input.platform.release}\narch: ${input.platform.arch}\nlocale: ${input.locale}`),
    section('Paths', paths),
    section('Settings', `source: ${input.settingsSource}\nprovider key held: ${input.keyHeld ? 'yes' : 'no'}\n${json(input.settings)}`),
    section('Preferences', json(input.preferences)),
    section('Sync', json(input.sync)),
    section('Catalog', catalog),
    section(`Log (last ${input.logTail.length} lines)`, input.logTail.join('\n') || '(empty)'),
  ].join('\n');
  return input.redact(text);
}
