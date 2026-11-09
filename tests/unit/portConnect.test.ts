import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { portsCompatible } from '../../src/shared/graph/linkTypes';
import { inferInputs } from '../../src/shared/graph/ports';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { exportWorkflow } from '../../src/shared/workflow/codec';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function manual(db: Database.Database, actionId: string, payload: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

function nodeData(db: Database.Database, nodeId: string): Record<string, any> {
  const node = (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes as Array<Record<string, any>>).find((item) => item.id === nodeId);
  return node!.data;
}

const catalog = {
  PortSource: {
    input: { required: {} },
    output: ['IMAGE', '*', 'MASK', 'image'],
    output_name: ['IMAGE', 'ANY', 'MASK', 'image'],
    python_module: 'nodes',
  },
  PortSink: {
    input: {
      required: {
        images: ['IMAGE'],
        model: ['MODEL'],
        any: ['*'],
        listed: ['IMAGE,MASK'],
      },
    },
    input_order: { required: ['images', 'model', 'any', 'listed'] },
    output: ['LATENT'],
    output_name: ['LATENT'],
    python_module: 'nodes',
  },
  EmptyImported: {
    input: { required: {} },
    output: [],
    python_module: 'nodes',
  },
};

describe('catalog ports and connection types', () => {
  it('follows the frontend wildcard and comma-list connection rule', () => {
    expect(portsCompatible('IMAGE', 'IMAGE')).toBe(true);
    expect(portsCompatible('image', 'IMAGE')).toBe(true);
    expect(portsCompatible('IMAGE', 'MODEL')).toBe(false);
    expect(portsCompatible('*', 'LATENT')).toBe(true);
    expect(portsCompatible('CLIP', '*')).toBe(true);
    expect(portsCompatible('', 'VAE')).toBe(true);
    expect(portsCompatible('MASK', 'IMAGE,MASK')).toBe(true);
    expect(portsCompatible('MODEL', 'IMAGE,MASK')).toBe(false);
  });

  it('uses catalog sockets after import and the hardcoded map only before that', () => {
    const db = openDb();
    const seeded = manual(db, 'add-seed', { type: 'add-node', nodeType: 'KSampler' });
    expect(seeded.status).toBe('applied');
    expect(nodeData(db, '1').inputs).toEqual([
      { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
      { id: 'in-1', name: 'positive', dataType: 'CONDITIONING', optional: false },
      { id: 'in-2', name: 'negative', dataType: 'CONDITIONING', optional: false },
      { id: 'in-3', name: 'latent_image', dataType: 'LATENT', optional: false },
    ]);
    expect(nodeData(db, '1').outputs).toEqual([{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }]);

    const unknown = manual(db, 'add-unknown', { type: 'add-node', nodeType: 'TestNode' });
    expect(unknown.status).toBe('applied');
    expect(nodeData(db, '2').inputs).toEqual([]);
    expect(nodeData(db, '2').outputs).toEqual([
      { id: 'out-0', name: 'OUTPUT', dataType: 'unknown', optional: false },
    ]);

    upsertObjectInfo(db, parseObjectInfo(catalog));
    const source = manual(db, 'add-source', { type: 'add-node', nodeType: 'PortSource' });
    const sink = manual(db, 'add-sink', { type: 'add-node', nodeType: 'PortSink' });
    const empty = manual(db, 'add-empty', { type: 'add-node', nodeType: 'EmptyImported' });
    expect(source.status).toBe('applied');
    expect(sink.status).toBe('applied');
    expect(nodeData(db, '3').outputs).toEqual([
      { id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false },
      { id: 'out-1', name: 'ANY', dataType: '*', optional: false },
      { id: 'out-2', name: 'MASK', dataType: 'MASK', optional: false },
      { id: 'out-3', name: 'image', dataType: 'image', optional: false },
    ]);
    expect(nodeData(db, '3').inputs).toEqual([]);
    expect(nodeData(db, '4').inputs).toEqual([
      { id: 'in-0', name: 'images', dataType: 'IMAGE', optional: false },
      { id: 'in-1', name: 'model', dataType: 'MODEL', optional: false },
      { id: 'in-2', name: 'any', dataType: '*', optional: false },
      { id: 'in-3', name: 'listed', dataType: 'IMAGE,MASK', optional: false },
    ]);
    expect(nodeData(db, '4').outputs).toEqual([{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }]);
    expect(empty.status).toBe('applied');
    expect(nodeData(db, '5').inputs).toEqual([]);
    expect(nodeData(db, '5').outputs).toEqual([]);
    db.close();
  });

  it('accepts a compatible pair and rejects a mismatch or a missing handle without mutation', () => {
    const db = openDb();
    upsertObjectInfo(db, parseObjectInfo(catalog));
    expect(manual(db, 'add-source', { type: 'add-node', nodeType: 'PortSource' }).status).toBe('applied');
    expect(manual(db, 'add-sink', { type: 'add-node', nodeType: 'PortSink' }).status).toBe('applied');
    expect(manual(db, 'add-other', { type: 'add-node', nodeType: 'PortSink' }).status).toBe('applied');

    const accepted = manual(db, 'connect-image', {
      type: 'connect',
      source: '1',
      target: '2',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
    });
    expect(accepted.status).toBe('applied');
    const edge = (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as Array<Record<string, any>>).find(
      (item) => item.id === 'link-1',
    );
    expect(edge).toMatchObject({
      source: '1',
      target: '2',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
      data: { dataType: 'IMAGE' },
    });

    const wildcard = manual(db, 'connect-wild', {
      type: 'connect',
      source: '1',
      target: '2',
      sourceHandle: 'out-1',
      targetHandle: 'in-1',
    });
    expect(wildcard.status).toBe('applied');
    expect(
      (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as Array<Record<string, any>>).find((item) => item.id === 'link-2')
        ?.data.dataType,
    ).toBe('*');

    const listed = manual(db, 'connect-list', {
      type: 'connect',
      source: '1',
      target: '2',
      sourceHandle: 'out-2',
      targetHandle: 'in-3',
    });
    expect(listed.status).toBe('applied');

    const cased = manual(db, 'connect-case', {
      type: 'connect',
      source: '1',
      target: '3',
      sourceHandle: 'out-3',
      targetHandle: 'in-0',
    });
    expect(cased.status).toBe('applied');
    expect(
      (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as Array<Record<string, any>>).find((item) => item.id === 'link-4')
        ?.data.dataType,
    ).toBe('image');

    const before = readProjection(db, DESKTOP_PROJECT_ID);
    const mismatch = manual(db, 'connect-mismatch', {
      type: 'connect',
      source: '1',
      target: '2',
      sourceHandle: 'out-0',
      targetHandle: 'in-1',
    });
    expect(mismatch.status).toBe('rejected');
    expect(mismatch.result).toEqual({ error: 'Port types cannot be connected.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const missing = manual(db, 'connect-missing', {
      type: 'connect',
      source: 'node-missing',
      target: '2',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
    });
    expect(missing.status).toBe('rejected');
    expect(missing.result).toEqual({ error: 'Source node was not found.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const missingTarget = manual(db, 'connect-missing-target', {
      type: 'connect',
      source: '1',
      target: 'node-missing',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
    });
    expect(missingTarget.status).toBe('rejected');
    expect(missingTarget.result).toEqual({ error: 'Target node was not found.' });

    const wrongOutput = manual(db, 'connect-wrong-output', {
      type: 'connect',
      source: '1',
      target: '2',
      sourceHandle: 'out-9',
      targetHandle: 'in-0',
    });
    expect(wrongOutput.status).toBe('rejected');
    expect(wrongOutput.result).toEqual({ error: 'Source handle is not an output on that node.' });

    const wrongInput = manual(db, 'connect-wrong-input', {
      type: 'connect',
      source: '1',
      target: '2',
      sourceHandle: 'out-0',
      targetHandle: 'in-9',
    });
    expect(wrongInput.status).toBe('rejected');
    expect(wrongInput.result).toEqual({ error: 'Target handle is not an input on that node.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const retarget = manual(db, 'retarget-mismatch', {
      type: 'retarget-edge',
      edgeId: 'link-1',
      target: '2',
      targetHandle: 'in-1',
    });
    expect(retarget.status).toBe('rejected');
    expect(retarget.result).toEqual({ error: 'Port types cannot be connected.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const moved = manual(db, 'retarget-match', {
      type: 'retarget-edge',
      edgeId: 'link-1',
      target: '3',
      targetHandle: 'in-0',
    });
    expect(moved.status).toBe('applied');
    expect(
      (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as Array<Record<string, any>>).find((item) => item.id === 'link-1'),
    ).toMatchObject({ target: '3', targetHandle: 'in-0', data: { dataType: 'IMAGE' } });
    db.close();
  });

  it('numbers mixed widget and socket inputs as frontend slots', () => {
    const db = openDb();
    const beforeSampler = manual(db, 'before-sampler', { type: 'add-node', nodeType: 'KSampler' });
    const beforeEncode = manual(db, 'before-encode', { type: 'add-node', nodeType: 'CLIPTextEncode' });
    expect(beforeSampler.status).toBe('applied');
    expect(beforeEncode.status).toBe('applied');
    const hardcodedSampler = nodeData(db, '1').inputs;
    const hardcodedEncode = nodeData(db, '2').inputs;
    expect(hardcodedSampler).toEqual(inferInputs('KSampler'));
    expect(hardcodedEncode).toEqual(inferInputs('CLIPTextEncode'));

    upsertObjectInfo(db, parseObjectInfo({
      CLIPTextEncode: {
        input: {
          required: {
            text: ['STRING', { multiline: true }],
            clip: ['CLIP'],
          },
        },
        input_order: { required: ['text', 'clip'] },
        output: ['CONDITIONING'],
        output_name: ['CONDITIONING'],
        python_module: 'nodes',
      },
      KSampler: {
        input: {
          required: {
            model: ['MODEL'],
            seed: ['INT', { default: 0, control_after_generate: true }],
            steps: ['INT', { default: 20 }],
            cfg: ['FLOAT', { default: 8 }],
            sampler_name: [['euler', 'ddim']],
            scheduler: [['normal', 'karras']],
            positive: ['CONDITIONING'],
            negative: ['CONDITIONING'],
            latent_image: ['LATENT'],
            denoise: ['FLOAT', { default: 1 }],
          },
        },
        input_order: {
          required: ['model', 'seed', 'steps', 'cfg', 'sampler_name', 'scheduler', 'positive', 'negative', 'latent_image', 'denoise'],
        },
        output: ['LATENT'],
        output_name: ['LATENT'],
        python_module: 'nodes',
      },
    }));

    expect(manual(db, 'encode', { type: 'add-node', nodeType: 'CLIPTextEncode' }).status).toBe('applied');
    expect(manual(db, 'sampler', { type: 'add-node', nodeType: 'KSampler' }).status).toBe('applied');
    expect(manual(db, 'loader', { type: 'add-node', nodeType: 'CheckpointLoaderSimple' }).status).toBe('applied');

    const encodeInputs = nodeData(db, '3').inputs;
    const samplerInputs = nodeData(db, '4').inputs;
    expect(encodeInputs).toEqual([
      { id: 'in-0', name: 'clip', dataType: 'CLIP', optional: false },
      { id: 'in-1', name: 'text', dataType: 'STRING', optional: false },
    ]);
    expect(encodeInputs).toEqual(hardcodedEncode);
    expect(samplerInputs.slice(0, 4)).toEqual(hardcodedSampler);
    expect(samplerInputs).toEqual([
      { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
      { id: 'in-1', name: 'positive', dataType: 'CONDITIONING', optional: false },
      { id: 'in-2', name: 'negative', dataType: 'CONDITIONING', optional: false },
      { id: 'in-3', name: 'latent_image', dataType: 'LATENT', optional: false },
      { id: 'in-4', name: 'seed', dataType: 'INT', optional: false },
      { id: 'in-5', name: 'steps', dataType: 'INT', optional: false },
      { id: 'in-6', name: 'cfg', dataType: 'FLOAT', optional: false },
      { id: 'in-7', name: 'sampler_name', dataType: 'COMBO', optional: false },
      { id: 'in-8', name: 'scheduler', dataType: 'COMBO', optional: false },
      { id: 'in-9', name: 'denoise', dataType: 'FLOAT', optional: false },
    ]);

    const clip = manual(db, 'connect-clip', {
      type: 'connect',
      source: '5',
      target: '3',
      sourceHandle: 'out-1',
      targetHandle: 'in-0',
    });
    expect(clip.status).toBe('applied');
    const positive = manual(db, 'connect-positive', {
      type: 'connect',
      source: '3',
      target: '4',
      sourceHandle: 'out-0',
      targetHandle: 'in-1',
    });
    expect(positive.status).toBe('applied');

    const before = readProjection(db, DESKTOP_PROJECT_ID);
    const text = manual(db, 'connect-text', {
      type: 'connect',
      source: '5',
      target: '3',
      sourceHandle: 'out-1',
      targetHandle: 'in-1',
    });
    expect(text.status).toBe('rejected');
    expect(text.result).toEqual({ error: 'Port types cannot be connected.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const exported = exportWorkflow(before!.snapshot as never, '2026-11-08T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const links = exported.workflow.links as Array<Record<string, unknown>>;
    expect(links.find((link) => link.target_id === 3)).toMatchObject({ target_slot: 0, type: 'CLIP' });
    expect(links.find((link) => link.target_id === 4)).toMatchObject({ target_slot: 1, type: 'CONDITIONING' });
    db.close();
  });
});
