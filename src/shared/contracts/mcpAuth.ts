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
