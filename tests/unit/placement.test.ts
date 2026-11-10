import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { closeRun, commitCommand, ensureWorkspace, listRecentCommands, listRevisions, readProjection, startRun } from '../../src/main/commands/commit';
import { nodeRectOf, placeHelperNode, tidyMoves } from '../../src/main/commands/placement';
import { migrate } from '../../src/main/settings/migrate';
import { createProposal, resolveProposal } from '../../src/main/proposals/repository';
import { describeCommand } from '../../src/shared/agent/recentActions';
import { rectsOverlap } from '../../src/shared/graph/layout';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import { describeRevision, planUndo, EMPTY_SESSION } from '../../src/renderer/state/undoState';

type Rec = Record<string, any>;

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

const head = (db: Database.Database) => readProjection(db, P)!;
const manual = (db: Database.Database, actionId: string, payload: Rec) => commitCommand(db, {
  projectId: P, actionId, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload,
});
const ai = (db: Database.Database, runId: string, actionId: string, payload: Rec) => commitCommand(db, {
  projectId: P, actionId: `${runId}:${actionId}`, expectedRevisionId: head(db).activeRun!.expectedRevisionId, actor: 'ai', runId, payload,
});

function nodesOf(db: Database.Database): Rec[] {
  return head(db).snapshot.nodes as Rec[];
}

function expectNoOverlap(nodes: Rec[]): void {
  const rects = nodes.map(nodeRectOf);
  for (let a = 0; a < rects.length; a += 1) {
    for (let b = a + 1; b < rects.length; b += 1) expect(rectsOverlap(rects[a], rects[b]), `${nodes[a].id} and ${nodes[b].id}`).toBe(false);
  }
}

describe('engine: move-nodes', () => {
  it('moves many nodes in one revision and refuses an unknown node', () => {
    const db = openDb();
    manual(db, 'a', { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    manual(db, 'b', { type: 'add-node', nodeType: 'VAEDecode', x: 10, y: 10 });
    const before = head(db).revSeq;
    const moved = manual(db, 'm', { type: 'move-nodes', moves: [{ nodeId: '1', x: 100, y: 200 }, { nodeId: '2', x: 500, y: 200 }] });
    expect(moved.status).toBe('applied');
    expect(moved.result).toEqual({ nodeIds: ['1', '2'] });
    expect(moved.projection!.revSeq).toBe(before + 1);
    expect(nodesOf(db).map((node) => node.position)).toEqual([{ x: 100, y: 200 }, { x: 500, y: 200 }]);
    const refused = manual(db, 'n', { type: 'move-nodes', moves: [{ nodeId: '1', x: 0, y: 0 }, { nodeId: '99', x: 0, y: 0 }] });
    expect(refused.status).toBe('rejected');
    expect(nodesOf(db)[0].position).toEqual({ x: 100, y: 200 });
    expect(manual(db, 'e', { type: 'move-nodes', moves: [] }).status).toBe('rejected');
    // The prompt hears how many nodes moved, not every coordinate.
    expect(describeCommand(listRecentCommands(db, P).at(-1)!, null)).toBe('arranged 2 nodes');
    db.close();
  });
});

describe('placing the helper\'s nodes', () => {
  it('keeps a free position the model gave, and moves one that would cover a node', () => {
    const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: { inputs: [], outputs: [{}], parameters: {} } }];
    const catalog = { nodeTypes: [], models: [], nodes: [] };
    const free = placeHelperNode({ type: 'add-node', nodeType: 'X', x: 600, y: 0 }, nodes, [], catalog);
    expect(free).toMatchObject({ x: 600, y: 0 });
    const covered = placeHelperNode({ type: 'add-node', nodeType: 'X', x: 20, y: 20 }, nodes, [], catalog);
    expect(rectsOverlap({ x: covered.x!, y: covered.y!, width: 240, height: 96 }, nodeRectOf(nodes[0]), 40)).toBe(false);
    // No position at all: right of the graph.
    const none = placeHelperNode({ type: 'add-node', nodeType: 'X' }, nodes, [], catalog);
    expect(none.x).toBeGreaterThanOrEqual(240);
  });

  it('a build on a canvas that already has nodes covers none of them, and the tidy at close is one undoable step', () => {
    const db = openDb();
    manual(db, 'a', { type: 'add-node', nodeType: 'LoraLoader', title: 'Load LoRA', x: 0, y: 220 });
    manual(db, 'b', { type: 'add-node', nodeType: 'CLIPTextEncode', title: 'Old prompt', x: 380, y: 40 });
    const before = nodesOf(db).map((node) => ({ id: node.id, position: node.position }));
    const run = startRun(db, P);
    // The model reuses the coordinates of an empty-canvas build: every one of them lands on the old nodes.
    ai(db, run.runId, 'loader', { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 220 });
    ai(db, run.runId, 'pos', { type: 'add-node', nodeType: 'CLIPTextEncode', x: 380, y: 40 });
    ai(db, run.runId, 'neg', { type: 'add-node', nodeType: 'CLIPTextEncode', x: 380, y: 300 });
    ai(db, run.runId, 'sampler', { type: 'add-node', nodeType: 'KSampler' });
    expect(ai(db, run.runId, 'c1', { type: 'connect', source: '3', sourceHandle: 'out-1', target: '4', targetHandle: 'in-0' }).status).toBe('applied');
    expect(ai(db, run.runId, 'c2', { type: 'connect', source: '4', sourceHandle: 'out-0', target: '6', targetHandle: 'in-1' }).status).toBe('applied');
    expectNoOverlap(nodesOf(db));
    const built = head(db).revSeq;

    closeRun(db, P, run.runId);
    const after = head(db);
    expect(after.activeRun).toBeNull();
    // One more revision: the tidy, made by the run.
    expect(after.revSeq).toBe(built + 1);
    const revisions = listRevisions(db, P);
    expect(revisions.at(-1)).toMatchObject({ description: 'move-nodes', actor: 'ai' });
    expect(describeRevision(revisions.at(-1)!).key).toBe('undo.moveNodes');
    // Nodes the run did not make stay where they were; nothing overlaps.
    for (const old of before) expect(nodesOf(db).find((node) => node.id === old.id)!.position).toEqual(old.position);
    expectNoOverlap(nodesOf(db));
    // Data flows left to right: the loader before the prompt it feeds, the prompt before the sampler.
    const x = (id: string) => nodesOf(db).find((node) => node.id === id)!.position.x;
    expect(x('3')).toBeLessThan(x('4'));
    expect(x('4')).toBeLessThan(x('6'));
    // Undo may take the tidy back although the helper made it; the build before it stays the helper's.
    const plan = planUndo(revisions, after.currentRevisionId, EMPTY_SESSION, { running: false });
    expect(plan.undo?.undone.description).toBe('move-nodes');
    expect(plan.blocked).toBe('none');
    db.close();
  });

  it('lays out the whole graph when the run made all of it, and does nothing for a run that made nothing', () => {
    const db = openDb();
    const run = startRun(db, P);
    ai(db, run.runId, 'a', { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 900, y: 900 });
    ai(db, run.runId, 'b', { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    expect(ai(db, run.runId, 'c', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' }).status).toBe('applied');
    closeRun(db, P, run.runId);
    const nodes = nodesOf(db);
    expect(nodes[0].position.x).toBeLessThan(nodes[1].position.x);
    const empty = startRun(db, P);
    const seq = head(db).revSeq;
    closeRun(db, P, empty.runId);
    expect(head(db).revSeq).toBe(seq);
    db.close();
  });

  it('tidyMoves leaves fixed nodes out and moves only what changes', () => {
    const nodes = [
      { id: 'old', position: { x: 0, y: 0 }, data: {} },
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 0, y: 0 }, data: {} },
    ];
    const moves = tidyMoves(nodes, [{ source: 'a', target: 'b' }], ['a', 'b']);
    expect(moves.map((move) => move.nodeId).sort()).toEqual(['a', 'b']);
    const placed = nodes.map((node) => ({ ...node, position: moves.find((move) => move.nodeId === node.id) ?? node.position }));
    expectNoOverlap(placed);
    expect(tidyMoves(placed, [{ source: 'a', target: 'b' }], ['a', 'b'])).toEqual([]);
  });
});

describe('accepting an add-node ghost', () => {
  it('lands where the canvas showed it, or in a free spot when no spot was sent', () => {
    const db = openDb();
    manual(db, 'a', { type: 'add-node', nodeType: 'KSampler', x: 0, y: 0 });
    const shown = createProposal(db, { projectId: P, kind: 'add-node', payload: { type: 'add-node', nodeType: 'VAEDecode', x: 0, y: 0 }, note: '' });
    resolveProposal(db, { projectId: P, proposalId: shown.id, decision: 'accept', at: { x: 812.4, y: 40 } });
    expect(nodesOf(db).at(-1)!.position).toEqual({ x: 812, y: 40 });
    const blind = createProposal(db, { projectId: P, kind: 'add-node', payload: { type: 'add-node', nodeType: 'VAEDecode', x: 0, y: 0 }, note: '' });
    resolveProposal(db, { projectId: P, proposalId: blind.id, decision: 'accept' });
    expectNoOverlap(nodesOf(db));
    db.close();
  });
});
