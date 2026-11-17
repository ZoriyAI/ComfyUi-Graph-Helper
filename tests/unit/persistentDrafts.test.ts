/** Real SQLite restarts, opt-out, corruption and privacy erasure for pending assistant work. */
import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LessonDrafts } from '../../src/main/lessons/drafts';
import { ExtensionDrafts } from '../../src/main/extensions/drafts';
import { clearChatHistory } from '../../src/main/agent/chatHistory';
import { migrate, schemaVersion, SCHEMA_VERSION } from '../../src/main/settings/migrate';
import { sampleDoc } from '../fixtures/lessons/sampleLesson';

const proposal = {
  slug: 'sample_node', name: 'Example', purpose: 'Review a source package.', inputs: [], outputs: [{ name: 'value', type: 'STRING' }], dependencies: [],
  files: [{ path: '__init__.py', content: 'NODE_CLASS_MAPPINGS = {}' }, { path: 'README.md', content: 'Review before installing. No dependencies.' }],
};
const folders: string[] = [];
const databases: Database.Database[] = [];
function database(file = ':memory:') {
  const db = new Database(file); databases.push(db); migrate(db); return db;
}
function diskFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-drafts-')); folders.push(dir); return path.join(dir, 'workspace.db');
}
function stores(db: Database.Database, keep = () => true) {
  const lessons = new LessonDrafts(); const extensions = new ExtensionDrafts(); lessons.attach(db, keep); extensions.attach(db, keep);
  return { lessons, extensions };
}
afterEach(() => { for (const db of databases.splice(0)) if (db.open) db.close(); for (const dir of folders.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

describe('pending drafts across restarts', () => {
  it('restores lesson content and the same exportable extension after closing the real database', () => {
    const file = diskFile(); const first = database(file); const a = stores(first);
    const lesson = a.lessons.add(sampleDoc(), 'catalog', 42, 'project-a');
    const extension = a.extensions.add(proposal, 'assistant', 'project-a');
    first.close();
    const b = stores(database(file));
    expect(b.lessons.get(lesson.id)).toEqual({ ...lesson, persistent: true });
    expect(b.extensions.get(extension.id)).toEqual({ ...extension, persistent: true });
    expect(fs.readdirSync(path.dirname(file))).not.toContain('lessons'); // no acceptance or installation
  });

  it('respects chat-history opt-out and never writes the temporary source into SQLite', () => {
    const db = database(); let keep = false; const a = stores(db, () => keep);
    const lesson = a.lessons.add(sampleDoc(), 'lesson'); const extension = a.extensions.add(proposal);
    expect(lesson.persistent).toBe(false); expect(extension.persistent).toBe(false);
    expect(db.prepare('SELECT COUNT(*) AS n FROM assistant_drafts').get()).toEqual({ n: 0 });
    expect(a.lessons.get(lesson.id)).toEqual(lesson);
    const restarted = stores(db); expect(restarted.lessons.get(lesson.id)).toBeNull(); expect(restarted.extensions.get(extension.id)).toBeNull();
    keep = true;
    expect(a.lessons.add(sampleDoc(), 'lesson').persistent).toBe(true);
  });

  it('bounds each kind per project without deleting another project’s work', () => {
    const db = database(); const a = stores(db); const other = a.lessons.add(sampleDoc(), 'lesson', 0, 'other');
    const oldest = a.lessons.add(sampleDoc(), 'lesson', 1, 'mine');
    for (let i = 0; i < 20; i++) a.lessons.add(sampleDoc(), 'lesson', i + 2, 'mine');
    const firstExtension = a.extensions.add(proposal, 'assistant', 'mine');
    for (let i = 0; i < 12; i++) a.extensions.add(proposal, 'assistant', 'mine');
    expect(a.lessons.get(oldest.id)).toBeNull(); expect(a.lessons.get(other.id)).toEqual(other);
    expect(a.extensions.get(firstExtension.id)).toBeNull();
    expect(db.prepare('SELECT kind, COUNT(*) AS n FROM assistant_drafts WHERE project_id = ? GROUP BY kind').all('mine'))
      .toEqual([{ kind: 'extension', n: 12 }, { kind: 'lesson', n: 20 }]);
  });

  it('keeps an existing draft when the database refuses a new write', () => {
    const db = database(); const a = stores(db); const original = a.lessons.add(sampleDoc(), 'lesson');
    db.exec("CREATE TRIGGER refuse_draft BEFORE INSERT ON assistant_drafts BEGIN SELECT RAISE(ABORT, 'disk write refused'); END;");
    expect(() => a.lessons.add(sampleDoc(), 'lesson')).toThrow('disk write refused');
    expect(stores(db).lessons.get(original.id)).toEqual(original);
  });

  it('refuses an exact held secret even if it does not look like an API key', () => {
    const db = database(); const drafts = new ExtensionDrafts(); drafts.attach(db, () => true, (text) => text.includes('private-test-value'));
    expect(() => drafts.add({ ...proposal, purpose: 'private-test-value' })).toThrow('Remove credentials');
    expect(db.prepare('SELECT COUNT(*) AS n FROM assistant_drafts').get()).toEqual({ n: 0 });
  });

  it('rejects corrupt documents and recreates a ZIP from validated source paths', () => {
    const db = database(); const a = stores(db); const lesson = a.lessons.add(sampleDoc(), 'lesson'); const extension = a.extensions.add(proposal);
    db.prepare('UPDATE assistant_drafts SET payload = ? WHERE id = ?').run('{broken', lesson.id);
    db.prepare('UPDATE assistant_drafts SET payload = ? WHERE id = ?').run(JSON.stringify({ ...extension, archiveBase64: 'untrusted' }), extension.id);
    expect(a.lessons.get(lesson.id)).toBeNull(); expect(a.extensions.get(extension.id)?.archiveBase64).toBe(extension.archiveBase64);
    db.prepare('UPDATE assistant_drafts SET payload = ? WHERE id = ?').run(JSON.stringify({ ...extension, files: [{ path: '../escape.py', content: 'NODE_CLASS_MAPPINGS = {}' }, proposal.files[1]] }), extension.id);
    expect(a.extensions.get(extension.id)).toBeNull();
  });

  it('clears pending work in the live file and owned backup, while preserving another project', () => {
    const file = diskFile(); const db = database(file); const a = stores(db);
    const own = a.lessons.add(sampleDoc(), 'lesson', 1, 'mine'); const ext = a.extensions.add(proposal, 'assistant', 'mine');
    const other = a.lessons.add(sampleDoc(), 'lesson', 2, 'other');
    db.close(); fs.copyFileSync(file, `${file}.before-v21.bak`);
    const reopened = database(file);
    expect(clearChatHistory(reopened, 'mine')).toEqual({ ok: true, removed: 0 });
    for (const candidate of [reopened, database(`${file}.before-v21.bak`)]) {
      const b = stores(candidate); expect(b.lessons.get(own.id)).toBeNull(); expect(b.extensions.get(ext.id)).toBeNull();
      expect(b.lessons.get(other.id)).toEqual(other);
    }
  });

  it('upgrades version20 atomically and can retry after a failed migration', () => {
    const db = new Database(':memory:'); databases.push(db); migrate(db, { upTo: 20 });
    expect(() => migrate(db, { failBeforeVersionStamp: true })).toThrow();
    expect(schemaVersion(db)).toBe(20);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'assistant_drafts'").get()).toBeUndefined();
    migrate(db); expect(schemaVersion(db)).toBe(SCHEMA_VERSION); expect(stores(db).lessons.add(sampleDoc(), 'lesson').persistent).toBe(true);
  });
});
