/**
 * Checks reading project rows (db:load-project and db:list-projects): a row whose stored JSON is damaged is left out
 * of the list (logged by id, never by content) and loading it gives one plain translated sentence, so one broken
 * row no longer makes the whole call throw.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { listProjectRecords, loadProjectRecord } from '../../src/main/ipc/projectRecord';
import { createTranslator } from '../../src/shared/i18n';

/** A database with one good and one damaged project row. */
function withRows(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  const insert = db.prepare('INSERT INTO projects (id, name, created_at, updated_at, graph_data, metadata) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run('good', 'Good', 1, 2, '{"nodes":[]}', '{}');
  insert.run('broken', 'Broken', 1, 3, '{"nodes":[secret-graph', '{}');
  return db;
}

describe('reading project rows', () => {
  it('lists the readable rows and logs a damaged one by id only', () => {
    const db = withRows();
    const lines: string[] = [];
    const list = listProjectRecords(db, (line) => lines.push(line));
    expect(list.map((row) => row.id)).toEqual(['good']);
    expect(list[0].graph_data).toEqual({ nodes: [] });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('broken');
    expect(lines[0]).not.toContain('secret-graph');
    db.close();
  });

  it('loads a good row, null for none, and a translated sentence for a damaged one', () => {
    const db = withRows();
    const en = createTranslator('en');
    expect(loadProjectRecord(db, 'good', en)).toMatchObject({ id: 'good', metadata: {} });
    expect(loadProjectRecord(db, 'none', en)).toBeNull();
    expect(loadProjectRecord(db, 'broken', en)).toEqual({ error: en('errors.projectRecordBroken') });
    expect(loadProjectRecord(db, 'broken', createTranslator('ru'))).toEqual({ error: createTranslator('ru')('errors.projectRecordBroken') });
    expect(en('errors.projectRecordBroken')).not.toBe('errors.projectRecordBroken');
    db.close();
  });
});
