/**
 * OAuth sign-in to the MCP server. Main keeps every token; the renderer only ever sees this status.
 * `persisted`: the tokens are stored as OS-encrypted ciphertext; false means they live for this session only.
 */
export interface McpOAuthStatus {
  state: 'none' | 'pending' | 'authorized' | 'expired';
  /** When the current access token lapses (ms since epoch). Refresh is automatic while a refresh token is held. */
  expiresAt?: number;
  persisted: boolean;
}

/** `anonymous`: the server accepted a connection without credentials, so no sign-in happened and none is needed. */
export type McpOAuthLoginResult = { ok: true; expiresAt?: number; anonymous?: boolean } | { ok: false; error: string };

/**
 * What the MCP server at an address wants from a connection, found out by trying: 'none' when a connection without
 * credentials is accepted (with the number of tools it lists), 'oauth' when it answers 401 and publishes OAuth
 * metadata (browser sign-in), 'token' when it answers 401 without any (a pasted token). Failures are fixed sentences.
 */
export type McpAuthProbe =
  | { ok: true; mode: 'none'; tools: number }
  | { ok: true; mode: 'oauth' | 'token' }
  | { ok: false; error: string };
