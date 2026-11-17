/** Manual native group rectangles: one command/undo boundary, root and nested, without moving nodes on resize. */
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { groupRect } from '../../src/renderer/components/graph/lib/geometry';
import { describeRevision } from '../../src/renderer/state/undoState';
import { typedWorkflow } from '../e2e/fixtures/typedWorkflow';
import { nestedSubgraphWorkflow, INNER_ID } from '../e2e/fixtures/nestedSubgraphWorkflow';

const databases: Database.Database[] = [];
function open() { const db = new Database(':memory:'); databases.push(db); migrate(db); ensureWorkspace(db); return db; }
const head = (db: Database.Database) => readProjection(db, 'desktop')!;
const snap = (db: Database.Database) => head(db).snapshot as GraphSnapshot;
let seq = 0;
const commit = (db: Database.Database, payload: unknown) => commitCommand(db, { projectId: 'desktop', actionId: `bounds-${++seq}`, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload });
const exported = (db: Database.Database): Record<string, any> => { const out = exportWorkflow(snap(db), '2026-11-17'); if (!out.ok) throw new Error(out.error); return out.workflow; };
afterEach(() => databases.splice(0).forEach(db => db.close()));

describe('manual group bounds', () => {
  it('resizes only the frame, preserves native flags, round-trips and undoes in one revision', () => {
    const db = open(); const workflow: any = structuredClone(typedWorkflow);
    workflow.groups = [{ id: 1, title: 'Prompts', bounding: [0, 0, 1600, 1400], color: '#335', flags: { pinned: false, future: 'keep' }, futureGroupField: 42 }];
    expect(commit(db, { type: 'import-workflow', document: workflow }).status).toBe('applied');
    const before = structuredClone(snap(db)); const oldRevision = head(db).currentRevisionId;
    const bounding = [-50, -70, 1800, 1500];
    expect(commit(db, { type: 'set-group-bounds', groupId: '1', bounding }).status).toBe('applied');
    expect(snap(db).nodes).toEqual(before.nodes); expect(snap(db).edges).toEqual(before.edges);
    expect(snap(db).groups![0].nodeIds).toEqual(before.groups![0].nodeIds);
    expect(groupRect(snap(db).groups![0], before.nodes as any)).toEqual({ x: -50, y: -70, width: 1800, height: 1500 });
    const saved = exported(db);
    expect(saved.groups[0]).toMatchObject({ bounding, flags: { future: 'keep', nodewise_bounds_mode: 'manual' }, futureGroupField: 42 });
    const other = open(); expect(commit(other, { type: 'import-workflow', document: saved }).status).toBe('applied');
    expect(snap(other).groups![0]).toMatchObject({ boundsMode: 'manual', bounding });
    expect(exported(other).groups[0]).toEqual(saved.groups[0]);
    expect(commit(db, { type: 'restore-revision', revisionId: oldRevision }).status).toBe('applied');
    expect(snap(db).groups).toEqual(before.groups);
    expect(describeRevision({ payload: { type: 'set-group-bounds' } } as never).key).toBe('undo.resizeGroup');
  });

  it('moves a manual frame and its members once, leaves other nodes alone and returns to automatic fit', () => {
    const db = open(); commit(db, { type: 'import-workflow', document: typedWorkflow });
    commit(db, { type: 'add-group', title: 'Text', nodeIds: ['2', '3'] });
    commit(db, { type: 'set-group-bounds', groupId: '1', bounding: [0, 0, 1000, 800] });
    const before = structuredClone(snap(db));
    expect(commit(db, { type: 'move-group', groupId: '1', dx: 40, dy: -20 }).status).toBe('applied');
    expect(snap(db).groups![0].bounding).toEqual([40, -20, 1000, 800]);
    for (const node of before.nodes) expect(snap(db).nodes.find(n => n.id === node.id)!.position).toEqual(['2', '3'].includes(node.id)
      ? { x: node.position.x + 40, y: node.position.y - 20 } : node.position);
    expect(commit(db, { type: 'set-group-bounds', groupId: '1', bounding: null }).status).toBe('applied');
    expect(snap(db).groups![0].boundsMode).toBe('auto');
    expect(exported(db).groups[0].bounding).not.toEqual([40, -20, 1000, 800]);
  });

  it('handles an empty imported frame and rejects unknown groups, non-finite and tiny bounds', () => {
    const db = open(); const workflow: any = structuredClone(typedWorkflow);
    workflow.groups = [{ id: 1, title: 'Empty', bounding: [9000, 9000, 300, 200] }];
    commit(db, { type: 'import-workflow', document: workflow });
    expect(snap(db).groups![0].nodeIds).toEqual([]);
    expect(commit(db, { type: 'move-group', groupId: '1', dx: 10, dy: 10 }).status).toBe('applied');
    expect(snap(db).groups![0].bounding).toEqual([9010, 9010, 300, 200]);
    expect(commit(db, { type: 'set-group-bounds', groupId: 'missing', bounding: [0, 0, 200, 100] }).status).toBe('rejected');
    expect(commit(db, { type: 'set-group-bounds', groupId: '1', bounding: [0, 0, 10, 1] }).status).toBe('rejected');
    expect(commit(db, { type: 'move-group', groupId: '1', dx: Infinity, dy: 0 }).status).toBe('rejected');
  });

  it('resizes and moves the inner group without touching identically numbered root objects', () => {
    const db = open(); commit(db, { type: 'import-workflow', document: nestedSubgraphWorkflow });
    commit(db, { type: 'add-group', title: 'Root', nodeIds: ['1'] });
    const inner = (edit: unknown) => commit(db, { type: 'edit-in-subgraph', definitionId: INNER_ID, edit });
    const added = inner({ type: 'add-group', title: 'Inner', nodeIds: ['1'] }); expect(added.status).toBe('applied');
    const groupId = snap(db).subgraphs!.find(d => d.id === INNER_ID)!.groups!.at(-1)!.id;
    const before = structuredClone(snap(db));
    expect(inner({ type: 'set-group-bounds', groupId, bounding: [-30, -40, 900, 600] }).status).toBe('applied');
    expect(inner({ type: 'move-group', groupId, dx: 50, dy: 60 }).status).toBe('applied');
    expect(snap(db).nodes).toEqual(before.nodes); expect(snap(db).groups).toEqual(before.groups);
    const definition = exported(db).definitions.subgraphs.find((d: any) => d.id === INNER_ID);
    expect(definition.groups.at(-1)).toMatchObject({ bounding: [20, 20, 900, 600], flags: { nodewise_bounds_mode: 'manual' } });
  });
});
