import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureWorkspace, ensureProject, listRevisions, readProjection, startRun } from '../../src/main/commands/commit';
import { historyUsage, trimHistoryExplicitly } from '../../src/main/commands/historyUsage';
import { migrate } from '../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';

const databases: Database.Database[] = [];
function fresh(count = 260) {
  const db = new Database(':memory:'); databases.push(db); migrate(db); ensureWorkspace(db);
  const original = db.prepare('SELECT * FROM graph_revisions WHERE project_id = ?').get(P) as Record<string, unknown>;
  const insert = db.prepare(`INSERT INTO graph_revisions (id, project_id, timestamp, nodes, edges, description, source, rev_seq, document, components, process_meta)
    VALUES (?, ?, ?, ?, ?, 'move-node', 'user', ?, ?, ?, ?)`);
  db.transaction(() => {
    for (let index = 2; index <= count; index++) insert.run(`test-${index}`, P, index * 1000, original.nodes, original.edges, index, original.document, original.components, original.process_meta);
    db.prepare('UPDATE projects SET current_revision_id = ? WHERE id = ?').run(`test-${count}`, P);
  })();
  return db;
}
afterEach(() => { vi.useRealTimers(); for (const db of databases.splice(0)) db.close(); });

describe('measured and reviewed history cleanup', () => {
  it('counts UTF-8 stored data, available range and command bytes without claiming filesystem shrinkage', async () => {
    const db = fresh();
    const before = historyUsage(db, P);
    db.prepare('UPDATE graph_revisions SET nodes = ? WHERE id = ?').run(JSON.stringify('Привет'), 'test-2');
    db.prepare(`INSERT INTO applied_commands VALUES (?, 'command', NULL, 'manual', ?, ?, 'test-2')`).run(P, '{"text":"Привет"}', '{"ok":true}');
    const usage = historyUsage(db, P);
    expect(usage.snapshotBytes - before.snapshotBytes).toBe(Buffer.byteLength(JSON.stringify('Привет')) - 2);
    expect(usage.commandBytes).toBe(Buffer.byteLength('{"text":"Привет"}{"ok":true}'));
    expect(usage.availableRevisions).toBe(260); expect(usage.newestAt).toBe(260000);
    expect(usage.trim.count).toBe(60); expect(usage.trim.remaining).toBe(200);
    expect(usage.databaseBytes).toBeGreaterThan(usage.snapshotBytes);
    const result = await trimHistoryExplicitly(db, P, usage.trim.token);
    expect(result).toMatchObject({ ok: true, removed: 60, releasedBytes: usage.trim.bytes });
    expect(result.usage.snapshotBytes + result.usage.commandBytes).toBe(usage.snapshotBytes + usage.commandBytes - usage.trim.bytes);
    expect(result.usage.oldestAvailableAt).toBe(61000);
    expect(listRevisions(db, P)).toHaveLength(200);
  });

  it('protects the visible graph, runs, proposals and paused chat tasks, leaving other projects intact', async () => {
    const db = fresh(); ensureProject(db, 'other', 'Other');
    db.prepare('UPDATE projects SET current_revision_id = ? WHERE id = ?').run('test-2', P);
    const run = startRun(db, P);
    db.prepare('UPDATE runs SET expected_revision_id = ? WHERE run_id = ?').run('test-3', run.runId);
    db.prepare(`INSERT INTO proposals (id, project_id, kind, status, payload, note, revision_id, created_at) VALUES ('p', ?, 'add-node', 'open', '{}', '', 'test-4', 1)`).run(P);
    const chat = db.prepare(`INSERT INTO chat_messages (id,project_id,role,content,timestamp,checkpoint) VALUES (?,?,'assistant','',1,?)`);
    chat.run('paused', P, JSON.stringify({ state: 'open', revisionId: 'test-5' }));
    chat.run('closed', P, JSON.stringify({ state: 'closed', revisionId: 'test-6' }));
    chat.run('invalid', P, '{');
    const before = readProjection(db, P); const other = historyUsage(db, 'other');
    const usage = historyUsage(db, P);
    expect(usage.protectedRevisions).toBe(4); expect(usage.trim.count).toBe(56);
    const result = await trimHistoryExplicitly(db, P, usage.trim.token);
    expect(result.ok).toBe(true); expect(result.usage.revisions).toBe(204);
    expect(readProjection(db, P)).toEqual(before); expect(historyUsage(db, 'other')).toEqual(other);
    expect(db.prepare('SELECT COUNT(*) AS n FROM chat_messages').get()).toEqual({ n: 3 });
    for (const id of ['test-2','test-3','test-4','test-5']) expect(db.prepare('SELECT 1 FROM graph_revisions WHERE id = ?').get(id)).toBeDefined();
    expect(db.prepare('SELECT 1 FROM graph_revisions WHERE id = ?').get('test-6')).toBeUndefined();
  });

  it('refuses an outdated preview before removing anything', async () => {
    const db = fresh(); const usage = historyUsage(db, P);
    db.prepare('UPDATE projects SET current_revision_id = ? WHERE id = ?').run('test-2', P);
    expect(await trimHistoryExplicitly(db, P, usage.trim.token)).toMatchObject({ ok: false, reason: 'changed', removed: 0 });
    expect(historyUsage(db, P).revisions).toBe(260);
  });

  it('stops between batches if newly protected work appears', async () => {
    vi.useFakeTimers(); const db = fresh(650); const usage = historyUsage(db, P);
    const trimming = trimHistoryExplicitly(db, P, usage.trim.token);
    expect(historyUsage(db, P).revisions).toBe(450);
    db.prepare(`INSERT INTO chat_messages (id,project_id,role,content,timestamp,checkpoint) VALUES ('new',?,'assistant','',1,?)`).run(P, JSON.stringify({ state: 'open', revisionId: 'test-5' }));
    await vi.runAllTimersAsync();
    expect(await trimming).toMatchObject({ ok: false, reason: 'changed', removed: 200 });
    expect(db.prepare('SELECT 1 FROM graph_revisions WHERE id = ?').get('test-5')).toBeDefined();
  });

  it('rolls back a failed batch and restores the secure-delete setting', async () => {
    const db = fresh(); db.pragma('secure_delete = ON'); const usage = historyUsage(db, P);
    db.exec("CREATE TRIGGER refuse_history_delete BEFORE DELETE ON graph_revisions WHEN OLD.id = 'test-2' BEGIN SELECT RAISE(ABORT, 'write failed'); END");
    expect(await trimHistoryExplicitly(db, P, usage.trim.token)).toMatchObject({ ok: false, reason: 'storage', removed: 0 });
    expect(historyUsage(db, P).revisions).toBe(260); expect(db.pragma('secure_delete', { simple: true })).toBe(1);
  });
});
