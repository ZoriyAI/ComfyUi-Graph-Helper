/**
 * Editing inside a subgraph definition the way the root canvas is edited: add, remove, move many, rename,
 * nest another definition, wire the boundary slots. Ids come from the definition's own counters; undo is one
 * revision; the export is a well-formed `definitions.subgraphs` entry that round-trips. A person working inside a
 * subgraph gets the same tools as on the main canvas, and a note written for an inner node never moves to another.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { nativeProjectFile, openNativeFile } from '../../src/main/ipc/projectFile';
import { listExplanations, saveExplanation } from '../../src/main/knowledge/repository';
import type { ObjectRef } from '../../src/shared/contracts/objects';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { SUBGRAPH_INPUT_NODE_ID, SUBGRAPH_OUTPUT_NODE_ID, nestsItself } from '../../src/shared/graph/subgraphs';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';

/** A trimmed object_info with the three conditioning nodes the tests add inside definitions. */
const OBJECT_INFO = {
  CLIPTextEncode: {
    input: { required: { text: ['STRING', { multiline: true }], clip: ['CLIP'] } },
    input_order: { required: ['text', 'clip'] },
    output: ['CONDITIONING'],
    python_module: 'nodes',
  },
  ConditioningZeroOut: {
    input: { required: { conditioning: ['CONDITIONING'] } },
    input_order: { required: ['conditioning'] },
    output: ['CONDITIONING'],
    python_module: 'nodes',
  },
  ConditioningCombine: {
    input: { required: { conditioning_1: ['CONDITIONING'], conditioning_2: ['CONDITIONING'] } },
    input_order: { required: ['conditioning_1', 'conditioning_2'] },
    output: ['CONDITIONING'],
    python_module: 'nodes',
  },
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(OBJECT_INFO));
  return db;
}

const head = (db: Database.Database) => readProjection(db, P)!;
const snap = (db: Database.Database) => head(db).snapshot as GraphSnapshot;
const commit = (db: Database.Database, actionId: string, payload: Record<string, unknown>) => commitCommand(db, {
  projectId: P, actionId, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload,
});
const inside = (db: Database.Database, actionId: string, definitionId: string, edit: Record<string, unknown>) => (
  commit(db, actionId, { type: 'edit-in-subgraph', definitionId, edit })
);
const def = (db: Database.Database, id: string) => snap(db).subgraphs!.find((item) => item.id === id)!;
const innerIds = (db: Database.Database, id: string) => def(db, id).nodes.map((node) => String(node.id)).sort();

function exported(db: Database.Database): Record<string, any> {
  const result = exportWorkflow(snap(db), '2026-11-14T00:00:00.000Z');
  if (!result.ok) throw new Error(result.error);
  return result.workflow as Record<string, any>;
}

const definitionOf = (workflow: Record<string, any>, id: string) => workflow.definitions.subgraphs.find((item: { id: string }) => item.id === id);

function importNested(db: Database.Database) {
  expect(commit(db, 'import', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) }).status).toBe('applied');
}

/** Restores a revision as the Undo command does; the random action id keeps repeated undos distinct. */
function undo(db: Database.Database, revisionId: string) {
  expect(commit(db, `undo-${revisionId}-${Math.random()}`, { type: 'restore-revision', revisionId }).status).toBe('applied');
}

/** Every link of an exported definition names nodes that are in it (or the boundary), and slots list their links. */
function expectWellFormed(definition: Record<string, any>) {
  const ids = new Set(definition.nodes.map((node: { id: number }) => node.id));
  for (const link of definition.links) {
    expect(link.origin_id === -10 || ids.has(link.origin_id)).toBe(true);
    expect(link.target_id === -20 || ids.has(link.target_id)).toBe(true);
  }
  const linkIds = new Set(definition.links.map((link: { id: number }) => link.id));
  expect(linkIds.size).toBe(definition.links.length);
  for (const slot of [...definition.inputs, ...definition.outputs]) {
    for (const id of slot.linkIds) expect(linkIds.has(id)).toBe(true);
  }
  expect(definition.state.lastNodeId).toBeGreaterThanOrEqual(Math.max(0, ...ids as Set<number>));
  expect(definition.state.lastLinkId).toBeGreaterThanOrEqual(Math.max(0, ...linkIds as Set<number>));
  // Node slot links agree with the link list.
  for (const node of definition.nodes) {
    for (const input of node.inputs ?? []) if (input.link != null) expect(linkIds.has(input.link)).toBe(true);
    for (const output of node.outputs ?? []) for (const id of output.links ?? []) expect(linkIds.has(id)).toBe(true);
  }
}

describe('adding a node inside a definition', () => {
  it('takes the next id of the definition, lands only there, and is one undoable revision', () => {
    const db = openDb();
    importNested(db);
    const rootBefore = structuredClone(snap(db).nodes);
    const before = head(db);
    // OUTER keeps lastNodeId 2: its next node is 3, although the root already has a node 3.
    const added = inside(db, 'add', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningCombine', x: 600, y: 200 });
    expect(added.status).toBe('applied');
    expect(added.result).toMatchObject({ definitionId: OUTER_ID, edit: 'add-node', nodeId: '3', nodeType: 'ConditioningCombine' });
    expect(added.projection!.revSeq).toBe(before.revSeq + 1);
    expect(innerIds(db, OUTER_ID)).toEqual(['1', '2', '3']);
    const node = def(db, OUTER_ID).nodes.find((item) => String(item.id) === '3')!;
    expect(node.position).toEqual({ x: 600, y: 200 });
    expect(node.data.inputs.map((port: { name: string }) => port.name)).toEqual(['conditioning_1', 'conditioning_2']);
    expect(snap(db).nodes).toEqual(rootBefore);
    expect(def(db, OUTER_ID).raw.state).toMatchObject({ lastNodeId: 3 });
    // Instances of OUTER on the root keep their ports and links.
    expect(snap(db).edges.filter((edge) => edge.target === '2' || edge.source === '2')).toHaveLength(2);

    const after = head(db).currentRevisionId;
    undo(db, before.currentRevisionId);
    expect(innerIds(db, OUTER_ID)).toEqual(['1', '2']);
    undo(db, after);
    expect(innerIds(db, OUTER_ID)).toEqual(['1', '2', '3']);
    db.close();
  });

  it('never reuses the id of a node an undo took away, and keeps that counter through save and export', () => {
    const db = openDb();
    importNested(db);
    const before = head(db).currentRevisionId;
    inside(db, 'a1', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningCombine', x: 600, y: 0 });
    undo(db, before);
    const again = inside(db, 'a2', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 600, y: 0 });
    expect(again.result).toMatchObject({ nodeId: '4' });
    expect(definitionOf(exported(db), OUTER_ID).state.lastNodeId).toBe(4);
    db.close();
  });

  it('starts from the highest inner id in a definition the app made, whose stored counter is 0', () => {
    const db = openDb();
    importNested(db);
    // Root nodes 1 (loader) and 3 (sampler) become a new definition that keeps their ids.
    const made = commit(db, 'make', { type: 'create-subgraph', name: 'Mine', nodeIds: ['1', '3'], inputs: [], outputs: [] });
    expect(made.status).toBe('applied');
    const id = String((made.result as { definitionId: string }).definitionId);
    const added = inside(db, 'add', id, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 0, y: 400 });
    expect(added.result).toMatchObject({ nodeId: '4' });
    expect(new Set(innerIds(db, id)).size).toBe(3);
    db.close();
  });
});

describe('removing nodes and links inside a definition', () => {
  it('keeps the slot and the instance port when a node wired to it goes, as ComfyUI does', () => {
    const db = openDb();
    importNested(db);
    const rootEdges = structuredClone(snap(db).edges);
    const instancePorts = structuredClone(snap(db).nodes.find((node) => node.id === '2')!.data);
    const before = head(db).currentRevisionId;
    // Inner node 2 of OUTER feeds the CONDITIONING output slot (-20).
    const removed = inside(db, 'rm', OUTER_ID, { type: 'remove-node', nodeId: '2' });
    expect(removed.status).toBe('applied');
    const outer = def(db, OUTER_ID);
    expect(innerIds(db, OUTER_ID)).toEqual(['1']);
    expect(outer.outputs).toHaveLength(1);
    expect(outer.inputs).toHaveLength(1);
    expect(outer.edges.some((edge) => String(edge.source) === '2' || String(edge.target) === '2')).toBe(false);
    expect(outer.edges.some((edge) => edge.target === SUBGRAPH_OUTPUT_NODE_ID)).toBe(false);
    // The input slot still feeds node 1.
    expect(outer.edges.some((edge) => edge.source === SUBGRAPH_INPUT_NODE_ID && edge.target === '1')).toBe(true);
    // The root keeps the instance, its ports and the links to them.
    expect(snap(db).edges).toEqual(rootEdges);
    expect(snap(db).nodes.find((node) => node.id === '2')!.data.outputs).toEqual(instancePorts.outputs);

    const workflow = exported(db);
    const exportedOuter = definitionOf(workflow, OUTER_ID);
    expectWellFormed(exportedOuter);
    expect(exportedOuter.outputs[0].linkIds).toEqual([]);
    expect(exportedOuter.state.lastNodeId).toBe(2);
    expect(workflow.nodes.find((node: { id: number }) => node.id === 2).outputs[0].links).toEqual([2]);

    undo(db, before);
    expect(innerIds(db, OUTER_ID)).toEqual(['1', '2']);
    expect(def(db, OUTER_ID).edges.some((edge) => edge.target === SUBGRAPH_OUTPUT_NODE_ID)).toBe(true);
    db.close();
  });

  it('moves many inner nodes in one revision and renames an inner node', () => {
    const db = openDb();
    importNested(db);
    const before = head(db);
    const moved = inside(db, 'mv', OUTER_ID, { type: 'move-nodes', moves: [{ nodeId: '1', x: 10, y: 20 }, { nodeId: '2', x: 400, y: 20 }] });
    expect(moved.status).toBe('applied');
    expect(moved.projection!.revSeq).toBe(before.revSeq + 1);
    expect(def(db, OUTER_ID).nodes.map((node) => node.position)).toEqual([{ x: 10, y: 20 }, { x: 400, y: 20 }]);
    // A boundary pseudo-node is not a node of the definition.
    expect(inside(db, 'mv-b', OUTER_ID, { type: 'move-nodes', moves: [{ nodeId: SUBGRAPH_INPUT_NODE_ID, x: 0, y: 0 }] }).status).toBe('rejected');

    const renamed = inside(db, 'rn', OUTER_ID, { type: 'rename-node', nodeId: '2', title: 'Silence' });
    expect(renamed.status).toBe('applied');
    expect(def(db, OUTER_ID).nodes.find((node) => String(node.id) === '2')!.data.title).toBe('Silence');
    expect(definitionOf(exported(db), OUTER_ID).nodes.find((node: { id: number }) => node.id === 2).title).toBe('Silence');
    // The root node 2 (the instance) keeps its own title.
    expect(snap(db).nodes.find((node) => node.id === '2')!.data.title).toBe('Prompt block');
    expect(inside(db, 'rn-empty', OUTER_ID, { type: 'rename-node', nodeId: '2', title: '   ' }).status).toBe('rejected');
    db.close();
  });

  it('renames a node on the root canvas too', () => {
    const db = openDb();
    importNested(db);
    expect(commit(db, 'rn', { type: 'rename-node', nodeId: '3', title: 'Sampler' }).status).toBe('applied');
    expect(exported(db).nodes.find((node: { id: number }) => node.id === 3).title).toBe('Sampler');
    expect(commit(db, 'rn-x', { type: 'rename-node', nodeId: '99', title: 'x' })).toMatchObject({ status: 'rejected', result: { error: 'Node was not found.' } });
    db.close();
  });
});

describe('the boundary slots inside a definition', () => {
  it('wires a new inner node to an input slot and to an output slot, replacing the link that held the output', () => {
    const db = openDb();
    importNested(db);
    const added = inside(db, 'add', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningCombine', x: 600, y: 200 });
    const nodeId = String((added.result as { nodeId: string }).nodeId);
    // A link from the inner node 1 into the new node.
    expect(inside(db, 'c1', OUTER_ID, { type: 'connect', source: '1', sourceHandle: 'out-0', target: nodeId, targetHandle: 'in-0' }).status).toBe('applied');
    // The new node feeds the existing CONDITIONING output slot; the slot's earlier link (from node 2) goes.
    const out = inside(db, 'c2', OUTER_ID, { type: 'connect', source: nodeId, sourceHandle: 'out-0', target: SUBGRAPH_OUTPUT_NODE_ID, targetHandle: 'in-0' });
    expect(out.status).toBe('applied');
    expect((out.result as { replacedEdgeIds: string[] }).replacedEdgeIds).toHaveLength(1);
    const toOutput = def(db, OUTER_ID).edges.filter((edge) => edge.target === SUBGRAPH_OUTPUT_NODE_ID);
    expect(toOutput.map((edge) => edge.source)).toEqual([nodeId]);
    // An input slot may feed several inner inputs.
    const feeds = inside(db, 'c3', OUTER_ID, { type: 'connect', source: SUBGRAPH_INPUT_NODE_ID, sourceHandle: 'out-0', target: nodeId, targetHandle: 'in-1' });
    // CLIP into CONDITIONING is not a fit.
    expect(feeds).toMatchObject({ status: 'rejected', result: { error: 'Port types cannot be connected.' } });
    expect(inside(db, 'c4', OUTER_ID, { type: 'connect', source: SUBGRAPH_INPUT_NODE_ID, sourceHandle: 'out-7', target: nodeId, targetHandle: 'in-1' }))
      .toMatchObject({ status: 'rejected', result: { error: 'Subgraph slot was not found.' } });

    const exportedOuter = definitionOf(exported(db), OUTER_ID);
    expectWellFormed(exportedOuter);
    const link = exportedOuter.links.find((item: { target_id: number }) => item.target_id === -20);
    expect(link.origin_id).toBe(Number(nodeId));
    expect(exportedOuter.outputs[0].linkIds).toEqual([link.id]);
    // Link ids continue the definition's own counter (OUTER had 3).
    expect(Math.min(...exportedOuter.links.filter((item: { id: number }) => item.id > 3).map((item: { id: number }) => item.id))).toBe(4);
    db.close();
  });

  it('wires an input slot into a new inner node', () => {
    const db = openDb();
    importNested(db);
    const added = inside(db, 'add', INNER_ID, { type: 'add-node', nodeType: 'CLIPTextEncode', x: 0, y: 300 });
    const nodeId = String((added.result as { nodeId: string }).nodeId);
    expect(nodeId).toBe('2');
    const clip = def(db, INNER_ID).nodes.find((node) => String(node.id) === nodeId)!.data.inputs.find((port: { name: string }) => port.name === 'clip');
    expect(inside(db, 'c', INNER_ID, { type: 'connect', source: SUBGRAPH_INPUT_NODE_ID, sourceHandle: 'out-0', target: nodeId, targetHandle: clip.id }).status).toBe('applied');
    const slotLinks = definitionOf(exported(db), INNER_ID).inputs[0].linkIds;
    expect(slotLinks).toHaveLength(2);
    expectWellFormed(definitionOf(exported(db), INNER_ID));
    db.close();
  });
});

describe('nesting definitions', () => {
  it('places an instance of another definition inside, with its ports, and the instance is listed under the holder', () => {
    const db = openDb();
    importNested(db);
    const placed = inside(db, 'nest', OUTER_ID, { type: 'insert-subgraph', definitionId: INNER_ID, x: 0, y: 300 });
    expect(placed.status).toBe('applied');
    expect(placed.result).toMatchObject({ definitionId: INNER_ID, nodeId: '3' });
    const node = def(db, OUTER_ID).nodes.find((item) => String(item.id) === '3')!;
    expect(node.data).toMatchObject({ kind: 'subgraph-instance', subgraphId: INNER_ID, comfyType: INNER_ID });
    expect(node.data.inputs).toHaveLength(1);
    expect(definitionOf(exported(db), OUTER_ID).nodes.find((item: { id: number }) => item.id === 3).type).toBe(INNER_ID);
    db.close();
  });

  it('refuses a definition inside itself, directly or through another, with a plain sentence', () => {
    const db = openDb();
    importNested(db);
    const definitions = snap(db).subgraphs!;
    // OUTER already holds INNER: INNER may go into OUTER again, OUTER may not go into INNER.
    expect(nestsItself(definitions, OUTER_ID, INNER_ID)).toBe(false);
    expect(nestsItself(definitions, INNER_ID, OUTER_ID)).toBe(true);
    expect(nestsItself(definitions, OUTER_ID, OUTER_ID)).toBe(true);
    expect(inside(db, 'self', OUTER_ID, { type: 'insert-subgraph', definitionId: OUTER_ID, x: 0, y: 0 }))
      .toMatchObject({ status: 'rejected', result: { error: 'A subgraph cannot be placed inside itself.' } });
    // OUTER holds INNER: OUTER inside INNER would make INNER hold itself through OUTER.
    expect(inside(db, 'cycle', INNER_ID, { type: 'insert-subgraph', definitionId: OUTER_ID, x: 0, y: 0 }))
      .toMatchObject({ status: 'rejected', result: { error: 'A subgraph cannot be placed inside itself.' } });
    expect(inside(db, 'missing', INNER_ID, { type: 'insert-subgraph', definitionId: 'nope', x: 0, y: 0 }).status).toBe('rejected');
    db.close();
  });

  it('a slot added to a definition shows at once on its instances inside other definitions and on the root', () => {
    const db = openDb();
    importNested(db);
    const added = inside(db, 'add', INNER_ID, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 0, y: 300 });
    const nodeId = String((added.result as { nodeId: string }).nodeId);
    expect(commit(db, 'io', { type: 'add-subgraph-io', definitionId: INNER_ID, direction: 'output', name: 'zero', dataType: 'CONDITIONING', nodeId, handle: 'out-0' }).status).toBe('applied');
    const instance = def(db, OUTER_ID).nodes.find((node) => node.data?.comfyType === INNER_ID)!;
    expect(instance.data.outputs.map((port: { name: string }) => port.name)).toEqual(['CONDITIONING', 'zero']);
    db.close();
  });
});

describe('export after inner edits', () => {
  it('round-trips through export and import with well-formed definitions', () => {
    const db = openDb();
    importNested(db);
    const added = inside(db, 'add', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningCombine', x: 600, y: 200 });
    const nodeId = String((added.result as { nodeId: string }).nodeId);
    inside(db, 'c1', OUTER_ID, { type: 'connect', source: '1', sourceHandle: 'out-0', target: nodeId, targetHandle: 'in-0' });
    inside(db, 'c2', OUTER_ID, { type: 'connect', source: nodeId, sourceHandle: 'out-0', target: SUBGRAPH_OUTPUT_NODE_ID, targetHandle: 'in-0' });
    inside(db, 'rm', OUTER_ID, { type: 'remove-node', nodeId: '2' });
    inside(db, 'nest', INNER_ID, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 0, y: 300 });
    const workflow = exported(db);
    for (const item of workflow.definitions.subgraphs) expectWellFormed(item);
    expect(definitionOf(workflow, OUTER_ID).nodes.map((node: { id: number }) => node.id)).toEqual([1, 3]);
    expect(definitionOf(workflow, OUTER_ID).extra).toEqual({ innerVendor: 'keep-outer' });

    const other = openDb();
    expect(commit(other, 'import', { type: 'import-workflow', document: structuredClone(workflow) }).status).toBe('applied');
    const again = exported(other);
    expect(again.definitions).toEqual(workflow.definitions);
    expect(again.nodes).toEqual(workflow.nodes);
    expect(again.links).toEqual(workflow.links);
    // After the round trip a new inner node still gets a fresh id.
    expect(inside(other, 'add', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 0, y: 0 }).result).toMatchObject({ nodeId: '4' });
    db.close();
    other.close();
  });
});

describe('inner ids and the explanations kept by them', () => {
  const zeroOut = (id: string): ObjectRef => ({ kind: 'node', id, classType: 'ConditioningZeroOut', subgraphId: OUTER_ID });
  const write = (db: Database.Database, owner: ObjectRef, text: string) => saveExplanation(db, {
    projectId: P, owner, aspect: 'what', text, provenance: 'user', sourceUrl: null, revisionId: head(db).currentRevisionId, createdBy: 'user',
  });
  const texts = (db: Database.Database, owner: ObjectRef) => listExplanations(db, { projectId: P, owner }).map((item) => item.text);

  it('never gives the number of a deleted inner node to a new node, so its description never lands on another node', () => {
    const db = openDb();
    importNested(db);
    write(db, zeroOut('2'), 'Silences the prompt.');
    const beforeDelete = head(db).currentRevisionId;
    // Node 2 is the highest inner id of OUTER: deleting it must not free its number.
    expect(inside(db, 'rm', OUTER_ID, { type: 'remove-node', nodeId: '2' }).status).toBe('applied');
    // Deleting keeps the description: an undo brings the node back with it.
    expect(texts(db, zeroOut('2'))).toEqual(['Silences the prompt.']);
    const added = inside(db, 'add', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 300, y: 0 });
    const newId = String((added.result as { nodeId: string }).nodeId);
    expect(newId).toBe('3');
    expect(texts(db, zeroOut(newId))).toEqual([]);
    // A node added inside can be described at once, under its definition.
    write(db, zeroOut(newId), 'The new one.');
    expect(listExplanations(db, { projectId: P, owner: zeroOut(newId) })[0].owner).toMatchObject({ id: newId, subgraphId: OUTER_ID });
    // The counter is in the export and survives a save and an open.
    expect(definitionOf(exported(db), OUTER_ID).state.lastNodeId).toBe(3);
    const file = nativeProjectFile(db, P);
    if (!file.ok) throw new Error(file.error);

    // Undo both: node 2 is back, and so is its description.
    undo(db, beforeDelete);
    expect(innerIds(db, OUTER_ID)).toEqual(['1', '2']);
    expect(texts(db, zeroOut('2'))).toEqual(['Silences the prompt.']);
    // A node added now still gets a fresh number.
    expect(inside(db, 'add2', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 300, y: 0 }).result).toMatchObject({ nodeId: '4' });

    const other = openDb();
    expect(openNativeFile(other, P, JSON.parse(JSON.stringify(file.project))).status).toBe('applied');
    expect(innerIds(other, OUTER_ID)).toEqual(['1', '3']);
    expect(inside(other, 'add', OUTER_ID, { type: 'add-node', nodeType: 'ConditioningZeroOut', x: 0, y: 0 }).result).toMatchObject({ nodeId: '4' });
    db.close();
    other.close();
  });
});

describe('subgraph slot names', () => {
  it('gives two ports of the same name distinct slot names from their nodes, and a renamed slot shows on every instance and in the export', () => {
    const db = openDb();
    importNested(db);
    // Two prompts fed by the loader: both inner ports are called "clip".
    const a = commit(db, 'a', { type: 'add-node', nodeType: 'CLIPTextEncode', title: 'Positive', x: 0, y: 400 });
    const b = commit(db, 'b', { type: 'add-node', nodeType: 'CLIPTextEncode', title: 'Negative', x: 0, y: 700 });
    const [first, second] = [a, b].map((item) => String((item.result as { nodeId: string }).nodeId));
    const clip = snap(db).nodes.find((node) => node.id === first)!.data.inputs.find((port: { name: string }) => port.name === 'clip').id;
    commit(db, 'c1', { type: 'connect', source: '1', sourceHandle: 'out-1', target: first, targetHandle: clip });
    commit(db, 'c2', { type: 'connect', source: '1', sourceHandle: 'out-1', target: second, targetHandle: clip });
    const made = commit(db, 'make', { type: 'create-subgraph', name: 'Prompts', nodeIds: [first, second], inputs: [], outputs: [] });
    expect(made.status).toBe('applied');
    const id = String((made.result as { definitionId: string }).definitionId);
    expect(def(db, id).inputs.map((slot) => slot.name)).toEqual(['clip', 'Negative · clip']);
    // Exposing one more "clip" output-side name keeps them apart too.
    const conditioning = def(db, id).nodes.find((node) => String(node.id) === first)!.data.outputs[0];
    commit(db, 'o1', { type: 'add-subgraph-io', definitionId: id, direction: 'output', name: conditioning.name, dataType: 'CONDITIONING', nodeId: first, handle: conditioning.id });
    commit(db, 'o2', { type: 'add-subgraph-io', definitionId: id, direction: 'output', name: conditioning.name, dataType: 'CONDITIONING', nodeId: second, handle: conditioning.id });
    expect(def(db, id).outputs.map((slot) => slot.name)).toEqual(['CONDITIONING', 'Negative · CONDITIONING']);

    // Rename the first input: a second instance, placed inside another definition, follows at once.
    commit(db, 'nest', { type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'insert-subgraph', definitionId: id, x: 0, y: 300 } });
    const before = head(db).currentRevisionId;
    const slotId = def(db, id).inputs[0].id;
    expect(commit(db, 'rn', { type: 'rename-subgraph-io', definitionId: id, direction: 'input', slotId, name: 'Positive · clip' }).status).toBe('applied');
    const rootInstance = snap(db).nodes.find((node) => node.data?.subgraphId === id)!;
    expect(rootInstance.data.inputs.map((port: { name: string }) => port.name)).toEqual(['Positive · clip', 'Negative · clip']);
    const nested = def(db, INNER_ID).nodes.find((node) => node.data?.subgraphId === id)!;
    expect(nested.data.inputs[0].name).toBe('Positive · clip');
    // The export keeps the slot name and writes what it shows as `label`, as ComfyUI does, on the slot and the instance.
    const workflow = exported(db);
    const slot = definitionOf(workflow, id).inputs[0];
    expect(slot).toMatchObject({ name: 'clip', label: 'Positive · clip' });
    expect(workflow.nodes.find((node: { type: string }) => node.type === id).inputs[0]).toMatchObject({ name: 'clip', label: 'Positive · clip' });
    // It round-trips.
    const other = openDb();
    expect(commit(other, 'import', { type: 'import-workflow', document: structuredClone(workflow) }).status).toBe('applied');
    expect(def(other, id).inputs[0]).toMatchObject({ name: 'clip' });
    expect(snap(other).nodes.find((node) => node.data?.subgraphId === id)!.data.inputs[0].name).toBe('Positive · clip');
    // Undo brings the old name back everywhere.
    undo(db, before);
    expect(snap(db).nodes.find((node) => node.data?.subgraphId === id)!.data.inputs[0].name).toBe('clip');
    expect(definitionOf(exported(db), id).inputs[0].label).toBeUndefined();
    // An empty name is refused.
    expect(commit(db, 'rn-empty', { type: 'rename-subgraph-io', definitionId: id, direction: 'input', slotId, name: '  ' }).status).toBe('rejected');
    db.close();
    other.close();
  });
});

describe('every way of adding a node goes into the open subgraph', () => {
  it('scopes add-node, insert-subgraph and boundary links to the open definition', async () => {
    const { scopedToLevel } = await import('../../src/renderer/components/graph/commit');
    const { useGraphStore } = await import('../../src/renderer/state/graphState');
    const db = openDb();
    importNested(db);
    useGraphStore.setState({ subgraphs: snap(db).subgraphs!, nodes: [], activeSubgraphId: OUTER_ID, subgraphPath: [OUTER_ID] });
    // The toolbar search, Ctrl+K, the double click, the context menu, the library and a model card all send add-node.
    const add = { type: 'add-node' as const, nodeType: 'KSampler', x: 1, y: 2 };
    expect(scopedToLevel(add)).toEqual({ type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: add });
    const insert = { type: 'insert-subgraph' as const, definitionId: INNER_ID, x: 1, y: 2 };
    expect(scopedToLevel(insert)).toEqual({ type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: insert });
    const boundary = { type: 'connect' as const, source: SUBGRAPH_INPUT_NODE_ID, sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' };
    expect(scopedToLevel(boundary)).toEqual({ type: 'edit-in-subgraph', definitionId: OUTER_ID, edit: boundary });
    const renameSlot = { type: 'rename-subgraph-io' as const, definitionId: OUTER_ID, direction: 'input' as const, slotId: 'x', name: 'y' };
    expect(scopedToLevel(renameSlot)).toEqual(renameSlot);

    // Lesson actions follow this scope too; lessonInstanceContext covers their real commit/Undo flow.
    useGraphStore.setState({ activeSubgraphId: null, subgraphPath: [] });
    db.close();
  });
});
