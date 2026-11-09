import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { cachedCatalog, commitCommand, ensureWorkspace, listRevisions, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { readCatalog, upsertObjectInfo } from '../../src/main/catalog/repository';
import { checkGraph } from '../../src/main/knowledge/check';
import { createProposal, resolveProposal } from '../../src/main/proposals/repository';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { missingOnGraph } from '../../src/shared/graph/compatibility';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import type { Proposal } from '../../src/shared/contracts/proposals';
import { exportWorkflow, projectWorkflow } from '../../src/shared/workflow/codec';
import { denseWorkflow } from '../e2e/fixtures/denseWorkflow';
import { nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';

type Rec = Record<string, any>;

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

const snap = (db: Database.Database) => readProjection(db, P)!.snapshot as Rec;
const commit = (db: Database.Database, actionId: string, payload: Rec) => commitCommand(db, {
  projectId: P, actionId, expectedRevisionId: readProjection(db, P)!.currentRevisionId, actor: 'manual', runId: null, payload,
});
const exported = (db: Database.Database): Rec => {
  const result = exportWorkflow(snap(db) as never, '2026-11-09T00:00:00.000Z');
  if (!result.ok) throw new Error(result.error);
  return result.workflow;
};
const propose = (db: Database.Database, payload: Rec, note = '') => createProposal(db, {
  projectId: P, runId: null, kind: payload.type as Proposal['kind'], payload: payload as Proposal['payload'], note,
});

describe('engine: one link per input', () => {
  it('replaces the link of an already linked input on connect, in the canvas and in export', () => {
    const db = openDb();
    commit(db, 'imp', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
    commit(db, 'loader2', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' });
    const first = commit(db, 'c1', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '3', targetHandle: 'in-0' });
    const second = commit(db, 'c2', { type: 'connect', source: '4', sourceHandle: 'out-0', target: '3', targetHandle: 'in-0' });
    expect(first.status).toBe('applied');
    expect(second.status).toBe('applied');
    expect(second.result).toMatchObject({ replacedEdgeIds: [(first.result as Rec).edgeId] });
    const into = (snap(db).edges as Rec[]).filter((edge) => edge.target === '3' && edge.targetHandle === 'in-0');
    expect(into.map((edge) => edge.source)).toEqual(['4']);
    const workflow = exported(db);
    const links = (workflow.links as Rec[]).filter((link) => link.target_id === 3 && link.target_slot === 0);
    expect(links).toHaveLength(1);
    expect(links[0].origin_id).toBe(4);
    expect((workflow.nodes as Rec[]).find((node) => node.id === 3)!.inputs[0].link).toBe(links[0].id);
    expect((workflow.nodes as Rec[]).find((node) => node.id === 1)!.outputs[0].links).toEqual([]);
    db.close();
  });

  it('replaces the link at the new input on retarget-edge', () => {
    const db = openDb();
    commit(db, 'a', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' });
    commit(db, 'b', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' });
    commit(db, 'k', { type: 'add-node', nodeType: 'KSampler' });
    commit(db, 'k2', { type: 'add-node', nodeType: 'KSampler' });
    const kept = commit(db, 'c1', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '3', targetHandle: 'in-0' });
    const moving = commit(db, 'c2', { type: 'connect', source: '2', sourceHandle: 'out-0', target: '4', targetHandle: 'in-0' });
    const moved = commit(db, 'rt', { type: 'retarget-edge', edgeId: (moving.result as Rec).edgeId, target: '3', targetHandle: 'in-0' });
    expect(moved.status).toBe('applied');
    expect(moved.result).toMatchObject({ replacedEdgeIds: [(kept.result as Rec).edgeId] });
    const edges = snap(db).edges as Rec[];
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ source: '2', target: '3', targetHandle: 'in-0' });
    expect((exported(db).links as Rec[]).filter((link) => link.target_id === 3)).toHaveLength(1);
    db.close();
  });
});

describe('engine: numeric node ids', () => {
  it('gives add-node after an import the next id above lastNodeId and advances the counter', () => {
    const db = openDb();
    commit(db, 'imp', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
    const lastNodeId = nestedSubgraphWorkflow.state.lastNodeId;
    const added = commit(db, 'add', { type: 'add-node', nodeType: 'KSampler' });
    const inner = (snap(db).subgraphs as Rec[]).flatMap((definition) => definition.nodes.map((node: Rec) => Number(node.id)));
    const id = Number((added.result as Rec).nodeId);
    expect(id).toBeGreaterThan(Math.max(lastNodeId, ...inner.filter((value) => Number.isFinite(value))));
    const workflow = exported(db);
    expect((workflow.nodes as Rec[]).map((node) => node.id).every((value) => typeof value === 'number')).toBe(true);
    expect((workflow.state as Rec).lastNodeId).toBe(id);
    db.close();
  });

  it('numbers nodes from 1 on a blank canvas, never reuses an id after a removal, and exports last_node_id', () => {
    const db = openDb();
    expect((commit(db, 'a', { type: 'add-node', nodeType: 'KSampler' }).result as Rec).nodeId).toBe('1');
    expect((commit(db, 'b', { type: 'add-node', nodeType: 'VAEDecode' }).result as Rec).nodeId).toBe('2');
    commit(db, 'rm', { type: 'remove-node', nodeId: '2' });
    expect((commit(db, 'c', { type: 'add-node', nodeType: 'VAEDecode' }).result as Rec).nodeId).toBe('3');
    const workflow = exported(db);
    expect((workflow.nodes as Rec[]).map((node) => node.id)).toEqual([1, 3]);
    expect((workflow.state as Rec).lastNodeId).toBe(3);
    db.close();
  });

  it('renumbers legacy string ids on export, deterministically, links included', () => {
    const snapshot = {
      nodes: [
        { id: 'node-a', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'CheckpointLoaderSimple', inputs: [], outputs: [], parameters: {}, comfy: { id: 'node-a', type: 'CheckpointLoaderSimple', pos: [0, 0] } } },
        { id: '7', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'KSampler', inputs: [], outputs: [], parameters: {} } },
        { id: 'node-b', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'KSampler', inputs: [], outputs: [], parameters: {} } },
      ],
      edges: [{ id: 'link-1', source: 'node-a', target: 'node-b', sourceHandle: 'out-0', targetHandle: 'in-0', data: { dataType: 'MODEL', linkId: 1, comfyLink: { id: 1, origin_id: 'node-a', origin_slot: 0, target_id: 'node-b', target_slot: 0, type: 'MODEL' } } }],
      document: null,
    };
    const first = exportWorkflow(snapshot, 'x');
    const second = exportWorkflow(snapshot, 'x');
    if (!first.ok || !second.ok) throw new Error('export failed');
    expect(first.workflow).toEqual(second.workflow);
    expect((first.workflow.nodes as Rec[]).map((node) => node.id)).toEqual([8, 7, 9]);
    expect((first.workflow.links as Rec[])[0]).toMatchObject({ origin_id: 8, target_id: 9 });
    expect((first.workflow.state as Rec).lastNodeId).toBe(9);
  });
});

describe('engine: dissolve', () => {
  it('joins a pass-through slot straight to the outer targets and leaves no boundary id at the root', () => {
    const db = openDb();
    const wf: Rec = structuredClone(nestedSubgraphWorkflow);
    const outer = wf.definitions.subgraphs[0];
    outer.inputs.push({ id: 'pp-in', name: 'cond', type: 'CONDITIONING', linkIds: [9] });
    outer.outputs.push({ id: 'pp-out', name: 'cond', type: 'CONDITIONING', linkIds: [9] });
    outer.links.push({ id: 9, origin_id: -10, origin_slot: 1, target_id: -20, target_slot: 1, type: 'CONDITIONING' });
    wf.nodes[1].inputs.push({ name: 'cond', type: 'CONDITIONING', link: 10 });
    wf.nodes[1].outputs.push({ name: 'cond', type: 'CONDITIONING', links: [11] });
    wf.nodes.push({ id: 4, type: 'ConditioningZeroOut', pos: [0, 400], inputs: [], outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [10] }] });
    wf.links.push({ id: 10, origin_id: 4, origin_slot: 0, target_id: 2, target_slot: 1, type: 'CONDITIONING' });
    wf.links.push({ id: 11, origin_id: 2, origin_slot: 1, target_id: 3, target_slot: 2, type: 'CONDITIONING' });
    expect(commit(db, 'imp', { type: 'import-workflow', document: wf }).status).toBe('applied');
    expect(commit(db, 'dis', { type: 'dissolve-subgraph', nodeId: '2' }).status).toBe('applied');
    const edges = snap(db).edges as Rec[];
    expect(edges.filter((edge) => ['-10', '-20'].includes(String(edge.source)) || ['-10', '-20'].includes(String(edge.target)))).toEqual([]);
    expect(edges.filter((edge) => edge.source === '4').map((edge) => [edge.target, edge.targetHandle])).toEqual([['3', 'in-2']]);
    const links = exported(db).links as Rec[];
    expect(links.some((link) => link.origin_id < 0 || link.target_id < 0)).toBe(false);
    db.close();
  });
});

describe('engine: missing nodes follow the live graph', () => {
  it('reports nothing once the unknown node is removed, and never a subgraph instance or a frontend node', () => {
    const db = openDb();
    const wf: Rec = structuredClone(nestedSubgraphWorkflow);
    wf.nodes.push({ id: 9, type: 'TotallyMissingNode', pos: [0, 0] });
    wf.nodes.push({ id: 10, type: 'Note', pos: [0, 0], widgets_values: ['hi'] });
    commit(db, 'imp', { type: 'import-workflow', document: wf });
    const catalog = readCatalog(db);
    const before = missingOnGraph(snap(db).nodes, catalog, snap(db).document.raw);
    expect(before.missingNodes).toContain('TotallyMissingNode');
    expect(before.missingNodes).not.toContain('Note');
    expect(before.missingNodes.some((type) => type.startsWith('aaaaaaaa') || type.startsWith('bbbbbbbb'))).toBe(false);
    expect(commit(db, 'rm', { type: 'remove-node', nodeId: '9' }).status).toBe('applied');
    const after = missingOnGraph(snap(db).nodes, catalog, snap(db).document.raw);
    expect(after.missingNodes).not.toContain('TotallyMissingNode');
    expect(checkGraph(db, P).unknownNodeTypes).not.toContain('TotallyMissingNode');
    expect(snap(db).document.raw.nodes).toEqual([]);
    expect(snap(db).document.raw.links).toEqual([]);
    db.close();
  });
});

describe('engine: refusals and records', () => {
  it('rejects remove-node and remove-edge with unknown ids without a new revision', () => {
    const db = openDb();
    commit(db, 'a', { type: 'add-node', nodeType: 'KSampler' });
    const seq = readProjection(db, P)!.revSeq;
    expect(commit(db, 'rn', { type: 'remove-node', nodeId: 'nope' }).status).toBe('rejected');
    expect(commit(db, 're', { type: 'remove-edge', edgeId: 'nope' }).status).toBe('rejected');
    expect(readProjection(db, P)!.revSeq).toBe(seq);
    db.close();
  });

  it('keeps component records of nodes moved into a subgraph and brings them back on dissolve', () => {
    const db = openDb();
    commit(db, 'imp', { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    expect(commit(db, 'comp', { type: 'set-component', ownerKind: 'node', ownerId: '2', purpose: 'p', usage: 'u' }).status).toBe('applied');
    const made = commit(db, 'sg', { type: 'create-subgraph', name: 'S', nodeIds: ['2', '3', '4'], inputs: [], outputs: [] });
    expect(made.status).toBe('applied');
    const record = () => (snap(db).components as Rec[]).find((item) => item.ownerKind === 'node' && item.ownerId === '2');
    expect(record()).toMatchObject({ purpose: 'p', usage: 'u' });
    // Another component edit must not drop it either.
    commit(db, 'comp2', { type: 'set-component', ownerKind: 'node', ownerId: '1', purpose: 'x', usage: '' });
    expect(record()).toMatchObject({ purpose: 'p', usage: 'u' });
    expect(commit(db, 'dis', { type: 'dissolve-subgraph', nodeId: String((made.result as Rec).nodeId) }).status).toBe('applied');
    expect((snap(db).nodes as Rec[]).some((node) => node.id === '2')).toBe(true);
    expect(record()).toMatchObject({ purpose: 'p', usage: 'u' });
    db.close();
  });

  it('lists the newest revisions, oldest first among them', () => {
    const db = openDb();
    for (let index = 0; index < 5; index += 1) commit(db, `a${index}`, { type: 'add-node', nodeType: 'KSampler' });
    const revisions = listRevisions(db, P, 3);
    expect(revisions.map((item) => item.revSeq)).toEqual([4, 5, 6]);
    db.close();
  });
});

describe('engine: proposals', () => {
  it('accepts a proposal that removes its own node without a superseded note', () => {
    const db = openDb();
    commit(db, 'imp', { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    const proposal = propose(db, { type: 'remove-node', nodeId: '2' }, 'drop it');
    const resolved = resolveProposal(db, { projectId: P, proposalId: proposal.id, decision: 'accept' });
    expect(resolved.proposal).toMatchObject({ status: 'accepted', note: 'drop it' });
    db.close();
  });

  it('supersedes open proposals when a workflow is imported over them', () => {
    const db = openDb();
    commit(db, 'imp', { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    const proposal = propose(db, { type: 'set-parameter', nodeId: '3', key: 'seed', value: 5, widgetIndex: 0 });
    commit(db, 'imp2', { type: 'import-workflow', document: structuredClone(nestedSubgraphWorkflow) });
    const resolved = resolveProposal(db, { projectId: P, proposalId: proposal.id, decision: 'accept' });
    expect(resolved.proposal.status).toBe('superseded');
    expect(resolved.command).toBeNull();
    db.close();
  });

  it('supersedes a proposal whose node is missing or changed class type', () => {
    const db = openDb();
    commit(db, 'imp', { type: 'import-workflow', document: structuredClone(denseWorkflow) });
    const missing = propose(db, { type: 'remove-node', nodeId: 'ghost-999' });
    expect(resolveProposal(db, { projectId: P, proposalId: missing.id, decision: 'accept' }).proposal.status).toBe('superseded');
    const moved = propose(db, { type: 'remove-node', nodeId: '3' });
    commit(db, 'mv', { type: 'move-node', nodeId: '3', x: 1, y: 1 });
    // Simulate a node that kept its id but changed class (e.g. the revision table was edited by an older build).
    const row = db.prepare('SELECT id, nodes FROM graph_revisions WHERE id = ?').get(readProjection(db, P)!.currentRevisionId) as { id: string; nodes: string };
    const nodes = JSON.parse(row.nodes) as Rec[];
    nodes.find((node) => node.id === '3')!.data.comfyType = 'SomethingElse';
    db.prepare('UPDATE graph_revisions SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), row.id);
    const resolved = resolveProposal(db, { projectId: P, proposalId: moved.id, decision: 'accept' });
    expect(resolved.proposal.status).toBe('superseded');
    expect(resolved.proposal.note).toContain('changed type');
    db.close();
  });
});

describe('engine: catalog cache and codec details', () => {
  it('serves a cached catalog and drops it when the catalog changes', () => {
    const db = openDb();
    const first = cachedCatalog(db);
    expect(cachedCatalog(db)).toBe(first);
    upsertObjectInfo(db, parseObjectInfo({ NewThing: { input: { required: {} }, output: [], output_name: [], name: 'NewThing', display_name: 'N', category: 'x', python_module: 'nodes' } }));
    const second = cachedCatalog(db);
    expect(second).not.toBe(first);
    expect(second.nodeTypes).toContain('NewThing');
    db.prepare('UPDATE node_catalog SET widget_order_json = ? WHERE class_type = ?').run('{"reliable":false,"order":[]}', 'NewThing');
    expect(cachedCatalog(db)).not.toBe(second);
    db.close();
  });

  it('keeps links: null on unconnected legacy outputs and assigns groups by node centre', () => {
    const wf = {
      last_node_id: 2, last_link_id: 0, version: 0.4,
      nodes: [
        { id: 1, type: 'A', pos: [0, 0], size: [200, 100], outputs: [{ name: 'X', type: 'X', links: null }] },
        // Top-left inside the group, centre outside.
        { id: 2, type: 'B', pos: [390, 0], size: [400, 100], outputs: [] },
      ],
      links: [],
      groups: [{ title: 'G', bounding: [-10, -50, 420, 300] }],
      extra: {},
    };
    const projected = projectWorkflow(structuredClone(wf));
    if ('error' in projected) throw new Error(projected.error);
    expect(projected.snapshot.groups![0].nodeIds).toEqual(['1']);
    const result = exportWorkflow(projected.snapshot, 'x');
    if (!result.ok) throw new Error(result.error);
    expect((result.workflow.nodes as Rec[])[0].outputs[0].links).toBeNull();
  });
});
