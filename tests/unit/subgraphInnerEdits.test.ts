import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { describeCommand } from '../../src/shared/agent/recentActions';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';
import { listRecentCommands } from '../../src/main/commands/commit';

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
const inner = (db: Database.Database, id: string) => snap(db).subgraphs!.find((item) => item.id === id)!;

function exported(db: Database.Database): Record<string, any> {
  const result = exportWorkflow(snap(db), '2026-11-10T00:00:00.000Z');
  if (!result.ok) throw new Error(result.error);
  return result.workflow as Record<string, any>;
}

function definitionOf(workflow: Record<string, any>, id: string): Record<string, any> {
  return workflow.definitions.subgraphs.find((item: { id: string }) => item.id === id);
}

function importNested(db: Database.Database) {
  expect(commit(db, 'import', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) }).status).toBe('applied');
}

describe('edit-in-subgraph', () => {
  it('moves an inner node in its definition only, even when the root has a node with the same id', () => {
    const db = openDb();
    importNested(db);
    const rootBefore = structuredClone(snap(db).nodes);
    const before = head(db);
    const moved = commit(db, 'mv', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'move-node', nodeId: '1', x: 140, y: 260 } });
    expect(moved.status).toBe('applied');
    expect(moved.result).toMatchObject({ definitionId: INNER_ID, edit: 'move-node', nodeId: '1' });
    expect(moved.projection!.revSeq).toBe(before.revSeq + 1);
    expect(inner(db, INNER_ID).nodes.find((node) => String(node.id) === '1')!.position).toEqual({ x: 140, y: 260 });
    // Root node 1 (the checkpoint loader) and the other definition did not move.
    expect(snap(db).nodes).toEqual(rootBefore);
    expect(inner(db, OUTER_ID).nodes.find((node) => String(node.id) === '1')!.position).toEqual({ x: 0, y: 0 });
    expect(describeCommand(listRecentCommands(db, P).at(-1)!, null)).toBe(`inside subgraph ${INNER_ID}: move-node node 1`);

    // Undo is a restore of the earlier revision, as everywhere else.
    commit(db, 'undo', { type: 'restore-revision', revisionId: before.currentRevisionId });
    expect(inner(db, INNER_ID).nodes.find((node) => String(node.id) === '1')!.position).toEqual({ x: 0, y: 0 });
    db.close();
  });

  it('sets an inner field value in its definition only', () => {
    const db = openDb();
    importNested(db);
    const set = commit(db, 'set', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'set-parameter', nodeId: '1', key: 'text', value: 'a dog', widgetIndex: 0 } });
    expect(set.status).toBe('applied');
    const node = inner(db, INNER_ID).nodes.find((item) => String(item.id) === '1')!;
    expect(node.data.comfy.widgets_values).toEqual(['a dog']);
    expect(node.data.parameters.text).toBe('a dog');
    // Root node 1 keeps its checkpoint name.
    expect(snap(db).nodes.find((item) => item.id === '1')!.data.comfy.widgets_values).toEqual(['model.safetensors']);
    db.close();
  });

  it('connects and disconnects inner nodes inside their definition', () => {
    const db = openDb();
    importNested(db);
    const outer = inner(db, OUTER_ID);
    const link = outer.edges.find((edge) => String(edge.source) === '1' && String(edge.target) === '2')!;
    const rootEdges = structuredClone(snap(db).edges);
    expect(commit(db, 'rm', { type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: { type: 'remove-edge', edgeId: String(link.id) } }).status).toBe('applied');
    expect(inner(db, OUTER_ID).edges.some((edge) => edge.id === link.id)).toBe(false);
    expect(snap(db).edges).toEqual(rootEdges);

    const connected = commit(db, 'cn', { type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' } });
    expect(connected.status).toBe('applied');
    const edge = inner(db, OUTER_ID).edges.find((item) => String(item.source) === '1' && String(item.target) === '2')!;
    // A fresh link id from the definition's own counter, never one the definition used before.
    const allLinkIds = [...snap(db).edges, ...snap(db).subgraphs!.flatMap((item) => item.edges)].map((item) => item.data?.linkId);
    expect(allLinkIds.filter((id) => id === edge.data.linkId)).toHaveLength(1);
    expect(snap(db).edges).toEqual(rootEdges);
    db.close();
  });

  it('refuses an unknown definition, an unknown inner node and a boundary pseudo-node', () => {
    const db = openDb();
    importNested(db);
    expect(commit(db, 'x1', { type: 'edit-in-subgraph', definitionId: 'nope', edit: { type: 'move-node', nodeId: '1', x: 0, y: 0 } })).toMatchObject({ status: 'rejected', result: { error: 'Subgraph definition was not found.' } });
    expect(commit(db, 'x2', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'move-node', nodeId: '3', x: 0, y: 0 } }).status).toBe('rejected');
    expect(commit(db, 'x3', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'move-node', nodeId: '-10', x: 0, y: 0 } }).status).toBe('rejected');
    expect(commit(db, 'x4', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'remove-node', nodeId: '-20' } }).status).toBe('rejected');
    db.close();
  });

  it('keeps inner moves, field values and links through export and a fresh import (lossless round trip)', () => {
    const db = openDb();
    importNested(db);
    commit(db, 'mv', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'move-node', nodeId: '1', x: 140, y: 260 } });
    commit(db, 'set', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'set-parameter', nodeId: '1', key: 'text', value: 'a dog', widgetIndex: 0 } });
    commit(db, 'mv2', { type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: { type: 'move-node', nodeId: '2', x: 333, y: 44 } });
    const workflow = exported(db);
    const encode = definitionOf(workflow, INNER_ID).nodes.find((node: { id: number }) => node.id === 1);
    expect(encode.pos).toEqual([140, 260]);
    expect(encode.widgets_values).toEqual(['a dog']);
    expect(definitionOf(workflow, OUTER_ID).nodes.find((node: { id: number }) => node.id === 2).pos).toEqual([333, 44]);
    // Unknown native fields of the definitions survive the edit.
    expect(definitionOf(workflow, OUTER_ID).extra).toEqual({ innerVendor: 'keep-outer' });
    expect(definitionOf(workflow, INNER_ID).category).toBe('helpers');
    // The root node with the same id is untouched in the export.
    expect(workflow.nodes.find((node: { id: number }) => node.id === 1).pos).toEqual([20, 40]);

    const other = openDb();
    expect(commit(other, 'import', { type: 'import-workflow', document: structuredClone(workflow) }).status).toBe('applied');
    expect(exported(other).definitions).toEqual(workflow.definitions);
    const again = inner(other, INNER_ID).nodes.find((node) => String(node.id) === '1')!;
    expect(again.position).toEqual({ x: 140, y: 260 });
    expect(again.data.comfy.widgets_values).toEqual(['a dog']);
    db.close();
    other.close();
  });
});

describe('canvas edits inside an open definition', () => {
  it('are scoped to that definition; root edits and boundary slots go out unchanged', async () => {
    const { scopedToLevel } = await import('../../src/renderer/components/graph/commit');
    const { useGraphStore } = await import('../../src/renderer/state/graphState');
    const db = openDb();
    importNested(db);
    const subgraphs = snap(db).subgraphs!;
    useGraphStore.setState({ subgraphs, activeSubgraphId: null, subgraphPath: [] });
    const move = { type: 'move-node' as const, nodeId: '1', x: 1, y: 2 };
    expect(scopedToLevel(move)).toEqual(move);
    useGraphStore.setState({ activeSubgraphId: INNER_ID, subgraphPath: [INNER_ID] });
    expect(scopedToLevel(move)).toEqual({ type: 'edit-in-subgraph', definitionId: INNER_ID, edit: move });
    const field = { type: 'set-parameter' as const, nodeId: '1', key: 'text', value: 'x' };
    expect(scopedToLevel(field)).toEqual({ type: 'edit-in-subgraph', definitionId: INNER_ID, edit: field });
    const slot = { type: 'add-subgraph-io' as const, definitionId: INNER_ID, direction: 'input' as const, name: 'clip', dataType: 'CLIP', nodeId: '1', handle: 'in-0' };
    expect(scopedToLevel(slot)).toEqual(slot);
    expect(scopedToLevel({ type: 'move-node', nodeId: '99', x: 0, y: 0 })).toEqual({ type: 'move-node', nodeId: '99', x: 0, y: 0 });
    useGraphStore.setState({ activeSubgraphId: null, subgraphPath: [] });
    db.close();
  });
});
