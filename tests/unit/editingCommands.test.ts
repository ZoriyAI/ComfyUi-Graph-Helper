/**
 * The editing commands of the canvas (main/commands/editOps.ts) through the real engine: bypass and mute, notes,
 * editor nodes (Note, Reroute, Primitive), a node placed on a link, a node replaced by another class, and colours.
 * Each edit must be one revision (one undo step), refuse with a sentence where it cannot apply, and come out in the
 * workflow file the way ComfyUI's own frontend writes it.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID as P } from '../../src/shared/project';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { cachedCatalog } from '../../src/main/commands/commit';

const INFO = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['a.safetensors', 'b.safetensors']] } },
    output: ['MODEL', 'CLIP', 'VAE'], output_name: ['MODEL', 'CLIP', 'VAE'], name: 'CheckpointLoaderSimple', display_name: 'Load Checkpoint', category: 'loaders', python_module: 'nodes',
  },
  LoraLoaderModelOnly: {
    input: { required: { model: ['MODEL'], lora_name: [['x.safetensors']], strength_model: ['FLOAT', { default: 1, min: -10, max: 10, step: 0.01 }] } },
    output: ['MODEL'], output_name: ['MODEL'], name: 'LoraLoaderModelOnly', display_name: 'LoraLoaderModelOnly', category: 'loaders', python_module: 'nodes',
  },
  KSampler: {
    input: { required: {
      model: ['MODEL'], seed: ['INT', { default: 0, min: 0, max: 100000 }], steps: ['INT', { default: 20, min: 1, max: 100 }],
      cfg: ['FLOAT', { default: 8, min: 0, max: 30 }], sampler_name: [['euler', 'dpmpp_2m']], scheduler: [['normal', 'karras']],
      positive: ['CONDITIONING'], negative: ['CONDITIONING'], latent_image: ['LATENT'], denoise: ['FLOAT', { default: 1, min: 0, max: 1 }],
    } },
    output: ['LATENT'], output_name: ['LATENT'], name: 'KSampler', display_name: 'KSampler', category: 'sampling', python_module: 'nodes',
  },
  KSamplerAdvanced: {
    input: { required: {
      model: ['MODEL'], add_noise: [['enable', 'disable']], noise_seed: ['INT', { default: 0, min: 0, max: 100000 }], steps: ['INT', { default: 20, min: 1, max: 100 }],
      cfg: ['FLOAT', { default: 8, min: 0, max: 30 }], sampler_name: [['euler', 'dpmpp_2m']], scheduler: [['normal', 'karras']],
      positive: ['CONDITIONING'], negative: ['CONDITIONING'], latent_image: ['LATENT'], start_at_step: ['INT', { default: 0 }], end_at_step: ['INT', { default: 10000 }],
      return_with_leftover_noise: [['disable', 'enable']],
    } },
    output: ['LATENT'], output_name: ['LATENT'], name: 'KSamplerAdvanced', display_name: 'KSampler (Advanced)', category: 'sampling', python_module: 'nodes',
  },
  EmptyLatentImage: {
    input: { required: { width: ['INT', { default: 512, min: 16, max: 4096 }], height: ['INT', { default: 512, min: 16, max: 4096 }], batch_size: ['INT', { default: 1, min: 1, max: 64 }] } },
    output: ['LATENT'], output_name: ['LATENT'], name: 'EmptyLatentImage', display_name: 'Empty Latent Image', category: 'latent', python_module: 'nodes',
  },
};

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  upsertObjectInfo(db, parseObjectInfo(INFO));
  return db;
}

const head = (db: Database.Database) => readProjection(db, P)!;
const snap = (db: Database.Database) => head(db).snapshot as GraphSnapshot;
const commit = (db: Database.Database, actionId: string, payload: Record<string, unknown>) => commitCommand(db, {
  projectId: P, actionId, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload,
});
const node = (db: Database.Database, id: string) => snap(db).nodes.find((item) => String(item.id) === id) as Record<string, any>;

function exported(db: Database.Database): Record<string, any> {
  const result = exportWorkflow(snap(db), '2026-11-15T00:00:00.000Z', cachedCatalog(db));
  if (!result.ok) throw new Error(result.error);
  return result.workflow as Record<string, any>;
}

/** Checkpoint (1) MODEL → KSampler (2) model, plus an empty latent (3) into the sampler. */
function sampleGraph(db: Database.Database): void {
  commit(db, 'a1', { type: 'add-node', nodeType: 'CheckpointLoaderSimple', x: 0, y: 0 });
  commit(db, 'a2', { type: 'add-node', nodeType: 'KSampler', x: 400, y: 0 });
  commit(db, 'a3', { type: 'add-node', nodeType: 'EmptyLatentImage', x: 0, y: 300 });
  commit(db, 'c1', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' });
  commit(db, 'c2', { type: 'connect', source: '3', sourceHandle: 'out-0', target: '2', targetHandle: 'in-3' });
}

describe('set-node-mode', () => {
  it('bypasses and mutes several nodes in one revision, writes ComfyUI mode numbers, and undo brings them back', () => {
    const db = openDb();
    sampleGraph(db);
    const before = head(db);
    const bypass = commit(db, 'm1', { type: 'set-node-mode', nodeIds: ['1', '2'], mode: 'bypass' });
    expect(bypass.status).toBe('applied');
    expect(bypass.projection!.revSeq).toBe(before.revSeq + 1);
    expect(node(db, '1').data.comfy.mode).toBe(4);
    expect(node(db, '2').data.comfy.mode).toBe(4);
    commit(db, 'm2', { type: 'set-node-mode', nodeIds: ['2'], mode: 'mute' });
    const nodes = exported(db).nodes as Array<Record<string, any>>;
    expect(nodes.find((item) => item.id === 1)!.mode).toBe(4);
    expect(nodes.find((item) => item.id === 2)!.mode).toBe(2);
    commit(db, 'm3', { type: 'set-node-mode', nodeIds: ['1', '2'], mode: 'always' });
    expect(node(db, '1').data.comfy.mode).toBe(0);
    commit(db, 'undo', { type: 'restore-revision', revisionId: before.currentRevisionId });
    expect(node(db, '1').data.comfy.mode).toBe(0);
    db.close();
  });

  it('refuses a node that is not there and changes nothing', () => {
    const db = openDb();
    sampleGraph(db);
    const result = commit(db, 'm1', { type: 'set-node-mode', nodeIds: ['1', '99'], mode: 'mute' });
    expect(result).toMatchObject({ status: 'rejected', result: { error: 'Node was not found.' } });
    expect(node(db, '1').data.comfy.mode).toBe(0);
    db.close();
  });
});

describe('editor nodes', () => {
  it('adds a Note whose text is written as ComfyUI writes it', () => {
    const db = openDb();
    const added = commit(db, 'n1', { type: 'add-node', nodeType: 'Note', title: 'Note', x: 10, y: 20 });
    expect(added.status).toBe('applied');
    expect(commit(db, 't1', { type: 'set-note-text', nodeId: '1', text: 'Seed 42 gives the cat.' }).status).toBe('applied');
    const written = exported(db).nodes[0];
    expect(written).toMatchObject({ id: 1, type: 'Note', title: 'Note', widgets_values: ['Seed 42 gives the cat.'], inputs: [], outputs: [], color: '#432', bgcolor: '#653' });
    db.close();
  });

  it('refuses note text on a node that is not a note', () => {
    const db = openDb();
    sampleGraph(db);
    expect(commit(db, 't1', { type: 'set-note-text', nodeId: '1', text: 'x' })).toMatchObject({ status: 'rejected', result: { error: 'Only a note has text to write.' } });
    db.close();
  });

  it('a Reroute passes a link on and takes the type that comes in', () => {
    const db = openDb();
    sampleGraph(db);
    commit(db, 'r', { type: 'add-node', nodeType: 'Reroute', x: 200, y: 0 });
    expect(commit(db, 'r1', { type: 'connect', source: '1', sourceHandle: 'out-0', target: '4', targetHandle: 'in-0' }).status).toBe('applied');
    expect(node(db, '4').data.outputs[0].dataType).toBe('MODEL');
    expect(commit(db, 'r2', { type: 'connect', source: '4', sourceHandle: 'out-0', target: '2', targetHandle: 'in-0' }).status).toBe('applied');
    const workflow = exported(db);
    const reroute = workflow.nodes.find((item: any) => item.type === 'Reroute');
    expect(reroute.inputs[0].link).not.toBeNull();
    expect(reroute.outputs[0]).toMatchObject({ type: 'MODEL' });
    expect(reroute.outputs[0].links).toHaveLength(1);
    db.close();
  });

  it('a Primitive feeds a field only and takes its type and value', () => {
    const db = openDb();
    sampleGraph(db);
    commit(db, 'p', { type: 'add-node', nodeType: 'PrimitiveNode', title: 'Primitive', x: 0, y: 500 });
    // seed is the fifth input of KSampler: sockets first (model, positive, negative, latent_image), then fields.
    const refused = commit(db, 'p0', { type: 'connect', source: '4', sourceHandle: 'out-0', target: '2', targetHandle: 'in-1' });
    expect(refused).toMatchObject({ status: 'rejected', result: { error: 'A Primitive feeds a field only, not a link input.' } });
    expect(commit(db, 'p1', { type: 'connect', source: '4', sourceHandle: 'out-0', target: '2', targetHandle: 'in-4' }).status).toBe('applied');
    const primitive = node(db, '4');
    expect(primitive.data.outputs[0]).toMatchObject({ name: 'INT', dataType: 'INT' });
    expect(primitive.data.comfy.outputs[0]).toMatchObject({ type: 'INT', widget: { name: 'seed' } });
    expect(primitive.data.comfy.widgets_values).toEqual([0, 'fixed']);
    expect(commit(db, 'p-value', { type: 'set-parameter', nodeId: '4', key: 'widgets::0', widgetIndex: 0, value: 123 }).status).toBe('applied');
    const configured = structuredClone(node(db, '4').data.comfy);
    const steps = node(db, '2').data.inputs.find((input: any) => input.name === 'steps');
    expect(commit(db, 'p-second-link', { type: 'connect', source: '4', sourceHandle: 'out-0', target: '2', targetHandle: steps.id }).status).toBe('applied');
    expect(node(db, '4').data.comfy).toEqual(configured);
    expect(node(db, '4').data.comfy.widgets_values).toEqual([123, 'fixed']);
    db.close();
  });
});

describe('insert-node-on-edge', () => {
  it('places a LoRA between the checkpoint and the sampler in one revision', () => {
    const db = openDb();
    sampleGraph(db);
    const edge = snap(db).edges.find((item) => item.target === '2' && item.targetHandle === 'in-0')!;
    const before = head(db);
    const result = commit(db, 'ins', { type: 'insert-node-on-edge', edgeId: String(edge.id), nodeType: 'LoraLoaderModelOnly', x: 200, y: 0 });
    expect(result.status).toBe('applied');
    expect(result.projection!.revSeq).toBe(before.revSeq + 1);
    const edges = snap(db).edges;
    expect(edges.some((item) => item.id === edge.id)).toBe(false);
    expect(edges.some((item) => item.source === '1' && item.target === '4' && item.targetHandle === 'in-0')).toBe(true);
    expect(edges.some((item) => item.source === '4' && item.target === '2' && item.targetHandle === 'in-0')).toBe(true);
    commit(db, 'undo', { type: 'restore-revision', revisionId: before.currentRevisionId });
    expect(snap(db).edges.some((item) => item.id === edge.id)).toBe(true);
    expect(snap(db).nodes).toHaveLength(3);
    db.close();
  });

  it('refuses a node that takes nothing the link carries, and an unknown class', () => {
    const db = openDb();
    sampleGraph(db);
    const edge = snap(db).edges.find((item) => item.target === '2' && item.targetHandle === 'in-0')!;
    expect(commit(db, 'i1', { type: 'insert-node-on-edge', edgeId: String(edge.id), nodeType: 'EmptyLatentImage', x: 0, y: 0 }))
      .toMatchObject({ status: 'rejected', result: { error: 'The new node has no input for what this link carries.' } });
    expect(commit(db, 'i2', { type: 'insert-node-on-edge', edgeId: String(edge.id), nodeType: 'NoSuchNode', x: 0, y: 0 }))
      .toMatchObject({ status: 'rejected', result: { error: 'This node is not in your ComfyUI, so it cannot be placed here.' } });
    expect(snap(db).nodes).toHaveLength(3);
    db.close();
  });
});

describe('replace-node', () => {
  it('puts KSampler (Advanced) in the place of KSampler and keeps links and values that fit', () => {
    const db = openDb();
    sampleGraph(db);
    commit(db, 'v', { type: 'set-parameter', nodeId: '2', key: 'steps', value: 33 });
    commit(db, 'mode', { type: 'set-node-mode', nodeIds: ['2'], mode: 'bypass' });
    const result = commit(db, 'rep', { type: 'replace-node', nodeId: '2', nodeType: 'KSamplerAdvanced' });
    expect(result.status).toBe('applied');
    expect(result.result).toMatchObject({ nodeId: '2', nodeType: 'KSamplerAdvanced', droppedLinks: 0 });
    const sampler = node(db, '2');
    expect(sampler.data.comfyType).toBe('KSamplerAdvanced');
    expect(sampler.data.parameters.steps).toBe(33);
    expect(sampler.data.comfy.mode).toBe(4);
    const edges = snap(db).edges.filter((item) => item.target === '2');
    const inputs = sampler.data.inputs as Array<{ id: string; name: string }>;
    expect(edges.map((item) => inputs.find((port) => port.id === item.targetHandle)!.name).sort()).toEqual(['latent_image', 'model']);
    const written = exported(db).nodes.find((item: any) => item.id === 2);
    expect(written.type).toBe('KSamplerAdvanced');
    expect(written.inputs.find((slot: any) => slot.name === 'model').link).not.toBeNull();
    db.close();
  });

  it('refuses the same class, a class not in ComfyUI and an editor node', () => {
    const db = openDb();
    sampleGraph(db);
    expect(commit(db, 'r1', { type: 'replace-node', nodeId: '2', nodeType: 'KSampler' }).result).toMatchObject({ error: 'The node already is of that kind.' });
    expect(commit(db, 'r2', { type: 'replace-node', nodeId: '2', nodeType: 'Nope' }).result).toMatchObject({ error: 'This node is not in your ComfyUI, so it cannot be placed here.' });
    commit(db, 'n', { type: 'add-node', nodeType: 'Note', x: 0, y: 0 });
    expect(commit(db, 'r3', { type: 'replace-node', nodeId: '4', nodeType: 'KSampler' }).result).toMatchObject({ error: 'Subgraphs, notes, reroutes and primitives cannot be replaced by another node.' });
    db.close();
  });
});

describe('colours', () => {
  it('colours nodes and a group with ComfyUI palette values and takes the colour off again', () => {
    const db = openDb();
    sampleGraph(db);
    commit(db, 'c', { type: 'set-node-color', nodeIds: ['1', '2'], color: 'green' });
    expect(node(db, '1').data.comfy).toMatchObject({ color: '#232', bgcolor: '#353' });
    commit(db, 'g', { type: 'add-group', title: 'Load', nodeIds: ['1'] });
    commit(db, 'gc', { type: 'set-group-color', groupId: '1', color: 'blue' });
    const workflow = exported(db);
    expect(workflow.groups[0].color).toBe('#88A');
    expect(workflow.nodes.find((item: any) => item.id === 2)).toMatchObject({ color: '#232', bgcolor: '#353' });
    commit(db, 'c0', { type: 'set-node-color', nodeIds: ['1'], color: null });
    expect(node(db, '1').data.comfy.color).toBeUndefined();
    expect(commit(db, 'gx', { type: 'set-group-color', groupId: '9', color: 'red' }).result).toMatchObject({ error: 'Group was not found.' });
    db.close();
  });
});

describe('set-group-members', () => {
  it('adds a node to a group and takes one out in one step each; the frame follows; the last node stays', () => {
    const db = openDb();
    sampleGraph(db);
    commit(db, 'g', { type: 'add-group', title: 'Load', nodeIds: ['1'] });
    const before = snap(db).groups![0].bounding!;
    const added = commit(db, 'ga', { type: 'set-group-members', groupId: '1', add: ['3'], remove: [] });
    expect(added.status).toBe('applied');
    const group = snap(db).groups![0];
    expect(group.nodeIds).toEqual(['1', '3']);
    expect(group.bounding![3]).toBeGreaterThan(before[3]);
    commit(db, 'gr', { type: 'set-group-members', groupId: '1', add: [], remove: ['3'] });
    expect(snap(db).groups![0].nodeIds).toEqual(['1']);
    expect(commit(db, 'g0', { type: 'set-group-members', groupId: '1', add: [], remove: ['1'] }).result)
      .toMatchObject({ error: 'A group keeps at least one node. To remove the group, use Remove group.' });
    expect(commit(db, 'gx', { type: 'set-group-members', groupId: '1', add: ['99'], remove: [] }).result).toMatchObject({ error: 'Node was not found.' });
    db.close();
  });
});

describe('seed after run', () => {
  it('writes the control_after_generate slot the seed row changes', () => {
    const db = openDb();
    upsertObjectInfo(db, parseObjectInfo({
      SeedNode: {
        input: { required: { seed: ['INT', { default: 0, min: 0, max: 100, control_after_generate: true }] } },
        output: ['INT'], output_name: ['INT'], name: 'SeedNode', display_name: 'Seed', category: 'utils', python_module: 'nodes',
      },
    }));
    commit(db, 'a', { type: 'add-node', nodeType: 'SeedNode', x: 0, y: 0 });
    expect(commit(db, 'c', { type: 'set-parameter', nodeId: '1', key: 'seed::control_after_generate', value: 'fixed' }).status).toBe('applied');
    expect(exported(db).nodes[0].widgets_values).toEqual([0, 'fixed']);
    db.close();
  });
});
