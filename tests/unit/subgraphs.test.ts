import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { listSubgraphDefinitions } from '../../src/shared/components/model';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import type { SubgraphDefinition } from '../../src/shared/graph/subgraphs';
import { denseWorkflow } from '../e2e/fixtures/denseWorkflow';
import { typedWorkflow } from '../e2e/fixtures/typedWorkflow';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const AT = '2026-11-08T00:00:00.000Z';

function openDb(file?: string): Database.Database {
  const db = new Database(file ?? ':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function snap(db: Database.Database): GraphSnapshot {
  return readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as GraphSnapshot;
}

function commit(db: Database.Database, actionId: string, payload: Record<string, unknown>, expected?: string) {
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: expected ?? readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

function importDense(db: Database.Database) {
  const imported = commit(db, 'import', { type: 'import-workflow', document: structuredClone(denseWorkflow) });
  expect(imported.status).toBe('applied');
  return imported;
}

function exported(db: Database.Database): Record<string, any> {
  const result = exportWorkflow(snap(db), AT);
  if (!result.ok) throw new Error(result.error);
  return result.workflow as Record<string, any>;
}

function createPromptBlock(db: Database.Database, extra: Record<string, unknown> = {}) {
  return commit(db, 'make-sg', {
    type: 'create-subgraph',
    name: 'Prompt block',
    nodeIds: ['2', '3', '4'],
    inputs: [],
    outputs: [],
    ...extra,
  });
}

describe('create-subgraph', () => {
  it('moves nodes into a new definition and rewires every crossing edge through boundary slots', () => {
    const db = openDb();
    importDense(db);
    const created = createPromptBlock(db, {
      inputs: [{ name: 'model in', type: 'MODEL', nodeId: '4', handle: 'in-0' }],
    });
    expect(created.status).toBe('applied');
    const result = created.result as { definitionId: string; nodeId: string; inputs: number; outputs: number };
    expect(result.definitionId).toMatch(UUID);
    expect(result).toMatchObject({ nodeId: '13', inputs: 3, outputs: 1 });

    const snapshot = snap(db);
    expect(snapshot.nodes).toHaveLength(10);
    expect(snapshot.nodes.some((node) => ['2', '3', '4'].includes(node.id))).toBe(false);
    const instance = snapshot.nodes.find((node) => node.id === '13')!;
    expect(instance.data).toMatchObject({ comfyType: result.definitionId, subgraphId: result.definitionId, kind: 'subgraph-instance', title: 'Prompt block' });
    // Bounding-box centre of node positions (280,20), (280,180), (520,60).
    expect(instance.position).toEqual({ x: 400, y: 100 });
    expect(instance.data.inputs.map((port: { id: string; name: string; dataType: string }) => [port.id, port.name, port.dataType])).toEqual([
      ['in-0', 'model in', 'MODEL'],
      ['in-1', 'clip', 'CLIP'],
      // A second "clip" takes its node's name, so the instance never shows two ports with one name.
      ['in-2', 'Negative · clip', 'CLIP'],
    ]);
    expect(instance.data.outputs.map((port: { id: string; dataType: string }) => [port.id, port.dataType])).toEqual([['out-0', 'LATENT']]);

    const definition = snapshot.subgraphs!.find((item) => item.id === result.definitionId)!;
    expect(definition.nodes.map((node) => node.id)).toEqual(['2', '3', '4']);
    const inner = definition.edges.filter((edge) => edge.source !== '-10' && edge.target !== '-20');
    expect(inner.map((edge) => edge.id)).toEqual(['link-4']);
    expect(definition.edges.filter((edge) => edge.source === '-10').map((edge) => [edge.sourceHandle, edge.target, edge.targetHandle])).toEqual([
      ['out-0', '4', 'in-0'],
      ['out-1', '2', 'in-0'],
      ['out-2', '3', 'in-0'],
    ]);
    expect(definition.edges.filter((edge) => edge.target === '-20').map((edge) => [edge.source, edge.sourceHandle, edge.targetHandle])).toEqual([
      ['4', 'out-0', 'in-0'],
    ]);
    const outer = snapshot.edges.filter((edge) => edge.source === '13' || edge.target === '13');
    expect(outer.map((edge) => [edge.id, edge.source, edge.sourceHandle, edge.target, edge.targetHandle]).sort()).toEqual([
      ['link-1', '1', 'out-1', '13', 'in-1'],
      ['link-2', '1', 'out-1', '13', 'in-2'],
      ['link-3', '1', 'out-0', '13', 'in-0'],
      ['link-5', '13', 'out-0', '5', 'in-0'],
    ]);

    // A component record and the raw-document census both see the new definition.
    expect(snapshot.components!.some((item) => item.ownerKind === 'subgraph' && item.ownerId === result.definitionId)).toBe(true);
    expect(listSubgraphDefinitions(snapshot.document?.raw).definitions.map((item) => item.name)).toEqual(['Prompt block']);
    expect(commit(db, 'doc-sg', { type: 'set-component', ownerKind: 'subgraph', ownerId: result.definitionId, purpose: 'p', usage: 'u' }).status).toBe('applied');
    db.close();
  });

  it('exports the definition in the frontend shape with numeric ids and monotonic counters', () => {
    const db = openDb();
    importDense(db);
    const created = createPromptBlock(db);
    const definitionId = (created.result as { definitionId: string }).definitionId;
    const workflow = exported(db);
    expect(workflow.version).toBe(1);
    expect(workflow.state.lastNodeId).toBe(13);
    expect(workflow.state.lastLinkId).toBeGreaterThanOrEqual(10);
    const instance = workflow.nodes.find((node: { id: number }) => node.id === 13);
    expect(instance.type).toBe(definitionId);
    expect(instance.inputs.map((slot: { name: string; type: string; link: number }) => [slot.name, slot.type, slot.link])).toEqual([
      ['clip', 'CLIP', 1],
      ['Negative · clip', 'CLIP', 2],
      ['model', 'MODEL', 3],
    ]);
    expect(instance.outputs[0]).toMatchObject({ name: 'LATENT', type: 'LATENT', links: [5] });
    expect(workflow.links.find((link: { id: number }) => link.id === 5)).toMatchObject({ origin_id: 13, origin_slot: 0, target_id: 5, target_slot: 0 });
    expect(workflow.links.some((link: { id: number }) => link.id === 4)).toBe(false);

    const [definition] = workflow.definitions.subgraphs;
    expect(definition).toMatchObject({ id: definitionId, version: 1, revision: 0, name: 'Prompt block', config: {}, extra: {}, widgets: [], groups: [] });
    expect(definition.inputNode.id).toBe(-10);
    expect(definition.outputNode.id).toBe(-20);
    expect(definition.nodes.map((node: { id: number }) => node.id)).toEqual([2, 3, 4]);
    for (const link of definition.links) expect(typeof link.id).toBe('number');
    const boundaryIn = definition.links.filter((link: { origin_id: number }) => link.origin_id === -10);
    expect(boundaryIn.map((link: { origin_slot: number; target_id: number; target_slot: number }) => [link.origin_slot, link.target_id, link.target_slot])).toEqual([
      [0, 2, 0],
      [1, 3, 0],
      [2, 4, 0],
    ]);
    expect(definition.inputs.map((slot: { linkIds: number[] }) => slot.linkIds)).toEqual(boundaryIn.map((link: { id: number }) => [link.id]));
    for (const slot of [...definition.inputs, ...definition.outputs]) expect(slot.id).toMatch(UUID);
    const toOutput = definition.links.find((link: { target_id: number }) => link.target_id === -20);
    expect(toOutput).toMatchObject({ origin_id: 4, origin_slot: 0, target_slot: 0, type: 'LATENT' });
    expect(definition.outputs[0].linkIds).toEqual([toOutput.id]);
    const sampler = definition.nodes.find((node: { id: number }) => node.id === 4);
    expect(sampler.inputs[0].link).toBe(boundaryIn[2].id);
    expect(sampler.inputs[1].link).toBe(4);
    expect(definition.state.lastNodeId).toBe(4);
    db.close();
  });

  it('works on a canvas with no imported document', () => {
    const db = openDb();
    commit(db, 'a', { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 });
    commit(db, 'b', { type: 'add-node', nodeType: 'VAEDecode', x: 300, y: 0 });
    const created = commit(db, 'sg', { type: 'create-subgraph', name: 'Decode', nodeIds: ['2'], inputs: [], outputs: [] });
    expect(created.status).toBe('applied');
    expect(created.result).toMatchObject({ nodeId: '3' });
    const snapshot = snap(db);
    expect(snapshot.document?.formatVersion).toBe(1);
    expect(listSubgraphDefinitions(snapshot.document?.raw).definitions).toHaveLength(1);
    const workflow = exported(db);
    expect(workflow.definitions.subgraphs[0].nodes[0].type).toBe('VAEDecode');
    db.close();
  });

  it('rejects empty, unknown, already-moved, mistyped and repeated selections, and conflicts on a stale revision', () => {
    const db = openDb();
    const imported = importDense(db);
    const empty = createPromptBlock(db, { nodeIds: [] });
    expect(empty.status).toBe('rejected');
    const unknown = createPromptBlock(db, { nodeIds: ['2', '99'] });
    expect(unknown).toMatchObject({ status: 'rejected', result: { error: 'Node was not found.' } });
    const typed = createPromptBlock(db, { inputs: [{ name: 'x', type: 'IMAGE', nodeId: '4', handle: 'in-0' }] });
    expect(typed).toMatchObject({ status: 'rejected', result: { error: 'Port types cannot be connected.' } });
    const taken = createPromptBlock(db, { inputs: [{ name: 'x', type: 'CONDITIONING', nodeId: '4', handle: 'in-1' }] });
    expect(taken).toMatchObject({ status: 'rejected', result: { error: 'That inner input is already connected.' } });
    const repeated = createPromptBlock(db, {
      outputs: [
        { name: 'a', type: 'LATENT', nodeId: '4', handle: 'out-0' },
        { name: 'b', type: 'LATENT', nodeId: '4', handle: 'out-0' },
      ],
    });
    expect(repeated).toMatchObject({ status: 'rejected', result: { error: 'A boundary slot repeats an inner port.' } });
    const outside = createPromptBlock(db, { inputs: [{ name: 'x', type: 'MODEL', nodeId: '8', handle: 'in-0' }] });
    expect(outside).toMatchObject({ status: 'rejected', result: { error: 'That port is not on the inner node.' } });
    expect(snap(db).nodes).toHaveLength(12);

    expect(createPromptBlock(db).status).toBe('applied');
    const again = commit(db, 'again', { type: 'create-subgraph', name: 'x', nodeIds: ['2'], inputs: [], outputs: [] });
    expect(again).toMatchObject({ status: 'rejected', result: { error: 'A node is already inside a subgraph.' } });
    const stale = commit(db, 'stale', { type: 'create-subgraph', name: 'x', nodeIds: ['6'], inputs: [], outputs: [] }, imported.projection!.currentRevisionId);
    expect(stale.status).toBe('conflict');
    db.close();
  });

  it('refuses subgraphs on a legacy 0.4 canvas', () => {
    const db = openDb();
    commit(db, 'import', {
      type: 'import-workflow',
      document: { version: 0.4, last_node_id: 1, last_link_id: 0, nodes: [{ id: 1, type: 'LoadImage', pos: [0, 0], size: [1, 1], flags: {}, order: 0, mode: 0, properties: {} }], links: [] },
    });
    const refused = commit(db, 'sg', { type: 'create-subgraph', name: 'x', nodeIds: ['1'], inputs: [], outputs: [] });
    expect(refused).toMatchObject({ status: 'rejected', result: { error: 'Subgraphs need workflow format 1.' } });
    db.close();
  });
});

describe('subgraph editing', () => {
  function setup() {
    const db = openDb();
    importDense(db);
    const created = createPromptBlock(db);
    const definitionId = (created.result as { definitionId: string }).definitionId;
    return { db, definitionId };
  }

  function definitionOf(db: Database.Database, id: string): SubgraphDefinition {
    return snap(db).subgraphs!.find((item) => item.id === id)!;
  }

  it('inserts a second instance and keeps the definition while one instance remains', () => {
    const { db, definitionId } = setup();
    const inserted = commit(db, 'ins', { type: 'insert-subgraph', definitionId, x: 900, y: 900, title: 'Copy' });
    expect(inserted.status).toBe('applied');
    expect(inserted.result).toMatchObject({ nodeId: '14', definitionId });
    const copy = snap(db).nodes.find((node) => node.id === '14')!;
    expect(copy.data).toMatchObject({ title: 'Copy', kind: 'subgraph-instance', subgraphId: definitionId });
    expect(copy.data.inputs).toHaveLength(3);
    expect(commit(db, 'ins-x', { type: 'insert-subgraph', definitionId: 'nope', x: 0, y: 0 })).toMatchObject({
      status: 'rejected',
      result: { error: 'Subgraph definition was not found.' },
    });

    const dissolved = commit(db, 'dis', { type: 'dissolve-subgraph', nodeId: '14' });
    expect(dissolved.status).toBe('applied');
    expect(dissolved.result).toMatchObject({ definitionRemoved: false });
    // The original inner ids 2, 3, 4 are free on the canvas, so they come back unchanged.
    expect((dissolved.result as { nodeIds: string[] }).nodeIds).toEqual(['2', '3', '4']);
    expect(definitionOf(db, definitionId)).toBeDefined();
    db.close();
  });

  it('dissolves the last instance back to the original wiring and removes the definition', () => {
    const { db, definitionId } = setup();
    const dissolved = commit(db, 'dis', { type: 'dissolve-subgraph', nodeId: '13' });
    expect(dissolved.status).toBe('applied');
    expect(dissolved.result).toMatchObject({ definitionRemoved: true, nodeIds: ['2', '3', '4'] });
    const snapshot = snap(db);
    expect(snapshot.subgraphs!.some((item) => item.id === definitionId)).toBe(false);
    expect(snapshot.components!.some((item) => item.ownerId === definitionId)).toBe(false);
    expect(snapshot.nodes.map((node) => node.id).sort((a, b) => Number(a) - Number(b))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    const wiring = snapshot.edges.map((edge) => `${edge.source}:${edge.sourceHandle}>${edge.target}:${edge.targetHandle}`).sort();
    const original = denseWorkflow.links.map((link) => `${link.origin_id}:out-${link.origin_slot}>${link.target_id}:in-${link.target_slot}`).sort();
    expect(wiring).toEqual(original);
    // Nodes return around the instance position, keeping their relative layout.
    const sampler = snapshot.nodes.find((node) => node.id === '4')!;
    const positive = snapshot.nodes.find((node) => node.id === '2')!;
    expect(sampler.position.x - positive.position.x).toBe(240);
    const workflow = exported(db);
    expect(workflow.definitions.subgraphs).toEqual([]);
    const linkIds = workflow.links.map((link: { id: number }) => link.id);
    expect(new Set(linkIds).size).toBe(linkIds.length);
    expect(workflow.state.lastLinkId).toBeGreaterThanOrEqual(Math.max(...linkIds));
    expect(commit(db, 'dis-x', { type: 'dissolve-subgraph', nodeId: '1' })).toMatchObject({ status: 'rejected', result: { error: 'That node is not a subgraph instance.' } });
    db.close();
  });

  it('remaps inner ids that collide with canvas ids when dissolving', () => {
    const { db, definitionId } = setup();
    commit(db, 'ins', { type: 'insert-subgraph', definitionId, x: 0, y: 0 });
    commit(db, 'dis-1', { type: 'dissolve-subgraph', nodeId: '13' });
    const dissolved = commit(db, 'dis-2', { type: 'dissolve-subgraph', nodeId: '14' });
    expect(dissolved.status).toBe('applied');
    const ids = (dissolved.result as { nodeIds: string[] }).nodeIds;
    expect(ids.every((id) => /^\d+$/.test(id) && Number(id) > 14)).toBe(true);
    const snapshot = snap(db);
    expect(new Set(snapshot.nodes.map((node) => node.id)).size).toBe(snapshot.nodes.length);
    const [, , sampler] = ids;
    expect(snapshot.edges.some((edge) => edge.source === ids[0] && edge.target === sampler)).toBe(true);
    db.close();
  });

  it('adds, renames and removes boundary slots and keeps instance edges on the right slot', () => {
    const { db, definitionId } = setup();
    const added = commit(db, 'io-add', { type: 'add-subgraph-io', definitionId, direction: 'input', name: 'latent', dataType: 'LATENT', nodeId: '4', handle: 'in-3' });
    expect(added.status).toBe('applied');
    expect(added.result).toMatchObject({ index: 3 });
    const instance = () => snap(db).nodes.find((node) => node.id === '13')!;
    expect(instance().data.inputs.map((port: { name: string }) => port.name)).toEqual(['clip', 'Negative · clip', 'model', 'latent']);
    expect(instance().data.comfy.inputs).toHaveLength(4);
    expect(commit(db, 'io-taken', { type: 'add-subgraph-io', definitionId, direction: 'input', name: 'again', dataType: 'LATENT', nodeId: '4', handle: 'in-3' })).toMatchObject({
      status: 'rejected',
      result: { error: 'That inner input is already connected.' },
    });
    expect(commit(db, 'io-port', { type: 'add-subgraph-io', definitionId, direction: 'output', name: 'x', dataType: 'LATENT', nodeId: '4', handle: 'out-9' })).toMatchObject({
      status: 'rejected',
      result: { error: 'That port is not on the inner node.' },
    });
    const out = commit(db, 'io-out', { type: 'add-subgraph-io', definitionId, direction: 'output', name: 'cond', dataType: 'CONDITIONING', nodeId: '2', handle: 'out-0' });
    expect(out.status).toBe('applied');
    expect(instance().data.outputs).toHaveLength(2);

    // Remove the first input: its outer edge goes, the later slots shift down by one.
    const first = definitionOf(db, definitionId).inputs[0];
    const removed = commit(db, 'io-rm', { type: 'remove-subgraph-io', definitionId, direction: 'input', slotId: first.id });
    expect(removed.status).toBe('applied');
    const definition = definitionOf(db, definitionId);
    expect(definition.inputs.map((slot) => slot.name)).toEqual(['Negative · clip', 'model', 'latent']);
    expect(definition.edges.filter((edge) => edge.source === '-10').map((edge) => [edge.sourceHandle, edge.target, edge.targetHandle])).toEqual([
      ['out-0', '3', 'in-0'],
      ['out-1', '4', 'in-0'],
      ['out-2', '4', 'in-3'],
    ]);
    const outer = snap(db).edges.filter((edge) => edge.target === '13').map((edge) => [edge.id, edge.targetHandle]).sort();
    expect(outer).toEqual([['link-2', 'in-0'], ['link-3', 'in-1']]);
    expect(instance().data.comfy.inputs.map((slot: { name: string }) => slot.name)).toEqual(['Negative · clip', 'model', 'latent']);
    expect(commit(db, 'io-rm-x', { type: 'remove-subgraph-io', definitionId, direction: 'input', slotId: 'missing' })).toMatchObject({
      status: 'rejected',
      result: { error: 'Subgraph slot was not found.' },
    });

    const renamed = commit(db, 'rename', { type: 'rename-subgraph', definitionId, name: 'Prompts' });
    expect(renamed.status).toBe('applied');
    expect(definitionOf(db, definitionId).name).toBe('Prompts');
    expect(instance().data.title).toBe('Prompts');
    const workflow = exported(db);
    expect(workflow.definitions.subgraphs[0].name).toBe('Prompts');
    expect(workflow.definitions.subgraphs[0].inputs.map((slot: { linkIds: number[] }) => slot.linkIds.length)).toEqual([1, 1, 1]);
    expect(workflow.nodes.find((node: { id: number }) => node.id === 13).inputs.map((slot: { link: number | null }) => slot.link)).toEqual([2, 3, null]);
    db.close();
  });

  it('keeps subgraphs through a reopened database file', () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'subgraphs-')), 'app.sqlite');
    const db = openDb(file);
    importDense(db);
    const created = createPromptBlock(db);
    commit(db, 'note', { type: 'annotate-node', nodeId: '13', annotation: 'kept' });
    const before = snap(db);
    db.close();
    const reopened = new Database(file);
    const after = snap(reopened);
    expect(after.subgraphs).toEqual(before.subgraphs);
    expect(after.subgraphs![0].id).toBe((created.result as { definitionId: string }).definitionId);
    expect(after.nodes.find((node) => node.id === '13')!.data.annotations).toEqual(['kept']);
    reopened.close();
  });
});

describe('groups', () => {
  it('adds a group around members, recomputes bounds when a member leaves, and removes it', () => {
    const db = openDb();
    commit(db, 'import', { type: 'import-workflow', document: structuredClone(typedWorkflow) });
    const added = commit(db, 'grp', { type: 'add-group', title: 'Text', nodeIds: ['2', '3'], color: '#335' });
    expect(added.status).toBe('applied');
    expect(added.result).toEqual({ groupId: '1' });
    const group = snap(db).groups![0];
    expect(group).toMatchObject({ id: '1', title: 'Text', nodeIds: ['2', '3'], color: '#335' });
    let workflow = exported(db);
    expect(workflow.groups).toHaveLength(1);
    const [x, y, w, h] = workflow.groups[0].bounding;
    expect(workflow.groups[0]).toMatchObject({ id: 1, title: 'Text', color: '#335' });
    expect(x).toBeLessThanOrEqual(360);
    expect(y).toBeLessThan(40);
    expect(x + w).toBeGreaterThanOrEqual(600);
    expect(y + h).toBeGreaterThanOrEqual(340);
    expect(workflow.state.lastGroupId).toBe(1);

    commit(db, 'move', { type: 'move-node', nodeId: '3', x: 2000, y: 2000 });
    workflow = exported(db);
    const moved = workflow.groups[0].bounding;
    expect(moved[0] + moved[2]).toBeGreaterThanOrEqual(2200);

    commit(db, 'rm-node', { type: 'remove-node', nodeId: '3' });
    expect(snap(db).groups![0].nodeIds).toEqual(['2']);
    expect(commit(db, 'grp-x', { type: 'add-group', title: 'x', nodeIds: ['99'] })).toMatchObject({ status: 'rejected', result: { error: 'Node was not found.' } });
    expect(commit(db, 'rm-grp-x', { type: 'remove-group', groupId: 'nope' })).toMatchObject({ status: 'rejected', result: { error: 'Group was not found.' } });
    expect(commit(db, 'rm-grp', { type: 'remove-group', groupId: '1' }).status).toBe('applied');
    expect(snap(db).groups).toEqual([]);
    expect(exported(db).groups).toEqual([]);
    db.close();
  });

  it('replaces moved members with the instance when a subgraph is created', () => {
    const db = openDb();
    importDense(db);
    commit(db, 'grp', { type: 'add-group', title: 'Row A', nodeIds: ['1', '2', '3', '4', '5'] });
    createPromptBlock(db);
    expect(snap(db).groups![0].nodeIds).toEqual(['1', '5', '13']);
    commit(db, 'dis', { type: 'dissolve-subgraph', nodeId: '13' });
    expect(snap(db).groups![0].nodeIds).toEqual(['1', '5', '2', '3', '4']);
    db.close();
  });
});
