/**
 * Main-process web reading for the agent: a fallback search and a page reader.
 * Plain GET only. No credentials, cookies, or auth headers are attached, so neither the model key
 * nor the MCP token can leave through here.
 *
 * Every hop is checked by the address its host resolves to, not by the host text: a name that resolves to
 * this machine, a private, shared, link-local, multicast or tunnelling range is refused, as are ports other
 * than 80/443 (the search host aside), port 28188, and the saved ComfyUI origin. Without an injected fetch
 * the connection is pinned to the checked address, so a second DNS answer (rebinding) cannot redirect it.
 */

import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { Readable } from 'node:stream';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP, megabytes } from '../../shared/agent/limits';

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
  /** Present when truncated: which protective limit cut the page, so the model can say so. */
  note?: string;
}

export const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/?q=';
export const WEB_TIMEOUT_MS = 10_000;
export const MAX_RESULTS = 8;
/** Protective: a web page is outside data. Both numbers are stated in the fetchPage description and Preferences. */
export const PAGE_BYTE_CAP = FETCH_PAGE_BYTE_CAP;
export const PAGE_TEXT_CAP = FETCH_PAGE_TEXT_CAP;
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
  // Attribute values may be double- or single-quoted.
  const anchor = /<a\b[^>]*class=(["'])[^"']*\bresult__a\b[^"']*\1[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...html.matchAll(anchor)];
  for (let index = 0; index < matches.length && results.length < max; index++) {
    const match = matches[index];
    const href = /\bhref=(["'])(.*?)\1/i.exec(match[0])?.[2];
    if (!href) continue;
    const url = decodeResultLink(href);
    if (!url) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? html.length : html.length;
    const tail = html.slice(start, end);
    const snippet = /<(?:a|div|td)\b[^>]*class=(["'])[^"']*\bresult__snippet\b[^"']*\1[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i.exec(tail)?.[2] ?? '';
    const title = stripTags(match[2]);
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

/** The result of resolving a host name: every address it answers with. */
export type LookupAll = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export interface WebGuardOptions {
  /** Resolves a host to every address. Defaults to `dns.lookup({ all: true })`. Tests pass a stub. */
  lookup?: LookupAll;
  /** Origins that must never be read, e.g. the saved ComfyUI origin. Added to the ones set with setBlockedWebOrigins. */
  blockedOrigins?: string[];
}

const defaultLookup: LookupAll = (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

let blockedWebOrigins: string[] = [];

/** Origins the page reader must refuse whatever they resolve to. Main sets the saved ComfyUI origin here. */
export function setBlockedWebOrigins(origins: ReadonlyArray<string | null | undefined>): void {
  blockedWebOrigins = origins.filter((origin): origin is string => typeof origin === 'string' && origin !== '');
}

/** The ComfyUI MCP default port. Never read through a page link, whatever host names it. */
const COMFY_MCP_PORT = '28188';

function ipv4Parts(host: string): number[] | null {
  if (net.isIPv4(host) !== true) return null;
  return host.split('.').map((part) => Number(part));
}

function blockedIPv4(parts: number[]): boolean {
  const [a, b, c] = parts;
  return a === 0 // "this" network
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127) // CGNAT
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) // IETF protocol assignments, TEST-NET-1
    || (a === 192 && b === 88 && c === 99) // 6to4 relay anycast
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19)) // benchmarking
    || (a === 198 && b === 51 && c === 100) // TEST-NET-2
    || (a === 203 && b === 0 && c === 113) // TEST-NET-3
    || a >= 224; // multicast, reserved, broadcast
}

/** Eight 16-bit groups of an IPv6 literal, with an embedded IPv4 tail expanded. Null when not IPv6. */
export function ipv6Groups(host: string): number[] | null {
  const value = host.replace(/%.*$/, '');
  if (net.isIPv6(value) !== true) return null;
  let text = value.toLowerCase();
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (tail) {
    const parts = ipv4Parts(tail[1]);
    if (!parts) return null;
    text = `${text.slice(0, -tail[1].length)}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  const [head, rest] = text.includes('::') ? text.split('::') : [text, null];
  const left = head ? head.split(':') : [];
  const right = rest ? rest.split(':') : [];
  const fill = rest === null ? 0 : 8 - left.length - right.length;
  const groups = [...left, ...Array(Math.max(0, fill)).fill('0'), ...right].map((group) => parseInt(group, 16));
  return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : null;
}

function blockedIPv6(groups: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    // ::, ::1, IPv4-compatible ::a.b.c.d and IPv4-mapped ::ffff:a.b.c.d all reach IPv4 or this host.
    if (g5 === 0 || g5 === 0xffff) return true;
  }
  if (g0 === 0x64 && g1 === 0xff9b) return true; // NAT64 64:ff9b::/96 and 64:ff9b:1::/48
  if (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // discard prefix
  if (g0 === 0x2001 && g1 === 0) return true; // Teredo tunnels to an IPv4 address
  if (g0 === 0x2001 && g1 === 0xdb8) return true; // documentation
  if (g0 === 0x2002) return blockedIPv4([g1 >> 8, g1 & 0xff, g2 >> 8, g2 & 0xff]); // 6to4 embeds IPv4
  if ((g0 & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g0 & 0xffc0) === 0xfec0) return true; // site-local fec0::/10
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  return false;
}

/** True for any address on this machine, a private or shared network, or a range that tunnels to one. */
export function isBlockedAddress(address: string): boolean {
  const host = address.replace(/^\[|\]$/g, '');
  const v4 = ipv4Parts(host);
  if (v4) return blockedIPv4(v4);
  const v6 = ipv6Groups(host);
  if (v6) return blockedIPv6(v6);
  return true;
}

function bareHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
}

function effectivePort(url: URL): string {
  return url.port || (url.protocol === 'https:' ? '443' : '80');
}

function isSearchHost(host: string): boolean {
  return host === new URL(SEARCH_ENDPOINT).hostname;
}

function matchesBlockedOrigin(url: URL, extra: string[] = []): boolean {
  const host = bareHost(url);
  const port = effectivePort(url);
  for (const origin of [...blockedWebOrigins, ...extra]) {
    let blocked: URL;
    try {
      blocked = new URL(origin);
    } catch {
      continue;
    }
    if (bareHost(blocked) === host && effectivePort(blocked) === port) return true;
  }
  return false;
}

/**
 * Syntax check only: public http(s) without userinfo, on port 80 or 443 (any port for the search host),
 * not a local name, not a literal private address, not the saved ComfyUI origin. A host name passes here
 * and is checked again by the addresses it resolves to before anything is sent.
 */
export function publicWebUrl(value: string, options: WebGuardOptions = {}): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  // "localhost." names the same host as "localhost"; drop the dot so every check sees one spelling.
  if (url.hostname.endsWith('.')) url.hostname = url.hostname.replace(/\.+$/, '');
  const host = bareHost(url);
  if (host === '' || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')
    || host.endsWith('.home.arpa') || host.endsWith('.lan')) return null;
  if (!host.includes('.') && !host.includes(':')) return null;
  if (net.isIP(host) !== 0 && isBlockedAddress(host)) return null;
  const port = effectivePort(url);
  if (port === COMFY_MCP_PORT) return null;
  if (!isSearchHost(host) && port !== '80' && port !== '443') return null;
  if (matchesBlockedOrigin(url, options.blockedOrigins)) return null;
  return url;
}

export interface VettedTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

/**
 * Resolves the host and refuses it when any answer is local or private, so a public-looking name
 * (127.0.0.1.nip.io, localtest.me) cannot reach this machine. The returned address is the one to connect to.
 */
export async function vetWebTarget(url: URL, options: WebGuardOptions = {}): Promise<VettedTarget | null> {
  const checked = publicWebUrl(url.toString(), options);
  if (!checked) return null;
  const host = bareHost(checked);
  if (net.isIP(host) !== 0) return { url: checked, address: host, family: net.isIP(host) === 6 ? 6 : 4 };
  let answers: Array<{ address: string; family: number }>;
  try {
    answers = await (options.lookup ?? defaultLookup)(host);
  } catch {
    return null;
  }
  if (!Array.isArray(answers) || answers.length === 0) return null;
  if (answers.some((answer) => isBlockedAddress(answer.address))) return null;
  const first = answers[0];
  return { url: checked, address: first.address, family: net.isIP(first.address) === 6 ? 6 : 4 };
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

const NULL_BODY_STATUS = new Set([101, 103, 204, 205, 304]);

/**
 * A plain GET over node:http(s) that connects to the vetted address only. The host name still goes into
 * the Host header and TLS server name, so certificates are checked for the name, but a second DNS answer
 * (rebinding) can never change where the connection goes.
 */
export function pinnedRequest(target: VettedTarget, init: RequestInit = {}): Promise<Response> {
  const { url, address, family } = target;
  const client = url.protocol === 'https:' ? https : http;
  const pinnedLookup = (_host: string, options: unknown, callback: (...args: unknown[]) => void) => {
    const all = typeof options === 'object' && options !== null && (options as { all?: boolean }).all === true;
    if (all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
  return new Promise<Response>((resolve, reject) => {
    const signal = init.signal ?? undefined;
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    const request = client.request(url, {
      method: 'GET',
      headers: init.headers as Record<string, string> | undefined,
      lookup: pinnedLookup as never,
      agent: false,
    }, (incoming) => {
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) for (const item of value) responseHeaders.append(name, item);
        else if (typeof value === 'string') responseHeaders.set(name, value);
      }
      const status = incoming.statusCode ?? 502;
      if (NULL_BODY_STATUS.has(status) || status < 200 || status > 599) {
        incoming.resume();
        resolve(new Response(null, { status: status < 200 || status > 599 ? 502 : status, headers: responseHeaders }));
        return;
      }
      const body = Readable.toWeb(incoming) as unknown as ReadableStream<Uint8Array>;
      resolve(new Response(body, { status, headers: responseHeaders }));
    });
    const onAbort = () => request.destroy(signal?.reason instanceof Error ? signal.reason : new Error('aborted'));
    signal?.addEventListener('abort', onAbort, { once: true });
    request.on('error', (error) => {
      signal?.removeEventListener('abort', onAbort);
      reject(error);
    });
    request.on('close', () => signal?.removeEventListener('abort', onAbort));
    request.end();
  });
}

/**
 * One GET to a vetted target. With no fetch passed in, the connection is pinned to the vetted address.
 * An injected fetch (tests, or a caller that already pins) receives the URL as is.
 */
function send(target: VettedTarget, init: RequestInit, fetchImpl: FetchLike | undefined): Promise<Response> {
  if (fetchImpl) return fetchImpl(target.url.toString(), init);
  return pinnedRequest(target, init);
}

/** DuckDuckGo answers bots with an "anomaly" page holding a challenge instead of results. */
export function isSearchChallenge(html: string): boolean {
  return /anomaly-modal|challenge-form|bots use DuckDuckGo|captcha/i.test(html);
}

export const SEARCH_CHALLENGE_ERROR = 'Web search asked for a human check, so no results were read.';

/**
 * Fallback search when the provider has no native web search. Redirects are followed only within the
 * search host. Throws on a challenge page so the tool reports a failure, not an empty result.
 */
export async function searchWebFallback(query: string, fetchImpl?: FetchLike, options: WebGuardOptions = {}): Promise<WebResult[]> {
  const trimmed = query.trim().slice(0, 400);
  if (trimmed === '') return [];
  const timer = timeoutSignal(WEB_TIMEOUT_MS);
  try {
    let url = new URL(`${SEARCH_ENDPOINT}${encodeURIComponent(trimmed)}`);
    for (let hop = 0; ; hop++) {
      // An injected fetch is a test double or a caller that pins itself; the fixed search host is not resolved here.
      const target: VettedTarget | null = fetchImpl
        ? { url, address: '', family: 4 }
        : await vetWebTarget(url, options);
      if (!target) throw new Error('Web search host is not reachable as a public address.');
      const response = await send(target, {
        method: 'GET',
        headers: headers(),
        redirect: 'manual',
        credentials: 'omit',
        signal: timer.signal,
      }, fetchImpl);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || hop >= MAX_REDIRECTS) throw new Error('Search redirected too often.');
        const next = new URL(location, url);
        if (next.protocol !== 'https:' || !next.hostname.endsWith('duckduckgo.com')) throw new Error('Search redirected off the search host.');
        url = next;
        continue;
      }
      if (!response.ok) throw new Error(`Search answered ${response.status}.`);
      const { text } = await readCapped(response, PAGE_BYTE_CAP);
      const results = parseDuckDuckGoHtml(text);
      if (results.length === 0 && isSearchChallenge(text)) throw new Error(SEARCH_CHALLENGE_ERROR);
      return results;
    }
  } finally {
    timer.done();
  }
}

const TEXTUAL = /^(text\/|application\/(xhtml\+xml|xml|json|ld\+json|rss\+xml|atom\+xml))/i;

/**
 * GET one public page as text. Every hop (the first address and up to three redirects) is resolved and
 * checked by address before it is requested.
 */
export async function fetchPageText(rawUrl: string, fetchImpl?: FetchLike, options: WebGuardOptions = {}): Promise<PageText> {
  const first = publicWebUrl(rawUrl, options);
  if (!first) throw new Error('Only public http(s) addresses can be read.');
  let target = await vetWebTarget(first, options);
  if (!target) throw new Error('Only public http(s) addresses can be read.');
  const timer = timeoutSignal(WEB_TIMEOUT_MS);
  try {
    for (let hop = 0; ; hop++) {
      const response = await send(target, {
        method: 'GET',
        headers: headers(),
        redirect: 'manual',
        credentials: 'omit',
        signal: timer.signal,
      }, fetchImpl);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect without a location.');
        if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects.');
        const next = publicWebUrl(new URL(location, target.url).toString(), options);
        const vetted = next ? await vetWebTarget(next, options) : null;
        if (!vetted) throw new Error('Redirect leaves the public web.');
        target = vetted;
        continue;
      }
      if (!response.ok) throw new Error(`The page answered ${response.status}.`);
      const type = response.headers.get('content-type') ?? 'text/html';
      if (!TEXTUAL.test(type)) throw new Error('The page is not text.');
      const body = await readCapped(response, PAGE_BYTE_CAP);
      const isHtml = /html|xml/i.test(type);
      const extracted = isHtml ? htmlToText(body.text) : { title: '', text: body.text.trim() };
      const truncated = body.capped || extracted.text.length > PAGE_TEXT_CAP;
      const note = body.capped
        ? `Only the first ${megabytes(PAGE_BYTE_CAP)} of this page were downloaded (protective limit); the text ends early.`
        : `The page text has ${extracted.text.length} characters; the first ${PAGE_TEXT_CAP} are returned (protective limit).`;
      return {
        url: target.url.toString(),
        // A page title is outside data; 300 characters is more than any real title.
        title: extracted.title.slice(0, 300),
        text: extracted.text.slice(0, PAGE_TEXT_CAP),
        truncated,
        ...(truncated ? { note } : {}),
      };
    }
  } finally {
    timer.done();
  }
}
