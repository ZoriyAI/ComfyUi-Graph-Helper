/**
 * Addresses on this computer, and what the app does with them: an MCP token may go over plain http only to such an
 * address, and an address on this computer typed without a scheme gets http:// added. Used by the settings schema,
 * Settings ▸ Connection and main's ComfyUI and MCP connections (main/comfy, main/mcp, main/ipc.ts).
 */

/**
 * localhost, 127.0.0.0/8 and ::1: addresses that stay on this machine. A name under `.localhost` is not counted:
 * not every resolver keeps it on this machine, and a plain http token must never leave it.
 */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (host === 'localhost') return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return host === '::1' || host === '0:0:0:0:0:0:0:1';
}

/**
 * True when an MCP URL is plain http to another machine. The bearer token rides on every request, so the
 * app refuses such a URL at sync time (main/mcp/client.ts mcpUrlError); Settings says so while it is typed.
 */
export function mcpUrlNeedsHttps(value: string): boolean {
  try {
    const url = new URL(withLoopbackScheme(value));
    return url.protocol === 'http:' && !isLoopbackHost(url.hostname) && isPlausibleHost(url.hostname);
  } catch {
    return false;
  }
}

/** A loopback host typed without a scheme: `localhost:8188`, `127.0.0.1:9000/mcp`, `[::1]:9000`. */
const BARE_LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?(?:[/?#].*)?$/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * The address as the app uses it: trimmed, and with `http://` in front when the person typed an address on this
 * computer without a scheme (the most common slip). Anything else comes back trimmed and unchanged: an address on
 * another computer is never given plain http silently.
 */
export function withLoopbackScheme(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || HAS_SCHEME.test(trimmed)) return trimmed;
  return BARE_LOOPBACK.test(trimmed) ? `http://${trimmed}` : trimmed;
}

/** True when the text starts with a scheme (`http://`, `htp://` …). */
export function hasScheme(value: string): boolean {
  return HAS_SCHEME.test(value.trim());
}

/**
 * Whether a host name can be a real address: a name with letters, or four numbers 0–255. `127.0.0.l` or `192.168.1`
 * are typos, and a typo must not be told that it "needs https".
 */
export function isPlausibleHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (host === '') return false;
  if (host.includes(':')) return true;
  const labels = host.split('.');
  if (labels.every((label) => /^\d+$/.test(label))) return labels.length === 4 && labels.every((label) => Number(label) <= 255);
  // Numbers with a stray letter in the last part (127.0.0.l, 192.168.1.1o): a mistyped number address.
  if (labels.length === 4 && labels.slice(0, 3).every((label) => /^\d+$/.test(label))) return false;
  return labels.every((label) => /^[a-z0-9-]{1,63}$/.test(label) && !label.startsWith('-') && !label.endsWith('-'));
}
