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
/**
 * The kind of MCP server, from its tool list (main/mcp/profiles.ts); null when the app does not know how to read it.
 * Absent when the tools could not be listed (a sign-in is needed first).
 */
export type McpProfileName = 'catalog' | 'modelList' | 'checkpointList';

export type McpAuthProbe = (
  | { ok: true; mode: 'none'; tools: number; profile?: McpProfileName | null }
  | { ok: true; mode: 'oauth' }
  /** `tokenAccepted`: a held token was tried against the 401; absent when none was held. */
  | { ok: true; mode: 'token'; tokenAccepted?: boolean; tools?: number; profile?: McpProfileName | null }
  | { ok: false; error: string }
) & {
  /**
   * Present when the typed address was an address on this computer without http://: the address that was
   * checked, with http:// added. The form puts it into the field and says so (settings.addressCompleted).
   */
  completedUrl?: string;
};

/** Where the MCP token lives right now, as the Connection screen shows it; never the token. */
export interface McpTokenStatus {
  held: boolean;
  source: 'none' | 'session' | 'os' | 'file';
  /** OS password manager holds ciphertext for the saved MCP origin. */
  stored: boolean;
  /** The app folder file holds the token for the saved MCP origin (the person's explicit choice). */
  inFile: boolean;
}

/** A cloud model provider; each has its own key, never shared with another. */
export type CloudKeyProvider = 'openai' | 'anthropic' | 'google';
export const CLOUD_KEY_PROVIDERS: readonly CloudKeyProvider[] = ['openai', 'anthropic', 'google'];

/** Where one provider's key lives right now: nowhere, in memory for this session, in the OS store, or in the file. */
export type KeySourceName = 'none' | 'session' | 'os' | 'file';

/** llm:session-status: the next send's provider key place and every cloud provider's. Never a key. */
export interface SessionKeyStatus {
  held: boolean;
  source: KeySourceName;
  providers: Record<CloudKeyProvider, KeySourceName>;
  /** The address (origin) each held key belongs to; null when none is held. Never a key. */
  origins?: Record<CloudKeyProvider, string | null>;
}

/** settings:secret-status: the OS store decision and, per provider, whether a key is remembered. Never a key. */
export interface SecretStatus {
  persist: boolean;
  backend: string;
  reason: string;
  /** For the provider asked about (or the saved one). */
  stored: boolean;
  inFile: boolean;
  providers: Record<CloudKeyProvider, { source: KeySourceName; stored: boolean; inFile: boolean }>;
}

/** Settings ▸ Privacy ▸ "Password store": what the app found and what the person chose for the next start. */
export interface SecretStoreInfo {
  backend: string;
  persist: boolean;
  reason: string;
  override: 'gnome-libsecret' | 'kwallet6' | 'kwallet5' | 'kwallet' | null;
}
