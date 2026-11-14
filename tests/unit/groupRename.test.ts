import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, listRecentCommands, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { describeCommand } from '../../src/shared/agent/recentActions';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { describeRevision } from '../../src/renderer/state/undoState';
import { typedWorkflow } from '../e2e/fixtures/typedWorkflow';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

const head = (db: Database.Database) => readProjection(db, P)!;
const snap = (db: Database.Database) => head(db).snapshot as GraphSnapshot;
const commit = (db: Database.Database, actionId: string, payload: Record<string, unknown>) => commitCommand(db, {
  projectId: P, actionId, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload,
});

function exported(db: Database.Database): Record<string, any> {
  const result = exportWorkflow(snap(db), '2026-11-10T00:00:00.000Z');
  if (!result.ok) throw new Error(result.error);
  return result.workflow as Record<string, any>;
}

describe('rename-group', () => {
  it('renames a group in a new revision, keeps members and colour, and undo brings the old title back', () => {
    const db = openDb();
    commit(db, 'import', { type: 'import-workflow', document: structuredClone(typedWorkflow) });
    commit(db, 'grp', { type: 'add-group', title: 'Text', nodeIds: ['2', '3'], color: '#335' });
    const before = head(db);
    const renamed = commit(db, 'ren', { type: 'rename-group', groupId: '1', title: '  Prompts  ' });
    expect(renamed.status).toBe('applied');
    expect(renamed.result).toEqual({ groupId: '1', title: 'Prompts', previous: 'Text' });
    expect(renamed.projection!.revSeq).toBe(before.revSeq + 1);
    expect(snap(db).groups![0]).toMatchObject({ id: '1', title: 'Prompts', nodeIds: ['2', '3'], color: '#335' });
    expect(exported(db).groups[0]).toMatchObject({ id: 1, title: 'Prompts', color: '#335' });

    const recent = listRecentCommands(db, P);
    expect(describeCommand(recent.at(-1)!, null)).toBe('renamed group 1 to "Prompts"');
    expect(describeRevision({ payload: { type: 'rename-group' } } as never).key).toBe('undo.renameGroup');

    commit(db, 'undo', { type: 'restore-revision', revisionId: before.currentRevisionId });
    expect(snap(db).groups![0].title).toBe('Text');
    db.close();
  });

  it('refuses an unknown group and a title over the limit', () => {
    const db = openDb();
    commit(db, 'import', { type: 'import-workflow', document: structuredClone(typedWorkflow) });
    expect(commit(db, 'ren-x', { type: 'rename-group', groupId: 'nope', title: 'x' })).toMatchObject({ status: 'rejected', result: { error: 'Group was not found.' } });
    commit(db, 'grp', { type: 'add-group', title: 'Text', nodeIds: ['2'] });
    expect(commit(db, 'ren-long', { type: 'rename-group', groupId: '1', title: 'x'.repeat(501) }).status).toBe('rejected');
    expect(snap(db).groups![0].title).toBe('Text');
    db.close();
  });

  it('keeps the new title through export and a fresh import', () => {
    const db = openDb();
    commit(db, 'import', { type: 'import-workflow', document: structuredClone(typedWorkflow) });
    commit(db, 'grp', { type: 'add-group', title: 'Text', nodeIds: ['2', '3'] });
    commit(db, 'ren', { type: 'rename-group', groupId: '1', title: 'Подсказки' });
    const workflow = exported(db);

    const other = openDb();
    expect(commit(other, 'import', { type: 'import-workflow', document: structuredClone(workflow) }).status).toBe('applied');
    const groups = snap(other).groups!;
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Подсказки');
    expect(new Set(groups[0].nodeIds)).toEqual(new Set(['2', '3']));
    expect(exported(other).groups[0].title).toBe('Подсказки');
    db.close();
    other.close();
  });
});
