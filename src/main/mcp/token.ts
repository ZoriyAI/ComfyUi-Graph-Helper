/**
 * Holds the MCP bearer token in process memory. It is never returned or logged. Where it came from is remembered:
 * pasted for this session, unlocked from the OS password manager, or read from the app folder file the person
 * chose on a computer without a password store. The token is tied to the MCP origin it was given for: when the
 * saved MCP URL moves to another origin, the token is dropped so it is never sent to a server it was not meant for.
 * Used by ipc.ts (set, status, release on an address change), mcp/sync.ts and mcp/savedSession.ts (the token to
 * send) and llmService.ts (so the token can be redacted from model text).
 */
export type McpTokenSource = 'none' | 'session' | 'os' | 'file';

let token: string | null = null;
let heldFor: string | null = null;
let source: McpTokenSource = 'none';

/** The origin a token would be bound to for this URL; null for no URL or an unreadable one. */
export function mcpOriginOf(url: string | null | undefined): string | null {
  return originOf(url);
}

function originOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Holds a token for the origin of `forUrl` (unbound when no URL is given yet). Anything that is not a plausible
 * token (empty, not a string, longer than 8000 characters) clears what was held instead.
 */
export function setMcpToken(value: unknown, forUrl?: string | null, from: Exclude<McpTokenSource, 'none'> = 'session'): { held: boolean; source: McpTokenSource } {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8000) {
    token = null;
    heldFor = null;
    source = 'none';
    return { held: false, source };
  }
  token = value;
  heldFor = originOf(forUrl);
  source = from;
  return { held: true, source };
}

/** The held token whatever its origin: for redaction and for callers that already checked the origin. */
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
    source = 'none';
  }
}

/** The token to send to `url`, or null when it was held for another origin (it is then forgotten). */
export function mcpTokenFor(url: string | null | undefined): string | null {
  releaseMcpTokenIfOriginChanged(url);
  return token;
}

/** Whether a token is held and where it came from, for Settings; never the token. */
export function mcpTokenStatus(): { held: boolean; source: McpTokenSource } {
  return { held: token != null, source: token != null ? source : 'none' };
}

/** The origin the held token is for ('' when not yet bound to one), or null when no token is held. Never the token. */
export function mcpTokenOrigin(): string | null {
  return token == null ? null : heldFor ?? '';
}
