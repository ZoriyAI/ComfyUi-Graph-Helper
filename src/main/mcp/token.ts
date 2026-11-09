/**
 * Holds the MCP bearer token in process memory only. It is never written, returned, or logged.
 * The token is tied to the MCP origin it was given for: when the saved MCP URL moves to another origin,
 * the token is dropped so it is never sent to a server it was not meant for.
 */
let token: string | null = null;
let heldFor: string | null = null;

function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function setMcpToken(value: unknown, forUrl?: string | null): { held: boolean } {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8000) {
    token = null;
    heldFor = null;
    return { held: false };
  }
  token = value;
  heldFor = originOf(forUrl);
  return { held: true };
}

export function mcpToken(): string | null {
  return token;
}

/**
 * Call wherever the MCP URL is read. A token held for another origin is forgotten; a token set before any URL
 * was saved is bound to this one.
 */
export function releaseMcpTokenIfOriginChanged(url: string | null | undefined): void {
  if (token == null) return;
  const origin = originOf(url);
  if (heldFor == null) {
    heldFor = origin;
    return;
  }
  if (origin !== heldFor) {
    token = null;
    heldFor = null;
  }
}

/** The token to send to `url`, or null when it was held for another origin (it is then forgotten). */
export function mcpTokenFor(url: string | null | undefined): string | null {
  releaseMcpTokenIfOriginChanged(url);
  return token;
}

export function mcpTokenStatus(): { held: boolean } {
  return { held: token != null };
}
