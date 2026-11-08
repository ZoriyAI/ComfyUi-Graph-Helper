import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { portsCompatible } from '../../src/shared/graph/linkTypes';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';

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
    expect(nodeData(db, 'node-add-seed').inputs).toEqual([
      { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
      { id: 'in-1', name: 'positive', dataType: 'CONDITIONING', optional: false },
      { id: 'in-2', name: 'negative', dataType: 'CONDITIONING', optional: false },
      { id: 'in-3', name: 'latent_image', dataType: 'LATENT', optional: false },
    ]);
    expect(nodeData(db, 'node-add-seed').outputs).toEqual([{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }]);

    const unknown = manual(db, 'add-unknown', { type: 'add-node', nodeType: 'TestNode' });
    expect(unknown.status).toBe('applied');
    expect(nodeData(db, 'node-add-unknown').inputs).toEqual([]);
    expect(nodeData(db, 'node-add-unknown').outputs).toEqual([
      { id: 'out-0', name: 'OUTPUT', dataType: 'unknown', optional: false },
    ]);

    upsertObjectInfo(db, parseObjectInfo(catalog));
    const source = manual(db, 'add-source', { type: 'add-node', nodeType: 'PortSource' });
    const sink = manual(db, 'add-sink', { type: 'add-node', nodeType: 'PortSink' });
    const empty = manual(db, 'add-empty', { type: 'add-node', nodeType: 'EmptyImported' });
    expect(source.status).toBe('applied');
    expect(sink.status).toBe('applied');
    expect(nodeData(db, 'node-add-source').outputs).toEqual([
      { id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false },
      { id: 'out-1', name: 'ANY', dataType: '*', optional: false },
      { id: 'out-2', name: 'MASK', dataType: 'MASK', optional: false },
      { id: 'out-3', name: 'image', dataType: 'image', optional: false },
    ]);
    expect(nodeData(db, 'node-add-source').inputs).toEqual([]);
    expect(nodeData(db, 'node-add-sink').inputs).toEqual([
      { id: 'in-0', name: 'images', dataType: 'IMAGE', optional: false },
      { id: 'in-1', name: 'model', dataType: 'MODEL', optional: false },
      { id: 'in-2', name: 'any', dataType: '*', optional: false },
      { id: 'in-3', name: 'listed', dataType: 'IMAGE,MASK', optional: false },
    ]);
    expect(nodeData(db, 'node-add-sink').outputs).toEqual([{ id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false }]);
    expect(empty.status).toBe('applied');
    expect(nodeData(db, 'node-add-empty').inputs).toEqual([]);
    expect(nodeData(db, 'node-add-empty').outputs).toEqual([]);
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
      source: 'node-add-source',
      target: 'node-add-sink',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
    });
    expect(accepted.status).toBe('applied');
    const edge = (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as Array<Record<string, any>>).find(
      (item) => item.id === 'link-1',
    );
    expect(edge).toMatchObject({
      source: 'node-add-source',
      target: 'node-add-sink',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
      data: { dataType: 'IMAGE' },
    });

    const wildcard = manual(db, 'connect-wild', {
      type: 'connect',
      source: 'node-add-source',
      target: 'node-add-sink',
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
      source: 'node-add-source',
      target: 'node-add-sink',
      sourceHandle: 'out-2',
      targetHandle: 'in-3',
    });
    expect(listed.status).toBe('applied');

    const cased = manual(db, 'connect-case', {
      type: 'connect',
      source: 'node-add-source',
      target: 'node-add-other',
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
      source: 'node-add-source',
      target: 'node-add-sink',
      sourceHandle: 'out-0',
      targetHandle: 'in-1',
    });
    expect(mismatch.status).toBe('rejected');
    expect(mismatch.result).toEqual({ error: 'Port types cannot be connected.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const missing = manual(db, 'connect-missing', {
      type: 'connect',
      source: 'node-missing',
      target: 'node-add-sink',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
    });
    expect(missing.status).toBe('rejected');
    expect(missing.result).toEqual({ error: 'Source node was not found.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const missingTarget = manual(db, 'connect-missing-target', {
      type: 'connect',
      source: 'node-add-source',
      target: 'node-missing',
      sourceHandle: 'out-0',
      targetHandle: 'in-0',
    });
    expect(missingTarget.status).toBe('rejected');
    expect(missingTarget.result).toEqual({ error: 'Target node was not found.' });

    const wrongOutput = manual(db, 'connect-wrong-output', {
      type: 'connect',
      source: 'node-add-source',
      target: 'node-add-sink',
      sourceHandle: 'out-9',
      targetHandle: 'in-0',
    });
    expect(wrongOutput.status).toBe('rejected');
    expect(wrongOutput.result).toEqual({ error: 'Source handle is not an output on that node.' });

    const wrongInput = manual(db, 'connect-wrong-input', {
      type: 'connect',
      source: 'node-add-source',
      target: 'node-add-sink',
      sourceHandle: 'out-0',
      targetHandle: 'in-9',
    });
    expect(wrongInput.status).toBe('rejected');
    expect(wrongInput.result).toEqual({ error: 'Target handle is not an input on that node.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const retarget = manual(db, 'retarget-mismatch', {
      type: 'retarget-edge',
      edgeId: 'link-1',
      target: 'node-add-sink',
      targetHandle: 'in-1',
    });
    expect(retarget.status).toBe('rejected');
    expect(retarget.result).toEqual({ error: 'Port types cannot be connected.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)).toEqual(before);

    const moved = manual(db, 'retarget-match', {
      type: 'retarget-edge',
      edgeId: 'link-1',
      target: 'node-add-other',
      targetHandle: 'in-0',
    });
    expect(moved.status).toBe('applied');
    expect(
      (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.edges as Array<Record<string, any>>).find((item) => item.id === 'link-1'),
    ).toMatchObject({ target: 'node-add-other', targetHandle: 'in-0', data: { dataType: 'IMAGE' } });
    db.close();
  });
});
