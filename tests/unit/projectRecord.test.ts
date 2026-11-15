/**
 * The db:save-project IPC handler (saveProjectRecord in src/main/ipc/projectRecord): a valid record is stored with
 * its JSON columns, and any other shape, including a cyclic graph, is refused with one fixed message.
 * Why: the renderer is not trusted to send a well-formed record, and a bad one must not corrupt the project table.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { PROJECT_RECORD_ERROR, saveProjectRecord } from '../../src/main/ipc/projectRecord';

describe('db:save-project', () => {
  it('stores a valid record and refuses other shapes with one fixed message', () => {
    const db = new Database(':memory:');
    migrate(db);
    const valid = { id: 'p1', name: 'Project', created_at: 1, updated_at: 2, graph_data: { nodes: [] }, metadata: { a: 1 } };
    expect(saveProjectRecord(db, valid)).toEqual({ success: true });
    expect(db.prepare('SELECT graph_data, metadata FROM projects WHERE id = ?').get('p1')).toEqual({ graph_data: '{"nodes":[]}', metadata: '{"a":1}' });
    for (const bad of [
      null, 'x', {}, { ...valid, id: '' }, { ...valid, id: 5 }, { ...valid, created_at: '2020' }, { ...valid, updated_at: -1 },
      { ...valid, name: 'x'.repeat(501) }, { ...valid, extra: true }, { ...valid, metadata: [1] },
    ]) {
      expect(saveProjectRecord(db, bad)).toEqual({ success: false, error: PROJECT_RECORD_ERROR });
    }
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(saveProjectRecord(db, { ...valid, graph_data: cyclic })).toEqual({ success: false, error: PROJECT_RECORD_ERROR });
    db.close();
  });
});
