import { carriesSecret } from '../shared/config/draft';
import { DISPLAY_NAME } from './identity';

/**
 * Help ▸ Copy diagnostics: a plain-text report a person can paste into an issue. It never carries a key or
 * token: settings and preferences are copied field by field with secret-named fields dropped, every URL keeps only
 * its scheme, where the server is (this computer, local network, internet) and its port, the hosts the person set
 * up are replaced wherever they appear, and the whole text passes through the log redactor at the end.
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
  /** The addresses the person set up (Settings); their hosts never appear in the report. */
  addresses?: ReadonlyArray<string | null | undefined>;
}

const SECRET_KEY = /(api[_-]?key|apikey|token|secret|password|passwd|authorization|credential|cookie|private[_-]?key)/i;

/** Public services every install talks to the same way: naming them in a report says nothing about the person. */
const PUBLIC_HOSTS = new Set([
  'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'civitai.com', 'huggingface.co',
  'html.duckduckgo.com', 'lite.duckduckgo.com',
]);

/**
 * Where a host is, in words a report may carry: the person's own servers are named only by where they are, never
 * by name or address (a host name or an address in a public bug report points at a server of theirs).
 */
export function placeOf(hostname: string): 'this computer' | 'local network' | 'internet' {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (host === 'localhost' || /^127\./.test(host) || host === '::1' || host === '0.0.0.0') return 'this computer';
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^169\.254\./.test(host)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return 'local network';
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return 'local network';
  if (!host.includes('.') || /\.(local|lan|home|internal|home\.arpa)$/.test(host)) return 'local network';
  return 'internet';
}

/**
 * Scheme, where the server is and its port: user info, host, path, query and fragment go. A public service keeps
 * its name. `https://my-box.example:8443/mcp?x` becomes `https://[internet]:8443`.
 */
export function scrubUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return value;
    if (PUBLIC_HOSTS.has(url.hostname.toLowerCase())) return `${url.protocol}//${url.hostname.toLowerCase()}`;
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    return `${url.protocol}//[${placeOf(url.hostname)}]:${port}`;
  } catch {
    return value;
  }
}

/**
 * For text meant for someone else (Copy diagnostics, a saved conversation log): every http(s) address is scrubbed
 * as above, and each host the person set up (their MCP server, ComfyUI, model server) is replaced wherever it shows
 * up on its own, as in an error sentence.
 */
export function addressScrubber(addresses: ReadonlyArray<string | null | undefined>): (text: string) => string {
  const hosts = new Set<string>();
  for (const address of addresses) {
    try {
      const host = new URL(String(address ?? '')).hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (host.length >= 3 && !PUBLIC_HOSTS.has(host)) hosts.add(host);
    } catch {
      // Not an address: nothing to replace.
    }
  }
  const sorted = [...hosts].sort((left, right) => right.length - left.length);
  return (text) => {
    if (typeof text !== 'string' || text === '') return text;
    let out = text.replace(/\bhttps?:\/\/[^\s"'<>)\]}]+/gi, (match) => scrubUrl(match));
    for (const host of sorted) out = out.split(host).join(`[${placeOf(host)}]`);
    return out;
  };
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
    `# ${DISPLAY_NAME} diagnostics\nGenerated: ${input.generatedAt}\n`,
    section('Versions', versions),
    section('Platform', `os: ${input.platform.os} ${input.platform.release}\narch: ${input.platform.arch}\nlocale: ${input.locale}`),
    section('Paths', paths),
    section('Settings', `source: ${input.settingsSource}\nprovider key held: ${input.keyHeld ? 'yes' : 'no'}\n${json(input.settings)}`),
    section('Preferences', json(input.preferences)),
    section('Sync', json(input.sync)),
    section('Catalog', catalog),
    section(`Log (last ${input.logTail.length} lines)`, input.logTail.join('\n') || '(empty)'),
  ].join('\n');
  return addressScrubber(input.addresses ?? [])(input.redact(text));
}

/**
 * Replaces the person's home folder with `~` in a text meant to be read by someone else (the log, "Copy
 * diagnostics", the saved conversation log): the folder name is usually the person's own name. Only a whole folder
 * part matches, so `/home/ann` does not touch `/home/anna`. A home of `/` or empty is left alone.
 */
export function homeRedactor(home: string | null | undefined): (text: string) => string {
  const folder = (home ?? '').replace(/\/+$/, '');
  if (folder.length < 2) return (text) => text;
  const escaped = folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}(?=$|[/\\s"'\`,;:)\\]}])`, 'g');
  return (text) => text.replace(pattern, '~');
}
