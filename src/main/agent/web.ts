/**
 * Main-process web reading for the agent: a fallback search and a page reader.
 * Plain GET only. No credentials, cookies, or auth headers are attached, so neither the model key
 * nor the MCP token can leave through here. Addresses on this machine or the local network are refused,
 * so a page link can never reach ComfyUI or another local service.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface PageText {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

export const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/?q=';
export const WEB_TIMEOUT_MS = 10_000;
export const MAX_RESULTS = 8;
export const PAGE_BYTE_CAP = 2 * 1024 * 1024;
export const PAGE_TEXT_CAP = 12_000;
export const MAX_REDIRECTS = 3;

const USER_AGENT = 'ComfyUI-Graph-Helper/0.1 (+read-only page reader)';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** DuckDuckGo wraps result links as //duckduckgo.com/l/?uddg=<encoded target>. */
export function decodeResultLink(href: string): string | null {
  const raw = decodeEntities(href);
  let url: URL;
  try {
    url = new URL(raw, 'https://duckduckgo.com');
  } catch {
    return null;
  }
  const wrapped = url.searchParams.get('uddg');
  const target = wrapped ?? (url.hostname.endsWith('duckduckgo.com') ? null : url.toString());
  if (!target) return null;
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    // Sponsored links go through an ad redirect on the search host; they are not results.
    if (parsed.hostname.endsWith('duckduckgo.com')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Pure parser for the DuckDuckGo HTML endpoint. Tested on fixture HTML. */
export function parseDuckDuckGoHtml(html: string, max = MAX_RESULTS): WebResult[] {
  const results: WebResult[] = [];
  const anchor = /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...html.matchAll(anchor)];
  for (let index = 0; index < matches.length && results.length < max; index++) {
    const match = matches[index];
    const href = /\bhref="([^"]*)"/i.exec(match[0])?.[1];
    if (!href) continue;
    const url = decodeResultLink(href);
    if (!url) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? html.length : html.length;
    const tail = html.slice(start, end);
    const snippet = /<(?:a|div|td)\b[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i.exec(tail)?.[1] ?? '';
    const title = stripTags(match[1]);
    if (!title) continue;
    if (results.some((item) => item.url === url)) continue;
    results.push({ title, url, snippet: stripTags(snippet) });
  }
  return results;
}

/** Pure HTML → readable text. Scripts, styles, and markup are dropped. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = stripTags(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '');
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
  const text = decodeEntities(body)
    .split('\n')
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
  return { title, text };
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Only public http(s) addresses without userinfo. Literal local and private hosts are refused
 * so the agent cannot reach ComfyUI, a router, or another service on this machine through a page link.
 */
export function publicWebUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === '' || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (!host.includes('.') && !host.includes(':')) return null;
  if (isPrivateIPv4(host)) return null;
  if (host.includes(':')) {
    if (host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('::ffff:')) return null;
  }
  return url;
}

function timeoutSignal(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function readCapped(response: Response, cap: number): Promise<{ text: string; capped: boolean }> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { text: buffer.subarray(0, cap).toString('utf8'), capped: buffer.length > cap };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let capped = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (size + value.length > cap) {
      chunks.push(value.subarray(0, cap - size));
      size = cap;
      capped = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    size += value.length;
  }
  return { text: Buffer.concat(chunks).toString('utf8'), capped };
}

function headers(): Record<string, string> {
  return { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' };
}

/** Fallback search when the provider has no native web search. */
export async function searchWebFallback(query: string, fetchImpl: FetchLike): Promise<WebResult[]> {
  const trimmed = query.trim().slice(0, 400);
  if (trimmed === '') return [];
  const timer = timeoutSignal(WEB_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${SEARCH_ENDPOINT}${encodeURIComponent(trimmed)}`, {
      method: 'GET',
      headers: headers(),
      redirect: 'follow',
      credentials: 'omit',
      signal: timer.signal,
    });
    if (!response.ok) throw new Error(`Search answered ${response.status}.`);
    const { text } = await readCapped(response, PAGE_BYTE_CAP);
    return parseDuckDuckGoHtml(text);
  } finally {
    timer.done();
  }
}

const TEXTUAL = /^(text\/|application\/(xhtml\+xml|xml|json|ld\+json|rss\+xml|atom\+xml))/i;

/** GET one public page as text. Follows at most three redirects, each checked again. */
export async function fetchPageText(rawUrl: string, fetchImpl: FetchLike): Promise<PageText> {
  let url = publicWebUrl(rawUrl);
  if (!url) throw new Error('Only public http(s) addresses can be read.');
  const timer = timeoutSignal(WEB_TIMEOUT_MS);
  try {
    for (let hop = 0; ; hop++) {
      const response = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: headers(),
        redirect: 'manual',
        credentials: 'omit',
        signal: timer.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect without a location.');
        if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects.');
        const next = publicWebUrl(new URL(location, url).toString());
        if (!next) throw new Error('Redirect leaves the public web.');
        url = next;
        continue;
      }
      if (!response.ok) throw new Error(`The page answered ${response.status}.`);
      const type = response.headers.get('content-type') ?? 'text/html';
      if (!TEXTUAL.test(type)) throw new Error('The page is not text.');
      const body = await readCapped(response, PAGE_BYTE_CAP);
      const isHtml = /html|xml/i.test(type);
      const extracted = isHtml ? htmlToText(body.text) : { title: '', text: body.text.trim() };
      const truncated = body.capped || extracted.text.length > PAGE_TEXT_CAP;
      return {
        url: url.toString(),
        title: extracted.title.slice(0, 300),
        text: extracted.text.slice(0, PAGE_TEXT_CAP),
        truncated,
      };
    }
  } finally {
    timer.done();
  }
}
