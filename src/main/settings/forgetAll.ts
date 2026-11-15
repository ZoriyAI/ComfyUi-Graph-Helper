import type Database from 'better-sqlite3';
import { KEY_PROVIDERS, type KeyProvider } from '../../shared/config/keyOrigin';
import { readKeyFile, removeKeyFile } from './keyFile';
import { readTokenFile, removeTokenFile } from '../mcp/tokenFile';

/**
 * Settings ▸ Privacy ▸ "Forget all keys and tokens": every secret the app keeps, wherever it is.
 * - `secret_records`: every row (model keys of every provider, manual MCP tokens for every address, browser sign-in
 *   client records and tokens for every address, the one-key-era record). The table holds nothing else.
 * - The two app-folder files (model keys, MCP token).
 * - Memory: held model keys, the MCP token, the browser sign-in state.
 * The rows are deleted with secure_delete on and the database is then rebuilt (VACUUM) and the write-ahead log
 * emptied, so the ciphertext does not stay readable in free pages or in the log file.
 */
export interface ForgetAllDeps {
  db: Database.Database;
  userData: string;
  /** Clears every model key held in memory. */
  forgetKeys: () => void;
  /** Clears the MCP token held in memory. */
  forgetMcpToken: () => void;
  /** Clears every browser sign-in held in memory (and cancels one in progress). */
  forgetSignIns: () => void;
}

export interface ForgetAllResult {
  records: number;
  files: number;
  /** False when the database could not be rebuilt; the rows are deleted all the same. */
  compacted: boolean;
}

/** Deletes every secret row and makes the deleted bytes unrecoverable from the database files. */
export function eraseSecretRecords(db: Database.Database): { records: number; compacted: boolean } {
  db.pragma('secure_delete = ON');
  const records = db.prepare('DELETE FROM secret_records').run().changes;
  let compacted = true;
  try {
    db.exec('VACUUM');
  } catch {
    compacted = false;
  }
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    compacted = false;
  }
  return { records, compacted };
}

export function forgetEverySecret(deps: ForgetAllDeps): ForgetAllResult {
  // Memory first: nothing can be sent with a secret while the rows go.
  for (const clear of [deps.forgetKeys, deps.forgetMcpToken, deps.forgetSignIns]) {
    try {
      clear();
    } catch {
      // One failing part must not keep the others.
    }
  }
  const files = [removeKeyFile(deps.userData), removeTokenFile(deps.userData)].filter(Boolean).length;
  const { records, compacted } = eraseSecretRecords(deps.db);
  return { records, files, compacted };
}

/** What "Forget all" would remove right now: names and counts only, never a value. */
export interface SecretInventory {
  /** Cloud providers with a key held now or remembered (OS store record or app folder file). */
  providers: KeyProvider[];
  /** Server access tokens: held now, remembered per address, or in the app folder file. */
  serverTokens: number;
  /** Browser sign-ins (MCP addresses with tokens), held now or remembered. */
  signIns: number;
}

export interface InventoryDeps {
  db: Database.Database;
  userData: string;
  /** Providers whose key is held in memory now. */
  heldProviders: () => string[];
  /** The MCP origin a held token belongs to, or '' for a held token not yet bound; null when none is held. */
  heldTokenOrigin: () => string | null;
  /** MCP origins with browser sign-in tokens in memory. */
  heldSignIns: () => string[];
}

const PROVIDERS = KEY_PROVIDERS;

export function secretInventory(deps: InventoryDeps): SecretInventory {
  const names = (deps.db.prepare('SELECT name FROM secret_records').all() as Array<{ name: string }>).map((row) => row.name);
  const file = readKeyFile(deps.userData);
  const held = new Set(deps.heldProviders());
  const providers = PROVIDERS.filter((provider) => held.has(provider) || names.includes(`provider-key:${provider}`) || provider in file);
  const tokens = new Set(names.filter((name) => name.startsWith('mcp-token:')).map((name) => name.slice('mcp-token:'.length)));
  const tokenFile = readTokenFile(deps.userData);
  if (tokenFile) tokens.add(tokenFile.origin);
  const heldToken = deps.heldTokenOrigin();
  if (heldToken !== null) tokens.add(heldToken || 'unbound');
  const signIns = new Set(names.filter((name) => name.startsWith('mcp-oauth-tokens:')).map((name) => name.slice('mcp-oauth-tokens:'.length)));
  for (const origin of deps.heldSignIns()) signIns.add(origin);
  return { providers, serverTokens: tokens.size, signIns: signIns.size };
}
