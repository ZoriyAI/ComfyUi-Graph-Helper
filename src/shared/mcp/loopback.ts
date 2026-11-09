/** localhost, 127.0.0.0/8 and ::1: addresses that stay on this machine. */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return host === '::1' || host === '0:0:0:0:0:0:0:1';
}

/**
 * True when an MCP URL is plain http to another machine. The bearer token rides on every request, so the
 * app refuses such a URL at sync time (main/mcp/client.ts mcpUrlError); Settings says so while it is typed.
 */
export function mcpUrlNeedsHttps(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' && !isLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}
