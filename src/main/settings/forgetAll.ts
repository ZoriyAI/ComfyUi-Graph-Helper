/**
 * Settings ▸ Privacy ▸ "Forget all keys and tokens" and the list of what it would remove.
 * Called from ipc.ts (forgetEverySecret, secretInventory). What is removed and how is described below.
 */
import type Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { KEY_PROVIDERS, type KeyProvider } from '../../shared/config/keyOrigin';
import { keyFilePath, readKeyFile, removeKeyFile } from './keyFile';
import { readTokenFile, removeTokenFile, tokenFilePath } from '../mcp/tokenFile';
import { removePrivateFile } from '../files/atomicWrite';

/** Only temporary names produced by writeFileAtomic for the two secret files, never neighboring user files. */
function temporarySecretFiles(userData: string): { files: string[]; readable: boolean } {
  try {
    return { files: fs.readdirSync(userData).filter((name) => /^\.(?:model-key|mcp-token)\.json\.[a-f0-9]{12}\.tmp$/.test(name)).map((name) => path.join(userData, name)), readable: true };
  } catch (error) {
    return { files: [], readable: (error as { code?: string }).code === 'ENOENT' };
  }
}

/** An empty file is cleared; an unreadable file or link cannot be assumed free of secret bytes. */
function mayHoldSecret(file: string): boolean {
  try {
    const stat = fs.lstatSync(file);
    return !stat.isFile() || stat.size > 0;
  } catch (error) {
    return (error as { code?: string }).code !== 'ENOENT';
  }
}

/**
 * What "Forget all keys and tokens" reaches: every secret the app keeps, wherever it is.
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

/** What was removed, for the confirmation the panel shows. */
export interface ForgetAllResult {
  records: number;
  files: number;
  /** False when the database could not be rebuilt; the rows are deleted all the same. */
  compacted: boolean;
  /** Store kinds that could not be cleared or verified; never paths or secret values. */
  failed: Array<'memory' | 'keys-file' | 'token-file' | 'temporary-files' | 'database'>;
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

/** Forgets every secret: memory, then the app-folder files, then the database rows. */
export function forgetEverySecret(deps: ForgetAllDeps): ForgetAllResult {
  const failed = new Set<ForgetAllResult['failed'][number]>();
  // Memory first: nothing can be sent with a secret while the rows go.
  for (const clear of [deps.forgetKeys, deps.forgetMcpToken, deps.forgetSignIns]) {
    try {
      clear();
    } catch {
      failed.add('memory');
    }
  }
  let files = 0;
  const clearFile = (outcome: ReturnType<typeof removeKeyFile>, kind: ForgetAllResult['failed'][number]) => {
    if (outcome === 'removed') files += 1;
    if (outcome === 'failed') failed.add(kind);
  };
  clearFile(removeKeyFile(deps.userData), 'keys-file');
  clearFile(removeTokenFile(deps.userData), 'token-file');
  const temporary = temporarySecretFiles(deps.userData);
  if (!temporary.readable) failed.add('temporary-files');
  for (const file of temporary.files) clearFile(removePrivateFile(file), 'temporary-files');
  const { records, compacted } = eraseSecretRecords(deps.db);
  if (!compacted) failed.add('database');
  return { records, files, compacted, failed: [...failed] };
}

/** What "Forget all" would remove right now: names and counts only, never a value. */
export interface SecretInventory {
  /** Cloud providers with a key held now or remembered (OS store record or app folder file). */
  providers: KeyProvider[];
  /** Server access tokens: held now, remembered per address, or in the app folder file. */
  serverTokens: number;
  /** Browser sign-ins (MCP addresses with tokens), held now or remembered. */
  signIns: number;
  /** Nonempty crash files or unreadable secret files not already accounted for by their readable contents. */
  files?: number;
  /** A profile folder that could not be listed, so crash files cannot yet be ruled out. */
  unverified?: number;
}

/** Whether any known or unverified secret storage remains. */
export function hasSecrets(inventory: SecretInventory): boolean {
  return inventory.providers.length > 0 || inventory.serverTokens > 0 || inventory.signIns > 0 || (inventory.files ?? 0) > 0 || (inventory.unverified ?? 0) > 0;
}

/** The inventory confirmed gone, rather than everything that existed before a partial clear. */
export function secretInventoryDifference(before: SecretInventory, after: SecretInventory): SecretInventory {
  return {
    providers: before.providers.filter((provider) => !after.providers.includes(provider)),
    serverTokens: Math.max(0, before.serverTokens - after.serverTokens),
    signIns: Math.max(0, before.signIns - after.signIns),
    ...((before.files ?? 0) > (after.files ?? 0) ? { files: (before.files ?? 0) - (after.files ?? 0) } : {}),
  };
}

/** What secretInventory needs to see the secrets held in memory (ipc.ts passes the live services). */
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

/** Counts by kind; a secret both held and stored counts once. Record names are `<kind>:<provider or origin>`. */
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
  const temporary = temporarySecretFiles(deps.userData);
  const files = temporary.files.filter(mayHoldSecret).length
    + (Object.keys(file).length === 0 && mayHoldSecret(keyFilePath(deps.userData)) ? 1 : 0)
    + (!tokenFile && mayHoldSecret(tokenFilePath(deps.userData)) ? 1 : 0);
  return { providers, serverTokens: tokens.size, signIns: signIns.size, ...(files > 0 ? { files } : {}), ...(!temporary.readable ? { unverified: 1 } : {}) };
}
