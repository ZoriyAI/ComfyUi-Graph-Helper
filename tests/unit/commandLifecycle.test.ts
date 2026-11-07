import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { acceptsProjection } from '../../src/shared/commands/reconcile';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import {
  cancelRun,
  commitCommand,
  ensureProject,
  ensureWorkspace,
  pauseRun,
  readProjection,
  resumeRun,
  startRun,
  switchProject,
} from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function nodesOf(db: Database.Database, projectId = DESKTOP_PROJECT_ID): Array<Record<string, any>> {
  const projection = readProjection(db, projectId);
  return (projection?.snapshot.nodes ?? []) as Array<Record<string, any>>;
}

function ai(db: Database.Database, runId: string, expected: string, actionId: string, payload: Record<string, unknown>, projectId = DESKTOP_PROJECT_ID) {
  return commitCommand(db, {
    projectId,
    runId,
    actionId,
    expectedRevisionId: expected,
    actor: 'ai',
    payload,
  });
}

function manual(db: Database.Database, expected: string, actionId: string, payload: Record<string, unknown>, projectId = DESKTOP_PROJECT_ID, runId: string | null = null) {
  return commitCommand(db, {
    projectId,
    runId,
    actionId,
    expectedRevisionId: expected,
    actor: 'manual',
    payload,
  });
}

describe('command lifecycle', () => {
  it('applies two AI tools in one run and advances only that expected revision', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    expect(started.baseRevisionId).toBe(started.expectedRevisionId);
    const add = ai(db, started.runId, started.expectedRevisionId, 'add-1', {
      type: 'add-node',
      nodeType: 'TestNode',
      title: 'AI Test Node',
      x: 200,
      y: 200,
    });
    expect(add.status).toBe('applied');
    const nodeId = (add.result as { nodeId: string }).nodeId;
    const annotate = ai(db, started.runId, add.projection!.activeRun!.expectedRevisionId, 'note-1', {
      type: 'annotate-node',
      nodeId,
      annotation: 'AI added annotation',
    });
    expect(annotate.status).toBe('applied');
    const nodes = nodesOf(db);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.annotations).toEqual(['AI added annotation']);
    expect(db.prepare('SELECT COUNT(*) AS count FROM graph_revisions WHERE project_id = ?').get(DESKTOP_PROJECT_ID)).toEqual({ count: 3 });
    db.close();
  });

  it('conflicts when a manual edit happens before the first AI tool', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const edited = manual(db, started.expectedRevisionId, 'manual-1', {
      type: 'add-node',
      nodeType: 'HumanNode',
      title: 'Human',
    });
    expect(edited.status).toBe('applied');
    const blocked = ai(db, started.runId, started.expectedRevisionId, 'add-1', {
      type: 'add-node',
      nodeType: 'TestNode',
    });
    expect(blocked.status).toBe('conflict');
    expect(nodesOf(db).map((node) => node.data.comfyType)).toEqual(['HumanNode']);
    const expected = db.prepare('SELECT expected_revision_id FROM runs WHERE run_id = ?').get(started.runId) as { expected_revision_id: string };
    expect(expected.expected_revision_id).toBe(started.expectedRevisionId);
    db.close();
  });

  it('conflicts when AI sends the fresh current revision after a manual edit', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const edited = manual(db, started.expectedRevisionId, 'manual-1', { type: 'add-node', nodeType: 'HumanNode' });
    const blocked = ai(db, started.runId, edited.projection!.currentRevisionId, 'add-1', {
      type: 'add-node',
      nodeType: 'TestNode',
    });
    expect(blocked.status).toBe('conflict');
    expect(nodesOf(db)).toHaveLength(1);
    const expected = db.prepare('SELECT expected_revision_id FROM runs WHERE run_id = ?').get(started.runId) as { expected_revision_id: string };
    expect(expected.expected_revision_id).toBe(started.expectedRevisionId);
    expect(edited.projection!.currentRevisionId).not.toBe(started.expectedRevisionId);
    db.close();
  });

  it('keeps the manual edit between two tools and conflicts the second tool', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const add = ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    const nodeId = (add.result as { nodeId: string }).nodeId;
    const edited = manual(db, add.projection!.currentRevisionId, 'manual-1', {
      type: 'annotate-node',
      nodeId,
      annotation: 'human note',
    });
    expect(edited.status).toBe('applied');
    const annotate = ai(db, started.runId, add.projection!.activeRun!.expectedRevisionId, 'note-1', {
      type: 'annotate-node',
      nodeId,
      annotation: 'AI added annotation',
    });
    expect(annotate.status).toBe('conflict');
    expect(nodesOf(db)[0].data.annotations).toEqual(['human note']);
    db.close();
  });

  it('closes the left project on switch and does not resurrect it', () => {
    const db = openDb();
    ensureProject(db, 'other', 'Other');
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const current = started.expectedRevisionId;
    switchProject(db, DESKTOP_PROJECT_ID);
    const blocked = ai(db, started.runId, current, 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    expect(blocked.status).toBe('conflict');
    expect(db.prepare('SELECT status FROM runs WHERE run_id = ?').get(started.runId)).toEqual({ status: 'closed' });
    switchProject(db, 'other');
    expect(db.prepare('SELECT status FROM runs WHERE run_id = ?').get(started.runId)).toEqual({ status: 'closed' });
    const again = ai(db, started.runId, current, 'add-2', { type: 'add-node', nodeType: 'TestNode' });
    expect(again.status).toBe('conflict');
    expect(nodesOf(db)).toHaveLength(0);
    db.close();
  });

  it('replays the same payload as historical without a new revision, including after cancel', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const first = ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    cancelRun(db, DESKTOP_PROJECT_ID, started.runId);
    const before = db.prepare('SELECT COUNT(*) AS count FROM graph_revisions').get();
    const replay = ai(db, started.runId, 'stale-expected', 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    expect(replay.status).toBe('historical');
    expect(replay.result).toEqual(first.result);
    expect(db.prepare('SELECT COUNT(*) AS count FROM graph_revisions').get()).toEqual(before);
    expect(replay.projection!.currentRevisionId).toBe(first.projection!.currentRevisionId);
    db.close();
  });

  it('rejects the same action id when the payload or run differs and does not return the old result', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode', title: 'One' });
    const other = ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode', title: 'Two' });
    expect(other.status).toBe('rejected');
    expect(other.result).toBeNull();
    const second = startRun(db, DESKTOP_PROJECT_ID);
    const wrongRun = ai(db, second.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode', title: 'One' });
    expect(wrongRun.status).toBe('rejected');
    expect(nodesOf(db)).toHaveLength(1);
    db.close();
  });

  it('allows the same action id in two projects', () => {
    const db = openDb();
    ensureProject(db, 'other', 'Other');
    const first = startRun(db, DESKTOP_PROJECT_ID);
    const second = startRun(db, 'other');
    expect(ai(db, first.runId, first.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' }).status).toBe('applied');
    expect(ai(db, second.runId, second.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'OtherNode' }, 'other').status).toBe('applied');
    expect(db.prepare('SELECT COUNT(*) AS count FROM applied_commands').get()).toEqual({ count: 2 });
    db.close();
  });

  it('rolls back a commit that fails before it finishes', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const before = db.prepare('SELECT COUNT(*) AS count FROM graph_revisions').get();
    expect(() =>
      commitCommand(
        db,
        {
          projectId: DESKTOP_PROJECT_ID,
          runId: started.runId,
          actionId: 'add-1',
          expectedRevisionId: started.expectedRevisionId,
          actor: 'ai',
          payload: { type: 'add-node', nodeType: 'TestNode' },
        },
        { failBeforeCommit: true },
      ),
    ).toThrow(/before it finishes|before stamp/);
    expect(db.prepare('SELECT COUNT(*) AS count FROM graph_revisions').get()).toEqual(before);
    expect(db.prepare('SELECT COUNT(*) AS count FROM applied_commands').get()).toEqual({ count: 0 });
    expect(nodesOf(db)).toHaveLength(0);
    db.close();
  });

  it('treats a lost response retry as historical and keeps one revision', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const first = ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    const retry = ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    expect(first.status).toBe('applied');
    expect(retry.status).toBe('historical');
    expect(db.prepare('SELECT COUNT(*) AS count FROM graph_revisions WHERE source = ?').get('ai')).toEqual({ count: 1 });
    expect(retry.projection!.revSeq).toBe(first.projection!.revSeq);
    db.close();
  });

  it('rejects a new commit after pause, in either order with an in-flight commit', () => {
    const db = openDb();
    const pausedFirst = startRun(db, DESKTOP_PROJECT_ID);
    expect(pauseRun(db, DESKTOP_PROJECT_ID, pausedFirst.runId).status).toBe('applied');
    expect(ai(db, pausedFirst.runId, pausedFirst.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' }).status).toBe('conflict');

    const committedFirst = startRun(db, DESKTOP_PROJECT_ID);
    const add = ai(db, committedFirst.runId, committedFirst.expectedRevisionId, 'add-2', { type: 'add-node', nodeType: 'Kept' });
    expect(add.status).toBe('applied');
    expect(pauseRun(db, DESKTOP_PROJECT_ID, committedFirst.runId).status).toBe('applied');
    expect(
      ai(db, committedFirst.runId, add.projection!.activeRun!.expectedRevisionId, 'add-3', { type: 'add-node', nodeType: 'Late' }).status,
    ).toBe('conflict');
    expect(nodesOf(db).map((node) => node.data.comfyType)).toEqual(['Kept']);
    db.close();
  });

  it('starts and resumes a new snapshot run without returning an old run to running', () => {
    const db = openDb();
    const first = startRun(db, DESKTOP_PROJECT_ID);
    pauseRun(db, DESKTOP_PROJECT_ID, first.runId);
    const resumed = resumeRun(db, DESKTOP_PROJECT_ID);
    expect(resumed.runId).not.toBe(first.runId);
    expect(resumed.baseRevisionId).toBe(resumed.expectedRevisionId);
    expect(resumed.baseRevisionId).toBe(readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId);
    expect(pauseRun(db, DESKTOP_PROJECT_ID, first.runId).status).toBe('applied');
    expect(db.prepare('SELECT status FROM runs WHERE run_id = ?').get(first.runId)).toEqual({ status: 'paused' });
    expect(db.prepare('SELECT status FROM runs WHERE run_id = ?').get(resumed.runId)).toEqual({ status: 'running' });
    db.close();
  });

  it('lets manual commit without an AI run and does not move another run expected', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const edited = manual(db, started.expectedRevisionId, 'manual-1', { type: 'add-node', nodeType: 'HumanNode' });
    expect(edited.status).toBe('applied');
    expect(db.prepare('SELECT expected_revision_id FROM runs WHERE run_id = ?').get(started.runId)).toEqual({
      expected_revision_id: started.expectedRevisionId,
    });
    const disguised = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      runId: started.runId,
      actionId: 'manual-2',
      expectedRevisionId: edited.projection!.currentRevisionId,
      actor: 'manual',
      payload: { type: 'add-node', nodeType: 'Nope' },
    });
    expect(disguised.status).toBe('rejected');
    expect(db.prepare('SELECT expected_revision_id FROM runs WHERE run_id = ?').get(started.runId)).toEqual({
      expected_revision_id: started.expectedRevisionId,
    });
    db.close();
  });

  it('rejects a command whose run belongs to another project', () => {
    const db = openDb();
    ensureProject(db, 'other', 'Other');
    const started = startRun(db, 'other');
    const blocked = ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    expect(blocked.status).toBe('rejected');
    expect(nodesOf(db)).toHaveLength(0);
    db.close();
  });

  it('reconciles a lost response to the current snapshot and drops an older or foreign one', () => {
    const db = openDb();
    const started = startRun(db, DESKTOP_PROJECT_ID);
    const add = ai(db, started.runId, started.expectedRevisionId, 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    const current = readProjection(db, DESKTOP_PROJECT_ID)!;
    expect(current.revSeq).toBe(add.projection!.revSeq);
    expect(current.activeRun!.status).toBe('running');
    expect(current.activeRun!.expectedRevisionId).toBe(current.currentRevisionId);
    expect(acceptsProjection({ projectId: DESKTOP_PROJECT_ID, revSeq: 1 }, current)).toBe(true);
    expect(acceptsProjection(current, { projectId: DESKTOP_PROJECT_ID, revSeq: current.revSeq - 1 })).toBe(false);
    expect(acceptsProjection(current, { projectId: 'other', revSeq: current.revSeq + 1 })).toBe(false);
    const historical = ai(db, started.runId, 'ignored', 'add-1', { type: 'add-node', nodeType: 'TestNode' });
    expect(historical.status).toBe('historical');
    expect(historical.projection!.currentRevisionId).toBe(current.currentRevisionId);
    expect(historical.projection!.currentRevisionId).not.toBe('rev-desktop-1');
    db.close();
  });
});
