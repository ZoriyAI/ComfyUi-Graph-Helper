/**
 * The proxy the app's internet requests go through (cloud models, the web search). Empty means the system's own
 * proxy settings, which is what most people need; a typed address is for a network whose proxy the system does not
 * announce. Requests to the person's own computer and home network never go through a proxy.
 * main/net/proxy.ts applies it to the app's session; preferences.ts and Settings ▸ Assistant check a typed address.
 */

/** The longest proxy address kept. */
export const PROXY_MAX = 300;

/**
 * The proxy rule Chromium takes for a typed address, or null when the text is not a proxy address.
 * Accepted: http://host:port, https://host:port, socks5://host:port, socks4://host:port; no user name or password
 * (a password would sit in the settings file in plain text).
 */
export function proxyRuleFor(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.length > PROXY_MAX) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const scheme = url.protocol.replace(/:$/, '');
  if (!['http', 'https', 'socks4', 'socks5'].includes(scheme)) return null;
  if (url.username !== '' || url.password !== '' || url.hostname === '') return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  if (url.search !== '' || url.hash !== '') return null;
  const port = url.port || (scheme === 'https' ? '443' : scheme === 'http' ? '80' : '1080');
  return `${scheme}://${url.hostname}:${port}`;
}

/** Whether a typed proxy address is acceptable to keep: empty (the system's) or a proxy address. */
export function proxyAddressValid(text: string): boolean {
  return text.trim() === '' || proxyRuleFor(text) !== null;
}

/**
 * The private IPv4 ranges as [first part, second part, prefix length]: "this network" (0.0.0.0/8, which reaches
 * this computer), loopback, the three private blocks and link-local. isPrivateHost and PROXY_BYPASS both read this
 * one list, so the app's own direct-connection rule and the bypass Chromium is given cannot disagree.
 */
const PRIVATE_RANGES: ReadonlyArray<[number, number, number]> = [[0, 0, 8], [127, 0, 8], [10, 0, 8], [172, 16, 12], [192, 168, 16], [169, 254, 16]];
/** The private IPv6 ranges in the same form for both checks: unique local (fc00::/7) and link-local (fe80::/10). */
const PRIVATE_V6 = ['fc00::/7', 'fe80::/10'];

/** Whether the first two parts of an IPv4 address fall in one of PRIVATE_RANGES (all have a prefix of 16 or less). */
function inPrivateV4(a: number, b: number): boolean {
  const high = ((a << 8) | b) >>> 0;
  return PRIVATE_RANGES.some(([ra, rb, bits]) => {
    const shift = 16 - bits;
    return high >>> shift === (((ra << 8) | rb) >>> 0) >>> shift;
  });
}

/**
 * Hosts a proxy is never used for: this computer and the private ranges of a home or office network, where the
 * person's own model server lives.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) return inPrivateV4(Number(v4[1]), Number(v4[2]));
  // fc00::/7 is fc.. and fd..; fe80::/10 is fe8. to feb. .
  return /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host);
}

/** The bypass list given with a typed proxy, in Chromium's format: this computer and the private ranges. */
export const PROXY_BYPASS = [
  '<local>', 'localhost', '*.localhost', '::1', '*.local',
  ...PRIVATE_RANGES.map(([a, b, bits]) => `${a}.${b}.0.0/${bits}`),
  ...PRIVATE_V6,
].join(';');
