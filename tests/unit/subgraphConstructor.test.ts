/** The constructor authors native graphs, not a second execution format. */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/settings/migrate';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { readCatalog, upsertObjectInfo } from '../../src/main/catalog/repository';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { exportWorkflow, projectWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { mutationFromTool } from '../../src/shared/commands/tools';

const info = { Sampler: { input: { required: { seed: ['INT', { default: 5 }], steps: ['INT', { default: 20 }], model: ['MODEL'] } }, output: ['LATENT'], python_module: 'nodes' } };
function fixture() {
  const db = new Database(':memory:'); migrate(db); ensureWorkspace(db); upsertObjectInfo(db, parseObjectInfo(info));
  let seq = 0;
  const snap = () => readProjection(db, 'desktop')!.snapshot as GraphSnapshot;
  const commit = (payload: unknown) => {
    const result = commitCommand(db, { projectId: 'desktop', actionId: `constructor-${++seq}`, expectedRevisionId: readProjection(db, 'desktop')!.currentRevisionId, actor: 'manual', runId: null, payload });
    return { ...result, result: result.result as Record<string, any> };
  };
  const exported = () => { const result = exportWorkflow(snap(), '2026-11-16T00:00:00Z', readCatalog(db)); if (!result.ok) throw Error(result.error); return result.workflow as Record<string, any>; };
  return { db, snap, commit, exported };
}

describe('native subgraph constructor', () => {
  it('creates an empty finite graph with typed interface ports, then wires added inner nodes', () => {
    const { db, snap, commit, exported } = fixture();
    const created = commit({ type: 'create-subgraph', name: 'Reusable sampler', description: 'Model to samples', nodeIds: [], inputs: [{ name: 'model', type: 'MODEL' }], outputs: [{ name: 'samples', type: 'LATENT' }] });
    expect(created.status).toBe('applied'); const definitionId = created.result.definitionId as string;
    expect(snap().nodes[0].position).toEqual({ x: 300, y: 200 });
    const added = commit({ type: 'edit-in-subgraph', definitionId, edit: { type: 'add-node', nodeType: 'Sampler' } });
    expect(added.status).toBe('applied'); const nodeId = added.result.nodeId as string;
    const modelHandle = snap().subgraphs![0].nodes[0].data.inputs.find((port: { name: string }) => port.name === 'model').id;
    expect(commit({ type: 'edit-in-subgraph', definitionId, edit: { type: 'connect', source: '-10', sourceHandle: 'out-0', target: nodeId, targetHandle: modelHandle } }).status).toBe('applied');
    expect(commit({ type: 'edit-in-subgraph', definitionId, edit: { type: 'connect', source: nodeId, sourceHandle: 'out-0', target: '-20', targetHandle: 'in-0' } }).status).toBe('applied');
    const file = exported(); const definition = file.definitions.subgraphs[0];
    expect(definition.description).toBe('Model to samples'); expect(definition.links).toHaveLength(2);
    expect(definition.inputs[0]).toMatchObject({ name: 'model', type: 'MODEL' });
    expect(file.nodes[0].inputs[0].id).toBe(definition.inputs[0].id);
    const reread = projectWorkflow(file);
    if ('error' in reread) throw Error(reread.error);
    expect(reread.snapshot.subgraphs![0].edges).toHaveLength(2);
    const roundtrip = exportWorkflow(reread.snapshot, '2026-11-16T00:00:00Z', readCatalog(db));
    expect(roundtrip.ok && roundtrip.workflow).toEqual(file); db.close();
  });

  it('keeps per-instance promoted values independent, including reorder, removal and dissolve', () => {
    const { db, snap, commit, exported } = fixture();
    const added = commit({ type: 'add-node', nodeType: 'Sampler' }); const nodeId = added.result.nodeId as string;
    const made = commit({ type: 'create-subgraph', name: 'Sampler block', nodeIds: [nodeId], widgets: [{ nodeId, name: 'seed' }, { nodeId, name: 'steps' }] });
    expect(made.status).toBe('applied'); const definitionId = made.result.definitionId as string; const firstId = made.result.nodeId as string;
    const second = commit({ type: 'insert-subgraph', definitionId, x: 600, y: 200 }); const secondId = second.result.nodeId as string;
    expect(commit({ type: 'set-parameter', nodeId: firstId, key: 'widgets::1', widgetIndex: 1, value: 99 }).status).toBe('applied');
    const widgets = (id: string) => snap().nodes.find((node) => node.id === id)!.data.comfy.widgets_values;
    expect(widgets(firstId)).toEqual([5, 99]); expect(widgets(secondId)).toEqual([5, 20]);
    expect(commit({ type: 'configure-subgraph', definitionId, name: 'Ordered block', widgets: [{ nodeId, name: 'steps' }, { nodeId, name: 'seed' }] }).status).toBe('applied');
    expect(widgets(firstId)).toEqual([99, 5]); expect(widgets(secondId)).toEqual([20, 5]);
    const file = exported();
    expect(file.definitions.subgraphs[0].widgets).toEqual([{ id: nodeId, name: 'steps' }, { id: nodeId, name: 'seed' }]);
    expect(file.nodes.find((node: any) => String(node.id) === firstId).properties.proxyWidgets).toEqual([[nodeId, 'steps'], [nodeId, 'seed']]);
    expect(commit({ type: 'configure-subgraph', definitionId, name: 'Steps only', widgets: [{ nodeId, name: 'steps' }] }).status).toBe('applied');
    expect(widgets(firstId)).toEqual([99]); expect(widgets(secondId)).toEqual([20]);
    expect(commit({ type: 'dissolve-subgraph', nodeId: firstId }).status).toBe('applied');
    expect(snap().nodes.find((node) => node.data.comfyType === 'Sampler')!.data.comfy.widgets_values[2]).toBe(99);
    expect(widgets(secondId)).toEqual([20]); db.close();
  });

  it('creates nested definitions without losing their contents and refuses recursive insertion', () => {
    const { db, snap, commit, exported } = fixture();
    const parent = commit({ type: 'create-subgraph', name: 'Outer', nodeIds: [] }).result.definitionId as string;
    const child = commit({ type: 'edit-in-subgraph', definitionId: parent, edit: { type: 'create-subgraph', name: 'Inner', nodeIds: [] } });
    expect(child.status).toBe('applied'); const childId = child.result.definitionId as string;
    expect(snap().subgraphs).toHaveLength(2);
    expect(snap().subgraphs!.find((item) => item.id === parent)!.nodes[0].data.subgraphId).toBe(childId);
    expect(commit({ type: 'edit-in-subgraph', definitionId: childId, edit: { type: 'insert-subgraph', definitionId: parent, x: 0, y: 0 } }).status).toBe('rejected');
    expect(exported().definitions.subgraphs).toHaveLength(2); db.close();
  });

  it('requires explicit legacy upgrade and refuses invalid widget bindings atomically', () => {
    const { db, commit, exported, snap } = fixture();
    commit({ type: 'import-workflow', document: { version: 0.4, last_node_id: 0, last_link_id: 0, nodes: [], links: [], groups: [] } });
    expect(commit({ type: 'create-subgraph', name: 'No upgrade', nodeIds: [] }).status).toBe('rejected');
    expect(commit({ type: 'create-subgraph', name: 'Bad source', nodeIds: [], upgradeToV1: true, widgets: [{ nodeId: 'missing', name: 'steps' }] }).status).toBe('rejected');
    expect(snap().document!.formatVersion).toBe(0.4);
    expect(commit({ type: 'create-subgraph', name: 'Native', nodeIds: [], upgradeToV1: true }).status).toBe('applied');
    expect(exported().version).toBe(1); db.close();
  });

  it('offers the same empty/typed construction and configuration to the agent', () => {
    const { db, commit, snap } = fixture();
    const create = mutationFromTool('createSubgraph', { name: 'Agent graph', nodeIds: [], inputs: [{ name: 'image', type: 'IMAGE' }] });
    expect(create?.type).toBe('create-subgraph'); const made = commit(create);
    expect(made.status).toBe('applied');
    const configure = mutationFromTool('configureSubgraph', { definitionId: made.result.definitionId, name: 'Agent graph renamed', description: 'Reusable image graph', widgets: [] });
    expect(commit(configure).status).toBe('applied'); expect(snap().subgraphs![0].name).toBe('Agent graph renamed'); db.close();
  });
});
