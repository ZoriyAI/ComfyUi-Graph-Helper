/** Holds the MCP bearer token in process memory only. It is never written, returned, or logged. */
let token: string | null = null;

export function setMcpToken(value: unknown): { held: boolean } {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8000) {
    token = null;
    return { held: false };
  }
  token = value;
  return { held: true };
}

export function mcpToken(): string | null {
  return token;
}

export function mcpTokenStatus(): { held: boolean } {
  return { held: token != null };
}
