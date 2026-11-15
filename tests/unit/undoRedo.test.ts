import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, listRecentCommands, listRevisions, readProjection, startRun, closeRun } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { createProposal, listProposals } from '../../src/main/proposals/repository';
import { describeCommand } from '../../src/shared/agent/recentActions';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import type { Proposal } from '../../src/shared/contracts/proposals';
import { nextNodeId } from '../../src/shared/workflow/codec';
import {
  afterRedo,
  afterUndo,
  describeRevision,
  EMPTY_SESSION,
  logicalRevision,
  planUndo,
  type UndoRevision,
  type UndoSession,
} from '../../src/renderer/state/undoState';

type Rec = Record<string, any>;

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

const head = (db: Database.Database) => readProjection(db, P)!;
const commit = (db: Database.Database, actionId: string, payload: Rec) => commitCommand(db, {
  projectId: P, actionId, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload,
});

describe('engine: restore-revision', () => {
  it('copies an earlier revision into a new one: the snapshot round-trips and history only grows', () => {
    const db = openDb();
    commit(db, 'a', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' });
    commit(db, 'b', { type: 'add-node', nodeType: 'KSampler' });
    commit(db, 'c', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' });
    commit(db, 'p', { type: 'set-process', title: 'Txt2img', notes: 'n' });
    const before = head(db);
    commit(db, 'g', { type: 'add-group', title: 'G', nodeIds: ['1', '2'] });
    commit(db, 'r', { type: 'remove-edge', edgeId: (before.snapshot.edges as Rec[])[0].id });
    const restored = commit(db, 'undo', { type: 'restore-revision', revisionId: before.currentRevisionId });
    expect(restored.status).toBe('applied');
    expect(restored.result).toEqual({ revisionId: before.currentRevisionId, restoredRevSeq: before.revSeq });
    expect(restored.projection!.revSeq).toBe(before.revSeq + 3);
    expect(restored.projection!.snapshot).toEqual(before.snapshot);
    const list = listRevisions(db, P);
    expect(list.at(-1)).toMatchObject({ description: 'restore-revision', source: 'user', actor: 'manual', restoredRevisionId: before.currentRevisionId });
    const recent = listRecentCommands(db, P);
    expect(describeCommand(recent.at(-1)!, null)).toBe(`restored revision ${before.revSeq}`);
    db.close();
  });

  it('preserves an interleaved manual title through AI undo and redo snapshots', () => {
    const db = openDb();
    commit(db, 'loader', { type: 'add-node', nodeType: 'KSampler' });
    const { runId } = startRun(db, P);
    const ai = (actionId: string, value: number) => commitCommand(db, {
      projectId: P, actionId, expectedRevisionId: head(db).currentRevisionId, actor: 'ai', runId,
      payload: { type: 'move-node', nodeId: '1', x: value, y: 0 },
    });
    expect(ai('ai-first', 10).status).toBe('applied');
    commit(db, 'manual-title', { type: 'rename-node', nodeId: '1', title: 'My manual title' });
    const manualHead = head(db).currentRevisionId;
    expect(ai('ai-second', 20).status).toBe('applied');
    expect(ai('ai-third', 30).status).toBe('applied');
    closeRun(db, P, runId);
    const previousHead = head(db).currentRevisionId;
    const plan = planUndo(listRevisions(db, P), previousHead, EMPTY_SESSION, { running: false });
    expect(plan.undo?.target).toBe(manualHead);
    commit(db, 'undo-ai', { type: 'restore-revision', revisionId: plan.undo!.target });
    const node = () => (head(db).snapshot.nodes as Rec[])[0];
    expect(node()).toMatchObject({ position: { x: 10, y: 0 }, data: { title: 'My manual title' } });
    const session = afterUndo(EMPTY_SESSION, previousHead, plan.pointer!, head(db).currentRevisionId);
    const redo = planUndo(listRevisions(db, P), head(db).currentRevisionId, session, { running: false });
    commit(db, 'redo-ai', { type: 'restore-revision', revisionId: redo.redo!.target });
    expect(node()).toMatchObject({ position: { x: 30, y: 0 }, data: { title: 'My manual title' } });
    db.close();
  });

  it('rejects an unknown revision id and leaves the head alone', () => {
    const db = openDb();
    commit(db, 'a', { type: 'add-node', nodeType: 'KSampler' });
    const was = head(db);
    const result = commit(db, 'undo', { type: 'restore-revision', revisionId: 'rev-nowhere-9' });
    expect(result.status).toBe('rejected');
    expect(result.result).toEqual({ error: 'Revision was not found.' });
    expect(head(db).currentRevisionId).toBe(was.currentRevisionId);
    db.close();
  });

  it('supersedes open proposals whose nodes the restore removes', () => {
    const db = openDb();
    const empty = head(db).currentRevisionId;
    commit(db, 'a', { type: 'add-node', nodeType: 'KSampler' });
    const proposal = createProposal(db, {
      projectId: P, runId: null, kind: 'set-parameter' as Proposal['kind'], payload: { type: 'set-parameter', nodeId: '1', key: 'seed', value: 5 } as Proposal['payload'], note: 'seed',
    });
    commit(db, 'undo', { type: 'restore-revision', revisionId: empty });
    const after = listProposals(db, P).find((item) => item.id === proposal.id)!;
    expect(after.status).toBe('superseded');
    expect(after.note).toContain('restore-revision');
    db.close();
  });

  it('keeps node ids monotonic: a node added after an undo gets a new id', () => {
    const db = openDb();
    commit(db, 'a', { type: 'add-node', nodeType: 'KSampler' });
    const one = head(db).currentRevisionId;
    commit(db, 'b', { type: 'add-node', nodeType: 'VAEDecode' });
    commit(db, 'undo', { type: 'restore-revision', revisionId: one });
    expect(nextNodeId(head(db).snapshot as never)).toBe(3);
    const added = commit(db, 'c', { type: 'add-node', nodeType: 'SaveImage' });
    expect((added.result as Rec).nodeId).toBe('3');
    db.close();
  });
});

const rev = (id: string, revSeq: number, extra: Partial<UndoRevision> = {}): UndoRevision => ({ id, revSeq, source: 'user', actor: 'manual', ...extra });

describe('undo pointer', () => {
  const base: UndoRevision[] = [
    rev('r1', 1, { source: 'system', actor: null, description: 'Initial' }),
    rev('r2', 2, { description: 'add-node', payload: { type: 'add-node', nodeType: 'KSampler' } }),
    rev('r3', 3, { description: 'connect', payload: { type: 'connect', source: '2', target: '4' } }),
  ];

  /** Applies an undo or redo plan the way the renderer does, appending the restore commit. */
  function step(list: UndoRevision[], session: UndoSession, kind: 'undo' | 'redo'): { list: UndoRevision[]; session: UndoSession } {
    const headId = list.at(-1)!.id;
    const plan = planUndo(list, headId, session, { running: false });
    const move = kind === 'undo' ? plan.undo : plan.redo;
    if (!move) throw new Error(`no ${kind}`);
    const next = rev(`r${list.length + 1}`, list.length + 1, { description: 'restore-revision', restoredRevisionId: move.target });
    const nextSession = kind === 'undo' ? afterUndo(session, headId, plan.pointer!, next.id) : afterRedo(session, headId, next.id);
    return { list: [...list, next], session: nextSession };
  }

  it('undoes the person\'s steps one by one and redoes them back, skipping the restore commits', () => {
    let state = { list: base, session: EMPTY_SESSION };
    const first = planUndo(state.list, 'r3', state.session, { running: false });
    expect(first.undo?.target).toBe('r2');
    expect(describeRevision(first.undo!.undone)).toEqual(expect.objectContaining({ key: 'undo.connect', values: expect.objectContaining({ source: '2', target: '4' }) }));
    expect(first.redo).toBeNull();
    state = step(state.list, state.session, 'undo');
    state = step(state.list, state.session, 'undo');
    const byId = new Map(state.list.map((item) => [item.id, item]));
    expect(logicalRevision(byId, 'r5')).toBe('r1');
    const atStart = planUndo(state.list, 'r5', state.session, { running: false });
    expect(atStart.pointer).toBe('r1');
    expect(atStart.undo).toBeNull();
    expect(atStart.redo?.target).toBe('r2');
    state = step(state.list, state.session, 'redo');
    const afterOne = planUndo(state.list, 'r6', state.session, { running: false });
    expect(afterOne.pointer).toBe('r2');
    expect(afterOne.redo?.target).toBe('r3');
    expect(afterOne.undo?.target).toBe('r1');
    state = step(state.list, state.session, 'redo');
    const back = planUndo(state.list, 'r7', state.session, { running: false });
    expect(back.pointer).toBe('r3');
    expect(back.redo).toBeNull();
    expect(state.list.map((item) => item.revSeq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('a new edit clears the redo chain, and undo after it goes back to the state it was made on', () => {
    let state = { list: base, session: EMPTY_SESSION };
    state = step(state.list, state.session, 'undo');
    const edited = [...state.list, rev('r5', 5, { description: 'move-node', payload: { type: 'move-node', nodeId: '2' } })];
    const plan = planUndo(edited, 'r5', state.session, { running: false });
    expect(plan.redo).toBeNull();
    expect(plan.undo?.target).toBe('r2');
  });

  it('undoes only the contiguous helper steps after a manual edit and redoes them; nothing while a run is open', () => {
    const list = [
      ...base,
      rev('r4', 4, { source: 'ai', actor: 'ai', description: 'add-node', runId: 'run-1', payload: { type: 'add-node' } }),
      rev('r5', 5, { source: 'user', actor: 'manual', description: 'move-node', payload: { type: 'move-node', nodeId: '1' } }),
      rev('r6', 6, { source: 'ai', actor: 'ai', description: 'connect', runId: 'run-1', payload: { type: 'connect' } }),
      rev('r7', 7, { source: 'ai', actor: 'ai', description: 'move-nodes', runId: 'run-1', payload: { type: 'move-nodes' } }),
    ];
    // The run is still open: undo waits and says why.
    expect(planUndo(list, 'r7', EMPTY_SESSION, { running: false, activeRunId: 'run-1' })).toMatchObject({ undo: null, blocked: 'running' });
    expect(planUndo(base, 'r3', EMPTY_SESSION, { running: true })).toMatchObject({ undo: null, blocked: 'running' });
    // Closed: stop at the manual edit, even though the earlier AI step has the same run id.
    const plan = planUndo(list, 'r7', EMPTY_SESSION, { running: false, activeRunId: null });
    expect(plan.undo?.target).toBe('r5');
    expect(plan.undo?.undone.payload).toEqual({ type: 'agent-run', count: 2 });
    expect(describeRevision(plan.undo!.undone)).toEqual({ key: 'undo.agentRun', values: expect.objectContaining({ count: '2' }) });
    const undone = step(list, EMPTY_SESSION, 'undo');
    const back = planUndo(undone.list, undone.list.at(-1)!.id, undone.session, { running: false });
    expect(back.redo?.target).toBe('r7');
    expect(planUndo(undone.list, undone.list.at(-1)!.id, undone.session, { running: true }).redo).toBeNull();
    // The bounded history trimmed the version before the build: undo says it is too old instead of failing.
    const trimmed = list.slice(5);
    expect(planUndo(trimmed, 'r7', EMPTY_SESSION, { running: false, activeRunId: null })).toMatchObject({ undo: null, blocked: 'too-old' });
  });

  it('is off when the head is not in the list yet', () => {
    expect(planUndo(base, 'r9', EMPTY_SESSION, { running: false })).toMatchObject({ pointer: null, undo: null, redo: null });
  });
});

describe('export guard findings', () => {
  it('lists the check rows and unset widgets once', async () => {
    const { exportGuardFindings } = await import('../../src/renderer/commands/exportGuard');
    const report = {
      ok: false, missingNodes: [], missingModels: [{ nodeId: '1', directory: 'checkpoints', name: 'x.safetensors' }], typeMismatches: [],
      baseModelMismatches: [], unconnectedRequiredInputs: [], unknownNodeTypes: [],
      unsetWidgets: [{ nodeId: '2', classType: 'KSampler', name: 'seed' }],
    };
    expect(exportGuardFindings(report).map((item) => item.textKey)).toEqual(['check.missingModelsItem', 'check.unsetWidgetsItem']);
    expect(exportGuardFindings(null)).toEqual([]);
  });
});
