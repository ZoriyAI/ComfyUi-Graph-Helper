/** Pending assistant work belongs to the profile, but does not become an accepted lesson or installed code. */
import type Database from 'better-sqlite3';
import { DESKTOP_PROJECT_ID } from '../../shared/project';

type Draft = { id: string; createdAt: number; persistent?: boolean };
type Kind = 'lesson' | 'extension';
// One legacy lesson can contain up to 8 MiB of UTF-8, plus its pending-draft envelope.
const MAX_DRAFT_BYTES = 9 * 1024 * 1024;

/** The same bounded store can run without a database in isolated tool tests. Reads never cache SQLite rows. */
export class DraftStore<T extends Draft> {
  private db?: Database.Database;
  private mayPersist = () => true;
  private containsHeldSecret = (_text: string) => false;
  private readonly memory = new Map<string, { projectId: string; draft: T }>();

  constructor(private readonly kind: Kind, private readonly limit: number, private readonly read: (value: unknown) => T | null) {}

  attach(db: Database.Database, mayPersist = () => true, containsHeldSecret = (_text: string) => false): void {
    this.db = db; this.mayPersist = mayPersist; this.containsHeldSecret = containsHeldSecret; this.memory.clear();
  }

  clearMemory(projectId: string): void {
    for (const [id, row] of this.memory) if (row.projectId === projectId) this.memory.delete(id);
  }

  put(input: T, projectId = DESKTOP_PROJECT_ID): T {
    const draft = { ...input, persistent: !!this.db && this.mayPersist() };
    if (!projectId || projectId.length > 200 || !this.read(draft)) throw new Error('Invalid pending draft.');
    const payload = JSON.stringify(draft);
    if (this.containsHeldSecret(payload)) throw new Error('Remove credentials and secrets from the pending draft.');
    if (Buffer.byteLength(payload) > MAX_DRAFT_BYTES) throw new Error('The pending draft is too large.');
    if (this.db && draft.persistent) {
      const db = this.db;
      db.transaction(() => {
        db.prepare('INSERT OR REPLACE INTO assistant_drafts (id, kind, project_id, created_at, payload) VALUES (?, ?, ?, ?, ?)')
          .run(draft.id, this.kind, projectId, draft.createdAt, payload);
        db.prepare(`DELETE FROM assistant_drafts WHERE kind = ? AND project_id = ? AND id NOT IN
          (SELECT id FROM assistant_drafts WHERE kind = ? AND project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)`)
          .run(this.kind, projectId, this.kind, projectId, this.limit);
      }).immediate();
      return structuredClone(draft);
    }
    this.memory.set(draft.id, { projectId, draft: structuredClone(draft) });
    const own = [...this.memory.entries()].filter(([, row]) => row.projectId === projectId);
    for (const [id] of own.slice(0, Math.max(0, own.length - this.limit))) this.memory.delete(id);
    return structuredClone(draft);
  }

  get(id: string): T | null {
    if (!id || id.length > 64) return null;
    const temporary = this.memory.get(id)?.draft;
    if (temporary) return structuredClone(temporary);
    if (!this.db) return null;
    const row = this.db.prepare('SELECT payload FROM assistant_drafts WHERE id = ? AND kind = ?').get(id, this.kind) as { payload: string } | undefined;
    if (!row || row.payload.length > MAX_DRAFT_BYTES) return null;
    try {
      const draft = this.read(JSON.parse(row.payload));
      return draft?.id === id ? { ...draft, persistent: true } : null;
    } catch { return null; }
  }

  remove(id: string): void {
    if (this.db) this.db.prepare('DELETE FROM assistant_drafts WHERE id = ? AND kind = ?').run(id, this.kind);
    this.memory.delete(id);
  }
}
