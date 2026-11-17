/** Real revision/Undo tests: shared chains, old format extensions, inner scope and unknown native fields. */
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { reroutePaths } from '../../src/shared/workflow/comfyLook';
import { lastNativeRerouteId, nativeRerouteRecords } from '../../src/shared/workflow/nativeReroutes';
import { typedWorkflow } from '../e2e/fixtures/typedWorkflow';
import { INNER_ID, nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';

const databases: Database.Database[] = []; let seq = 0;
const open = () => { const db = new Database(':memory:'); databases.push(db); migrate(db); ensureWorkspace(db); return db; };
const head = (db: Database.Database) => readProjection(db, 'desktop')!;
const snap = (db: Database.Database) => head(db).snapshot as GraphSnapshot;
const commit = (db: Database.Database, payload: unknown) => commitCommand(db, { projectId: 'desktop', actionId: `reroute-${++seq}`, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload });
const exportDoc = (db: Database.Database): Record<string, any> => { const result = exportWorkflow(snap(db), '2026-11-17'); if (!result.ok) throw new Error(result.error); return result.workflow; };
afterEach(() => databases.splice(0).forEach(db => db.close()));

function branched(): any {
  const doc: any = structuredClone(typedWorkflow);
  doc.nodes.push({ ...structuredClone(doc.nodes[1]), id: 4, inputs: [{ name: 'clip', type: 'CLIP', link: 3 }] });
  doc.nodes[0].outputs[1].links = [2, 3];
  doc.links[0].parentId = 2; doc.links[0].futureLink = { value: 42 };
  doc.links.push({ ...doc.links[0], id: 3, target_id: 4, parentId: 1 });
  doc.reroutes = [{ id: 1, pos: [300, 300], linkIds: [2, 3], futurePoint: 'keep' }, { id: 2, parentId: 1, pos: [350, 350], linkIds: [2] }];
  return doc;
}

describe('native reroute commands', () => {
  it('moves a shared point, deletes it without changing node connections, round-trips and undoes', () => {
    const db = open(); expect(commit(db, { type: 'import-workflow', document: branched() }).status).toBe('applied');
    const nodes = structuredClone(snap(db).nodes); const edges = structuredClone(snap(db).edges);
    expect(commit(db, { type: 'move-native-reroute', rerouteId: '1', x: 320, y: 410 }).status).toBe('applied');
    expect(snap(db).nodes).toEqual(nodes); expect(snap(db).edges).toEqual(edges);
    const moved = exportDoc(db); expect(moved.reroutes[0]).toEqual({ id: 1, pos: [320, 410], linkIds: [2, 3], futurePoint: 'keep' });
    const beforeDelete = head(db).currentRevisionId;
    expect(commit(db, { type: 'remove-native-reroute', rerouteId: '1' }).status).toBe('applied');
    const saved = exportDoc(db);
    expect(saved.reroutes).toEqual([{ id: 2, pos: [350, 350], linkIds: [2] }]);
    expect(saved.links[0]).toMatchObject({ parentId: 2, futureLink: { value: 42 }, origin_id: 1, target_id: 2 });
    expect(saved.links[1].parentId).toBeUndefined();
    expect(snap(db).nodes).toEqual(nodes);
    const copy = open(); commit(copy, { type: 'import-workflow', document: saved });
    expect(exportDoc(copy)).toEqual(saved);
    expect(commit(db, { type: 'restore-revision', revisionId: beforeDelete }).status).toBe('applied');
    expect(exportDoc(db).reroutes).toEqual(moved.reroutes); expect(exportDoc(db).links).toEqual(moved.links);
  });

  it('inserts a terminal point on only one branch and never reuses its id after Undo or removal', () => {
    const db = open(); commit(db, { type: 'import-workflow', document: branched() }); const before = head(db).currentRevisionId;
    expect(commit(db, { type: 'add-native-reroute', edgeId: 'link-2', x: 400, y: 400 }).status).toBe('applied');
    let saved = exportDoc(db);
    expect(saved.reroutes.at(-1)).toEqual({ id: 3, parentId: 2, pos: [400, 400], linkIds: [2] });
    expect(saved.links.map((link: any) => link.parentId)).toEqual([3, 1]);
    commit(db, { type: 'restore-revision', revisionId: before });
    commit(db, { type: 'add-native-reroute', edgeId: 'link-2', x: 410, y: 400 });
    saved = exportDoc(db); expect(saved.reroutes.at(-1).id).toBe(4);
    commit(db, { type: 'remove-native-reroute', rerouteId: '4' });
    commit(db, { type: 'add-native-reroute', edgeId: 'link-2', x: 420, y: 400 });
    expect(exportDoc(db).reroutes.at(-1).id).toBe(5);
  });

  it('edits 0.4 extra chains without losing extension fields or converting tuple links', () => {
    const doc = branched(); doc.version = 0.4; doc.last_node_id = 4; doc.last_link_id = 3; delete doc.state;
    doc.extra = { futureExtra: true, reroutes: doc.reroutes, linkExtensions: doc.links.map((link: any) => ({ id: link.id, parentId: link.parentId, futureExtension: 'keep' })) }; delete doc.reroutes;
    doc.links = doc.links.map((link: any) => [link.id, link.origin_id, link.origin_slot, link.target_id, link.target_slot, link.type]);
    const db = open(); commit(db, { type: 'import-workflow', document: doc });
    commit(db, { type: 'move-native-reroute', rerouteId: '2', x: 430, y: 440 });
    commit(db, { type: 'remove-native-reroute', rerouteId: '1' });
    commit(db, { type: 'add-native-reroute', edgeId: 'link-3', x: 500, y: 500 });
    const saved = exportDoc(db);
    expect(saved.links).toEqual(doc.links); expect(saved.reroutes).toBeUndefined();
    expect(saved.extra).toMatchObject({ futureExtra: true, linkExtensions: [{ id: 2, parentId: 2, futureExtension: 'keep' }, { id: 3, parentId: 3, futureExtension: 'keep' }] });
    expect(reroutePaths(saved).get('2')).toEqual([{ id: '2', x: 430, y: 440 }]);
    expect(reroutePaths(saved).get('3')).toEqual([{ id: '3', x: 500, y: 500 }]);
    const copy = open(); commit(copy, { type: 'import-workflow', document: saved }); expect(exportDoc(copy)).toEqual(saved);
  });

  it('preserves inner native records and counter through commands and Undo, leaving root untouched', () => {
    const doc: any = structuredClone(nestedSubgraphWorkflow);
    const inner = doc.definitions.subgraphs.find((item: any) => item.id === INNER_ID);
    inner.reroutes = [{ id: 1, pos: [130, 80], linkIds: [inner.links[0].id], futurePoint: 'inner' }]; inner.links[0].parentId = 1;
    doc.reroutes = [{ id: 1, pos: [300, 10], linkIds: [1] }]; doc.links[0].parentId = 1;
    const db = open(); commit(db, { type: 'import-workflow', document: doc }); const root = structuredClone(snap(db));
    const edit = (mutation: unknown) => commit(db, { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: mutation });
    expect(edit({ type: 'move-native-reroute', rerouteId: '1', x: 140, y: 90 }).status).toBe('applied');
    // The root document also embeds the updated definitions; its own routing data and execution graph stay put.
    expect(snap(db).document!.raw.reroutes).toEqual(root.document!.raw.reroutes);
    expect(snap(db).document!.raw.state).toEqual(root.document!.raw.state);
    expect(snap(db).edges).toEqual(root.edges); expect(snap(db).nodes).toEqual(root.nodes);
    const beforeAdd = head(db).currentRevisionId;
    expect(edit({ type: 'add-native-reroute', edgeId: `link-${inner.links[0].id}`, x: 160, y: 100 }).status).toBe('applied');
    commit(db, { type: 'restore-revision', revisionId: beforeAdd });
    expect(edit({ type: 'add-native-reroute', edgeId: `link-${inner.links[0].id}`, x: 180, y: 100 }).status).toBe('applied');
    const savedInner = exportDoc(db).definitions.subgraphs.find((item: any) => item.id === INNER_ID);
    expect(savedInner.reroutes).toEqual([{ id: 1, pos: [140, 90], linkIds: [inner.links[0].id], futurePoint: 'inner' }, { id: 3, parentId: 1, pos: [180, 100], linkIds: [inner.links[0].id] }]);
    expect(savedInner.links[0].parentId).toBe(3); expect(lastNativeRerouteId(savedInner)).toBe(3);
  });

  it('rejects missing targets and nonfinite positions without committing and preserves opaque native entries', () => {
    const db = open(); const doc = branched(); doc.reroutes.push({ future: 'opaque' }); commit(db, { type: 'import-workflow', document: doc });
    const before = head(db).currentRevisionId;
    for (const payload of [{ type: 'move-native-reroute', rerouteId: 'missing', x: 10, y: 20 }, { type: 'add-native-reroute', edgeId: 'missing', x: 10, y: 20 }, { type: 'move-native-reroute', rerouteId: '1', x: NaN, y: 20 }]) expect(commit(db, payload).status).toBe('rejected');
    expect(head(db).currentRevisionId).toBe(before);
    commit(db, { type: 'remove-native-reroute', rerouteId: '1' });
    expect(exportDoc(db).reroutes.at(-1)).toEqual({ future: 'opaque' });
    expect(nativeRerouteRecords(exportDoc(db))).toHaveLength(1);
  });
});
