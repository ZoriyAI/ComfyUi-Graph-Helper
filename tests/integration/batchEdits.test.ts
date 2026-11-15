/**
 * Protects batch commands in the main command log (commitCommand): a multi-node delete, a paste with its inner links
 * (new ids; "@k" names the k-th new node), a nudge of several nodes. Each batch is one revision, so one undo
 * (restore to the revision before) brings everything back, and a batch with one bad edit is refused whole.
 * A person expects Ctrl+Z after a paste or a group delete to undo all of it, not one node at a time.
 */
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, listRevisions, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { CLASSES, objectInfoDocument } from '../fixtures/mcp/fakeMcpServer';
import { fragmentOf, pasteEdits, type Fragment } from '../../src/renderer/components/graph/lib/clipboard';
import { describeRevision } from '../../src/renderer/state/undoState';

function open(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(objectInfoDocument(CLASSES)), 1000);
  return db;
}

let action = 0;
function commit(db: Database.Database, payload: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  action += 1;
  return commitCommand(db, { projectId: DESKTOP_PROJECT_ID, actionId: `b-${action}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null, payload: payload as never });
}

function graph(db: Database.Database) {
  const snapshot = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as { nodes: Array<{ id: string; position: { x: number; y: number }; data: { comfyType: string; parameters?: Record<string, unknown> } }>; edges: Array<{ source: string; target: string; sourceHandle: string; targetHandle: string }> };
  return snapshot;
}

function build(db: Database.Database) {
  commit(db, { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 });
  commit(db, { type: 'add-node', nodeType: 'CLIPTextEncode', x: 400, y: 0 });
  commit(db, { type: 'add-node', nodeType: 'KSampler', x: 800, y: 0 });
  commit(db, { type: 'connect', source: '1', sourceHandle: 'out-1', target: '2', targetHandle: 'in-0' });
  commit(db, { type: 'connect', source: '2', sourceHandle: 'out-0', target: '3', targetHandle: 'in-1' });
}

describe('batch: several edits, one revision', () => {
  it('deletes several nodes and their links in one step, and one restore brings them back', () => {
    const db = open();
    build(db);
    const before = readProjection(db, DESKTOP_PROJECT_ID)!;
    const result = commit(db, { type: 'batch', label: 'delete', edits: [{ type: 'remove-node', nodeId: '2' }, { type: 'remove-node', nodeId: '3' }] });
    expect(result.status).toBe('applied');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.revSeq).toBe(before.revSeq + 1);
    expect(graph(db).nodes.map((node) => node.id)).toEqual(['1']);
    expect(graph(db).edges).toEqual([]);
    commit(db, { type: 'restore-revision', revisionId: before.currentRevisionId });
    expect(graph(db).nodes.map((node) => node.id)).toEqual(['1', '2', '3']);
    expect(graph(db).edges).toHaveLength(2);
  });

  it('pastes nodes with new ids, offset, values and their inner links', () => {
    const db = open();
    build(db);
    commit(db, { type: 'set-parameter', nodeId: '2', key: 'text', value: 'a red fox' });
    const fragment = fragmentOf(graph(db).nodes.filter((node) => ['1', '2'].includes(String(node.id))) as never, graph(db).edges as never);
    const result = commit(db, { type: 'batch', label: 'paste', edits: pasteEdits(fragment, 40) });
    expect(result.status).toBe('applied');
    expect((result.result as { nodeIds: string[] }).nodeIds).toEqual(['4', '5']);
    const pasted = graph(db).nodes.filter((node) => ['4', '5'].includes(node.id));
    expect(pasted[1].position.x - pasted[0].position.x).toBe(400);
    expect(pasted[1].position.y).toBe(pasted[0].position.y);
    expect(pasted[0].position).not.toEqual({ x: 0, y: 0 });
    expect(pasted[1].data.parameters?.text).toBe('a red fox');
    expect(graph(db).edges).toContainEqual(expect.objectContaining({ source: '4', target: '5', sourceHandle: 'out-1', targetHandle: 'in-0' }));
    // The history names it by what the person did.
    const last = listRevisions(db, DESKTOP_PROJECT_ID).at(-1)!;
    expect(describeRevision(last)).toEqual({ key: 'undo.batchPaste', values: { count: '2' } });
  });

  it('refuses the whole batch when one edit is wrong, and never nests or rewinds', () => {
    const db = open();
    build(db);
    const before = readProjection(db, DESKTOP_PROJECT_ID)!;
    expect(commit(db, { type: 'batch', label: 'delete', edits: [{ type: 'remove-node', nodeId: '2' }, { type: 'remove-node', nodeId: '99' }] }).status).toBe('rejected');
    expect(commit(db, { type: 'batch', label: 'paste', edits: [{ type: 'restore-revision', revisionId: before.currentRevisionId }] }).status).toBe('rejected');
    expect(commit(db, { type: 'batch', label: 'paste', edits: [{ type: 'batch', label: 'paste', edits: [{ type: 'remove-node', nodeId: '2' }] }] }).status).toBe('rejected');
    expect(commit(db, { type: 'batch', label: 'paste', edits: [{ type: 'connect', source: '@3', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' }] }).status).toBe('rejected');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId).toBe(before.currentRevisionId);
  });

  it('moves several nodes in one step', () => {
    const db = open();
    build(db);
    commit(db, { type: 'batch', label: 'move', edits: [{ type: 'move-node', nodeId: '1', x: 10, y: 20 }, { type: 'move-node', nodeId: '2', x: 410, y: 20 }] });
    expect(graph(db).nodes.slice(0, 2).map((node) => node.position)).toEqual([{ x: 10, y: 20 }, { x: 410, y: 20 }]);
    expect(describeRevision(listRevisions(db, DESKTOP_PROJECT_ID).at(-1)!)).toEqual({ key: 'undo.batchMove', values: { count: '2' } });
  });
});
