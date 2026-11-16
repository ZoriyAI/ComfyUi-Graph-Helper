/** Checks credential and chat cleanup in owned recovery copies while preserving graph data. */
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { migrate } from '../../src/main/settings/migrate';
import { forgetEverySecret, secretInventory } from '../../src/main/settings/forgetAll';
import { forgetProviderKey } from '../../src/main/settings/repository';
import { clearChatHistory } from '../../src/main/agent/chatHistory';

const dirs: string[] = [];
const connections: Database.Database[] = [];
afterEach(() => { for (const db of connections.splice(0)) if (db.open) db.close(); for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-copy-')); dirs.push(folder);
  const file = path.join(folder, 'app.db');
  const db = new Database(file); connections.push(db); migrate(db);
  db.exec("INSERT INTO projects (id,name,created_at,updated_at) VALUES ('p','kept graph',1,1), ('q','other graph',1,1)");
  db.exec("INSERT INTO chat_messages (id,project_id,role,content,timestamp) VALUES ('m','p','user','private conversation',1), ('n','q','user','other conversation',1)");
  db.prepare('INSERT INTO secret_records VALUES (?, ?)').run('provider-key:openai', Buffer.from('FAKE-copy-ciphertext-marker'));
  db.prepare('INSERT INTO secret_records VALUES (?, ?)').run('provider-key:google', Buffer.from('FAKE-other-key'));
  const backup = `${file}.before-v18.bak`; fs.copyFileSync(file, backup);
  const deps = { db, userData: folder, forgetKeys: () => {}, forgetMcpToken: () => {}, forgetSignIns: () => {} };
  const inventory = () => secretInventory({ db, userData: folder, heldProviders: () => [], heldTokenOrigin: () => null, heldSignIns: () => [] });
  return { file, db, backup, deps, inventory };
}
function read(file: string) { const db = new Database(file, { readonly: true }); connections.push(db); return db; }

describe('privacy in app recovery copies', () => {
  it('forgets keys from old and unfinished copies without changing graphs, chat or unrelated files', () => {
    const f = fixture();
    const partial = `${f.file}.before-v19.bak.part`; fs.copyFileSync(f.file, partial);
    const unrelated = `${f.file}.before-v18.bak.user`; fs.copyFileSync(f.file, unrelated);
    expect(f.inventory().files).toBe(2);
    expect(forgetEverySecret(f.deps).failed).toEqual([]);
    for (const copy of [f.backup, partial]) {
      expect(read(copy).prepare('SELECT * FROM secret_records').all()).toEqual([]);
      expect(read(copy).prepare('SELECT * FROM projects').all()).toHaveLength(2);
      expect(read(copy).prepare('SELECT * FROM chat_messages').all()).toHaveLength(2);
      expect(fs.readFileSync(copy).includes(Buffer.from('FAKE-copy-ciphertext-marker'))).toBe(false);
    }
    expect(read(unrelated).prepare('SELECT * FROM secret_records').all()).toHaveLength(2);
    expect(f.inventory()).toEqual({ providers: [], serverTokens: 0, signIns: 0 });
  });
  it('reports damaged copies and refuses links while clearing accessible copies', () => {
    const f = fixture();
    const damaged = `${f.file}.damaged-20261117-010000`; fs.writeFileSync(damaged, 'damaged graph kept for recovery');
    const unrelated = `${f.file}.user`; fs.copyFileSync(f.file, unrelated);
    fs.symlinkSync(unrelated, `${f.file}.before-v17.bak`);
    expect(f.inventory().unverified).toBe(2);
    expect(forgetEverySecret(f.deps).failed).toContain('backup-databases');
    expect(read(f.backup).prepare('SELECT * FROM secret_records').all()).toEqual([]);
    expect(read(unrelated).prepare('SELECT * FROM secret_records').all()).toHaveLength(2);
    expect(fs.readFileSync(damaged, 'utf8')).toBe('damaged graph kept for recovery');
    expect(f.inventory().unverified).toBe(2);
  });
  it('forgets only the selected provider in current and backup databases', () => {
    const f = fixture(); forgetProviderKey(f.db, 'openai');
    for (const db of [f.db, read(f.backup)]) expect(db.prepare('SELECT name FROM secret_records').all()).toEqual([{ name: 'provider-key:google' }]);
  });
  it('clears only the requested project chat in recovery copies, preserving both graphs', () => {
    const f = fixture(); expect(clearChatHistory(f.db, 'p')).toEqual({ ok: true, removed: 1 });
    for (const db of [f.db, read(f.backup)]) {
      expect(db.prepare('SELECT id FROM chat_messages').all()).toEqual([{ id: 'n' }]);
      expect(db.prepare('SELECT * FROM projects').all()).toHaveLength(2);
      expect(db.prepare('SELECT * FROM secret_records').all()).toHaveLength(2);
    }
    fs.writeFileSync(`${f.file}.damaged-20261117-010000`, 'preserve');
    expect(clearChatHistory(f.db, 'p').ok).toBe(false);
  });
});
