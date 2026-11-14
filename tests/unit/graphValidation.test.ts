import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { checkGraph } from '../../src/main/knowledge/check';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { denseWorkflow } from '../e2e/fixtures/denseWorkflow';

const CORE = {
  CheckpointLoaderSimple: {
    input: { required: { ckpt_name: [['base.safetensors']] } },
    input_order: { required: ['ckpt_name'] },
    output: ['MODEL', 'CLIP', 'VAE'],
    python_module: 'nodes',
  },
  KSampler: {
    input: {
      required: {
        model: ['MODEL'],
        seed: ['INT', { default: 0, min: 0, max: 0xffffffffffff, control_after_generate: true }],
        steps: ['INT', { default: 20, min: 1 }],
        cfg: ['FLOAT', { default: 8.0, step: 0.1 }],
        sampler_name: [['euler', 'dpmpp_2m']],
        scheduler: ['COMBO', { options: ['normal', 'karras'], default: 'karras' }],
        positive: ['CONDITIONING'],
        negative: ['CONDITIONING'],
        latent_image: ['LATENT'],
        denoise: ['FLOAT', { default: 1.0 }],
      },
    },
    input_order: { required: ['model', 'seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'positive', 'negative', 'latent_image', 'denoise'] },
    output: ['LATENT'],
    python_module: 'nodes',
  },
  LoadImage: {
    input: { required: { image: [['example.png', 'portrait.jpg'], { image_upload: true }] } },
    input_order: { required: ['image'] },
    output: ['IMAGE', 'MASK'],
    python_module: 'nodes',
  },
};

function openDb(withCore = false): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  if (withCore) upsertObjectInfo(db, parseObjectInfo(CORE));
  return db;
}

function commit(db: Database.Database, actionId: string, payload: Record<string, unknown>) {
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: readProjection(db, DESKTOP_PROJECT_ID)!.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

function reroute(id: number, links: Array<{ input?: number | null; output?: number[] }>) {
  return {
    id,
    type: 'Reroute',
    pos: [id * 100, 0],
    size: [100, 60],
    flags: {},
    order: id,
    mode: 0,
    properties: {},
    inputs: [{ name: 'in', type: '*', link: links.input ?? null }],
    outputs: [{ name: 'out', type: '*', links: links.output ?? [] }],
  };
}

function rerouteWorkflow(cyclic: boolean) {
  const links: Array<Record<string, unknown>> = [
    { id: 1, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: '*' },
  ];
  if (cyclic) {
    links.push(
      { id: 2, origin_id: 2, origin_slot: 0, target_id: 1, target_slot: 0, type: '*' },
      { id: 3, origin_id: 1, origin_slot: 0, target_id: 99, target_slot: 0, type: '*' },
    );
  }
  return {
    version: 1,
    state: { lastNodeId: 2, lastLinkId: links.length },
    nodes: [reroute(1, { input: cyclic ? 2 : null, output: [1] }), reroute(2, { input: 1, output: cyclic ? [2] : [] })],
    links,
  };
}

describe('graph validation', () => {
  it('rejects self-links and new cycles without writing a revision', () => {
    const db = openDb();
    expect(commit(db, 'import', { type: 'import-workflow', document: rerouteWorkflow(false) }).status).toBe('applied');
    const before = readProjection(db, DESKTOP_PROJECT_ID)!.revSeq;
    expect(commit(db, 'self', { type: 'connect', source: '1', target: '1', sourceHandle: 'out-0', targetHandle: 'in-0' }).status).toBe('rejected');
    expect(commit(db, 'cycle', { type: 'connect', source: '2', target: '1', sourceHandle: 'out-0', targetHandle: 'in-0' }).status).toBe('rejected');
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.revSeq).toBe(before);
  });

  it('reports imported cycles and broken links', () => {
    const db = openDb();
    expect(commit(db, 'import', { type: 'import-workflow', document: rerouteWorkflow(true) }).status).toBe('applied');
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.ok).toBe(false);
    expect(report.cycles).toHaveLength(1);
    expect(report.cycles?.[0]?.nodeIds).toEqual(expect.arrayContaining(['1', '2']));
    expect(report.brokenEdges).toEqual([{ edgeId: 'link-3', source: '1', target: '99' }]);
  });

  it('checks numeric ranges and combo choices against object_info', () => {
    const db = openDb(true);
    expect(commit(db, 'import', { type: 'import-workflow', document: structuredClone(denseWorkflow) }).status).toBe('applied');
    expect(commit(db, 'steps', { type: 'set-parameter', nodeId: '4', key: 'steps', value: -1 }).status).toBe('applied');
    expect(commit(db, 'sampler', { type: 'set-parameter', nodeId: '4', key: 'sampler_name', value: 'not-a-sampler' }).status).toBe('applied');
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.invalidParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: '4', name: 'steps', reason: 'range', expected: '>= 1' }),
      expect.objectContaining({ nodeId: '4', name: 'sampler_name', reason: 'choice' }),
    ]));
    expect(report.ok).toBe(false);
  });

  it('allows a newly uploaded file that is not in the previous catalog listing', () => {
    const db = openDb(true);
    expect(commit(db, 'import', { type: 'import-workflow', document: structuredClone(denseWorkflow) }).status).toBe('applied');
    expect(commit(db, 'upload', { type: 'add-node', nodeType: 'LoadImage', parameters: { image: 'new-upload.png' } }).status).toBe('applied');
    const report = checkGraph(db, DESKTOP_PROJECT_ID);
    expect(report.invalidParameters ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'image' }),
    ]));
  });

  it('applies the same parameter checks inside a subgraph', () => {
    const db = openDb(true);
    expect(commit(db, 'import', { type: 'import-workflow', document: structuredClone(denseWorkflow) }).status).toBe('applied');
    const created = commit(db, 'sg', { type: 'create-subgraph', name: 'Sampler block', nodeIds: ['4'], inputs: [], outputs: [] });
    expect(created.status).toBe('applied');
    const definitionId = (created.result as { definitionId: string }).definitionId;
    expect(commit(db, 'inner', {
      type: 'edit-in-subgraph',
      definitionId,
      edit: { type: 'set-parameter', nodeId: '4', key: 'steps', value: -1 },
    }).status).toBe('applied');
    expect(checkGraph(db, DESKTOP_PROJECT_ID).invalidParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: '4', name: 'steps', reason: 'range' }),
    ]));
  });
});
