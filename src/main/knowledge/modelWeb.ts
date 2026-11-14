import { joinServerPath } from '../../shared/mcp/serverPaths';
import type Database from 'better-sqlite3';
import type { ModelLookupResult } from '../../shared/contracts/knowledge';
import { toolPayload, type McpSession } from '../../shared/mcp/catalogSource';
import { inferBaseModel } from '../../shared/knowledge/baseModel';
import { sha256Text } from '../../shared/knowledge/enrichment';
import type { WebError } from '../../shared/knowledge/webLookup';
import { isModelFilePath } from '../mcp/readOnly';
import { modelDetail } from './repository';
import { CARD_LOOKUP_PAUSE_MS, type LookupOutcome, type ModelWebClient } from './webLookup';

/**
 * What the internet said about a model file, kept in the catalog so it survives a restart and is not asked again,
 * and the card's "Find on the internet" that asks.
 *
 * The card asks in two steps the person sees. When the file's fingerprint is not known (no description next to it
 * gave one), the MCP server makes it: `workspace_files {action:'hash'}` of that one model file, which reads the
 * file on the server and changes nothing. A file of many gigabytes takes a while, so it is only ever done on that
 * click, never during sync. Then Civitai is asked by the fingerprint and, when it does not know the file, Hugging
 * Face by the name.
 */

/** Making the fingerprint of a large file on the server can take minutes; the usual call wait is far shorter. */
export const HASH_TIMEOUT_MS = 10 * 60_000;

/**
 * The SHA-256 in the server's answer to `hash`. Read with care, as the exact shape is the server's: a `sha256`
 * field at the top, or one level down (`{ hash: { sha256 } }`, `{ result: { sha256 } }`), or a `hash`/`digest`
 * field next to `algorithm: "sha256"`. Null when none of these holds 64 hex digits.
 */
export function sha256FromHashAnswer(payload: unknown): string | null {
  const record = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
  const at = (row: Record<string, unknown> | null): string | null => {
    if (!row) return null;
    const direct = sha256Text(row.sha256) ?? sha256Text(row.SHA256);
    if (direct) return direct;
    if (typeof row.algorithm === 'string' && /^sha-?256$/i.test(row.algorithm)) return sha256Text(row.hash) ?? sha256Text(row.digest);
    return null;
  };
  const top = record(payload);
  const found = at(top);
  if (found || !top) return found;
  for (const value of Object.values(top)) {
    const nested = at(record(value));
    if (nested) return nested;
  }
  return null;
}

/** Stores the fingerprint the server made of a file. */
export function writeFileHash(db: Database.Database, directory: string, name: string, sha256: string): void {
  db.prepare('UPDATE model_catalog SET sha256 = ? WHERE directory = ? AND name = ?').run(sha256, directory, name);
}

/**
 * Stores how a lookup ended. Found: what was found and, from Civitai only (an exact match), the family it names,
 * which a file whose family is not known otherwise takes, marked as learned from the internet. Not found: nothing
 * of an earlier find stays. A failed lookup never wipes out an earlier find.
 */
export function writeWebOutcome(db: Database.Database, directory: string, name: string, outcome: LookupOutcome, now: number): void {
  const write = db.transaction(() => {
    if (outcome.status === 'error') {
      db.prepare(`UPDATE model_catalog SET web_status = 'error', web_error = ?, web_checked_at = ?
        WHERE directory = ? AND name = ? AND COALESCE(web_status, '') <> 'found'`).run(outcome.error, now, directory, name);
      return;
    }
    const found = outcome.status === 'found' ? outcome.found : null;
    const family = found?.source === 'civitai' && found.notes.baseModelLabel
      ? inferBaseModel({ sidecarBaseModel: found.notes.baseModelLabel }).family
      : 'unknown';
    db.prepare(`UPDATE model_catalog SET web_status = ?, web_error = NULL, web_checked_at = ?, web_source = ?, web_url = ?,
      web_notes_json = ?, web_preview_url = ?, web_family = ? WHERE directory = ? AND name = ?`).run(
      outcome.status, now, found?.source ?? null, found?.url ?? null, found ? JSON.stringify(found) : '{}', found?.preview?.url ?? null,
      family === 'unknown' ? null : family, directory, name,
    );
    if (family !== 'unknown') {
      db.prepare(`UPDATE model_catalog SET base_model = ?, base_model_evidence = 'web'
        WHERE directory = ? AND name = ? AND base_model = 'unknown'`).run(family, directory, name);
    } else {
      // A family an earlier find gave goes with that find.
      db.prepare(`UPDATE model_catalog SET base_model = 'unknown', base_model_evidence = 'none'
        WHERE directory = ? AND name = ? AND base_model_evidence = 'web'`).run(directory, name);
    }
  });
  write.immediate();
}

export interface DueLookup {
  directory: string;
  name: string;
  sha256: string;
}

/**
 * Files sync may look up: their fingerprint is known (sync never makes one), nothing from Civitai lies next to
 * them, and they were never asked about, or the last ask failed before this run began.
 */
export function dueLookups(db: Database.Database, limit: number, runStartedAt: number): DueLookup[] {
  return db.prepare(`SELECT directory, name, sha256 FROM model_catalog
    WHERE sha256 IS NOT NULL AND sha256 <> ''
      AND COALESCE(source_url, '') NOT LIKE 'https://civitai.com/%'
      AND (web_status IS NULL OR (web_status = 'error' AND COALESCE(web_checked_at, 0) < ?))
    ORDER BY CASE directory WHEN 'loras' THEN 0 WHEN 'checkpoints' THEN 1 ELSE 2 END, directory, name
    LIMIT ?`).all(runStartedAt, limit) as DueLookup[];
}

export interface ModelLookupDeps {
  db: () => Database.Database;
  client: () => ModelWebClient;
  /** A read-only session with the saved MCP server, or null when there is none. The caller closes it. */
  open: () => Promise<McpSession | null>;
  now?: () => number;
}

interface FileRow {
  root_path: string | null;
  sha256: string | null;
}

/** The card's two steps: the fingerprint on the server, then the lookup. One at a time per file. */
export class ModelLookupService {
  private readonly running = new Map<string, Promise<ModelLookupResult>>();

  constructor(private readonly deps: ModelLookupDeps) {}

  private once(key: string, work: () => Promise<ModelLookupResult>): Promise<ModelLookupResult> {
    const held = this.running.get(key);
    if (held) return held;
    const promise = work().finally(() => this.running.delete(key));
    this.running.set(key, promise);
    return promise;
  }

  private row(directory: string, name: string): FileRow | undefined {
    return this.deps.db().prepare('SELECT root_path, sha256 FROM model_catalog WHERE directory = ? AND name = ?').get(directory, name) as FileRow | undefined;
  }

  private failed(error: WebError, directory: string, name: string): ModelLookupResult {
    return { ok: false, error, detail: modelDetail(this.deps.db(), directory, name) };
  }

  /** Has the MCP server make the file's SHA-256 and stores it. A fingerprint already known is not made again. */
  hash(directory: string, name: string): Promise<ModelLookupResult> {
    return this.once(`hash\n${directory}/${name}`, async () => {
      const row = this.row(directory, name);
      if (!row) return { ok: true, detail: null };
      if (row.sha256) return { ok: true, detail: modelDetail(this.deps.db(), directory, name) };
      const path = row.root_path ? joinServerPath(row.root_path, name) : null;
      if (!path || !isModelFilePath(path)) return this.failed('no-hash', directory, name);
      let session: McpSession | null = null;
      try {
        session = await this.deps.open();
      } catch {
        session = null;
      }
      if (!session) return this.failed('no-server', directory, name);
      try {
        const result = await session.callTool('workspace_files', { action: 'hash', absolute_path: path }, { timeoutMs: HASH_TIMEOUT_MS });
        const sha256 = result.isError === true ? null : sha256FromHashAnswer(toolPayload(result));
        if (!sha256) return this.failed('no-hash', directory, name);
        writeFileHash(this.deps.db(), directory, name, sha256);
        return { ok: true, detail: modelDetail(this.deps.db(), directory, name) };
      } catch {
        return this.failed('no-hash', directory, name);
      } finally {
        void session.close().catch(() => undefined);
      }
    });
  }

  /** Asks Civitai (by fingerprint) and, failing that, Hugging Face (by name), and stores how it ended. */
  lookup(directory: string, name: string): Promise<ModelLookupResult> {
    return this.once(`lookup\n${directory}/${name}`, async () => {
      const row = this.row(directory, name);
      if (!row) return { ok: true, detail: null };
      const outcome = await this.deps.client().lookup({ sha256: row.sha256, filename: name }, CARD_LOOKUP_PAUSE_MS);
      writeWebOutcome(this.deps.db(), directory, name, outcome, (this.deps.now ?? Date.now)());
      const detail = modelDetail(this.deps.db(), directory, name);
      return outcome.status === 'error' ? { ok: false, error: outcome.error, detail } : { ok: true, detail };
    });
  }
}
