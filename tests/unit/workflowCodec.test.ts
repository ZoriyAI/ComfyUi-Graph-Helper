import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { classifyWorkflow, exportWorkflow, missingDeps, projectWorkflow, toApiPrompt } from '../../src/shared/workflow/codec';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

function importWorkflow(db: Database.Database, document: Record<string, unknown>, actionId = 'import-1') {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload: { type: 'import-workflow', document },
  });
}

const uiV1 = {
  version: 1,
  state: { lastNodeId: 3, lastLinkId: 9, customState: 'keep-state' },
  vendor: { keep: true },
  definitions: { subgraphs: [{ id: 'sg', unknownField: 'keep-sg' }] },
  groups: [{ title: 'Box', bounding: [1, 2, 3, 4], custom: 'keep-group' }],
  extra: {
    info: { name: 'n', author: 'a', description: 'd', version: '1', created: 'c', modified: 'old', software: 's' },
    mystery: 1,
  },
  models: [{ name: 'model.safetensors', url: 'https://example.com/model', directory: 'checkpoints' }],
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      pos: [10, 20],
      size: [100, 40],
      flags: {},
      order: 0,
      mode: 0,
      properties: {},
      widgets_values: { ckpt_name: 'old.safetensors', customWidget: true },
      customFlag: 'keep-node',
      outputs: [{ name: 'MODEL', type: 'MODEL', links: [9], slot_index: 0, mysteryOutput: 'keep-output' }],
    },
    {
      id: 2,
      type: 'CLIPTextEncode',
      pos: [40, 50],
      size: [100, 40],
      flags: {},
      order: 1,
      mode: 0,
      properties: {},
      widgets_values: ['old', { extra: true }],
      inputs: [{ name: 'clip', type: 'CLIP', link: null, slot_index: 0 }],
    },
    {
      id: 3,
      type: 'MissingNode',
      pos: [70, 80],
      size: [100, 40],
      flags: {},
      order: 2,
      mode: 0,
      properties: {},
      inputs: [{ name: 'clip', type: 'CLIP', link: 9, slot_index: 0, mysteryInput: 'keep-input' }],
    },
  ],
  links: [{ id: 9, origin_id: 1, origin_slot: 0, target_id: 3, target_slot: 0, type: 'MODEL', custom: 'keep-link' }],
};

describe('workflow codec', () => {
  it('keeps unknown fields after an edit and reports missing catalog rows', () => {
    const db = openDb();
    const imported = importWorkflow(db, uiV1);
    expect(imported.status).toBe('applied');
    expect(imported.result).toMatchObject({
      formatVersion: 1,
      missingNodes: ['MissingNode'],
      missingModels: [{ directory: 'checkpoints', name: 'model.safetensors' }],
    });
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes).toHaveLength(3);

    const moved = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'move-1',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'move-node', nodeId: '1', x: 30, y: 40 },
    });
    const param = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-1',
      expectedRevisionId: moved.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '1', key: 'ckpt_name', value: 'new.safetensors' },
    });
    const text = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-2',
      expectedRevisionId: param.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '2', key: 'text', value: 'new', widgetIndex: 0 },
    });
    const retarget = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'link-1',
      expectedRevisionId: text.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'retarget-edge', edgeId: 'link-9', target: '2', targetHandle: 'in-0' },
    });
    expect(retarget.status).toBe('applied');

    const exported = exportWorkflow(retarget.projection!.snapshot as never, '2026-11-08T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const workflow = exported.workflow;
    expect(workflow.version).toBe(1);
    expect(workflow.vendor).toEqual({ keep: true });
    expect(workflow.definitions).toEqual({ subgraphs: [{ id: 'sg', unknownField: 'keep-sg' }] });
    expect(workflow.groups).toEqual([{ title: 'Box', bounding: [1, 2, 3, 4], custom: 'keep-group' }]);
    expect((workflow.state as { customState: string }).customState).toBe('keep-state');
    expect((workflow.extra as { mystery: number; info: { modified: string }; graphHelper: { formatVersion: number } }).mystery).toBe(1);
    expect((workflow.extra as { info: { modified: string } }).info.modified).toBe('2026-11-08T00:00:00.000Z');
    expect((workflow.extra as { graphHelper: { formatVersion: number } }).graphHelper.formatVersion).toBe(1);
    const nodes = workflow.nodes as Array<Record<string, any>>;
    expect(nodes.map((node) => node.id)).toEqual([1, 2, 3]);
    expect(nodes[0].pos).toEqual([30, 40]);
    expect(nodes[0].customFlag).toBe('keep-node');
    expect(nodes[0].widgets_values).toEqual({ ckpt_name: 'new.safetensors', customWidget: true });
    expect(nodes[0].outputs[0].mysteryOutput).toBe('keep-output');
    expect(nodes[1].widgets_values).toEqual(['new', { extra: true }]);
    expect(nodes[2].inputs[0].mysteryInput).toBe('keep-input');
    expect(nodes[2].inputs[0].link).toBeNull();
    expect(nodes[1].inputs[0].link).toBe(9);
    const links = workflow.links as Array<Record<string, unknown>>;
    expect(links).toEqual([
      { id: 9, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: 'MODEL', custom: 'keep-link' },
    ]);

    db.prepare('INSERT INTO model_catalog (directory, name) VALUES (?, ?)').run('checkpoints', 'model.safetensors');
    expect(missingDeps(uiV1, { nodeTypes: ['CheckpointLoaderSimple', 'CLIPTextEncode', 'MissingNode'], models: [{ directory: 'checkpoints', name: 'model.safetensors' }] }).missingModels).toEqual([]);
    db.close();
  });

  it('round-trips a legacy 0.4 tuple link and its extra element', () => {
    const db = openDb();
    const document = {
      version: 0.4,
      last_node_id: 1,
      last_link_id: 1,
      rootExtra: 'keep-root',
      nodes: [{
        id: 1,
        type: 'LoadImage',
        pos: [1, 2],
        size: [3, 4],
        flags: {},
        order: 0,
        mode: 0,
        properties: {},
        widgets_values: [],
        custom: 'keep',
      }],
      links: [[1, 1, 0, 1, 0, 'IMAGE', 'keep-tuple']],
      groups: [{ title: 'G', bounding: [0, 0, 1, 1], extraGroup: true }],
    };
    const imported = importWorkflow(db, document, 'import-v04');
    expect(imported.status).toBe('applied');
    expect(classifyWorkflow(document)).toBe('ui-v0.4');
    const exported = exportWorkflow(imported.projection!.snapshot as never, '2026-11-08T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.workflow.version).toBe(0.4);
    expect(exported.workflow.rootExtra).toBe('keep-root');
    expect(exported.workflow.groups).toEqual(document.groups);
    expect(exported.workflow.links).toEqual([[1, 1, 0, 1, 0, 'IMAGE', 'keep-tuple']]);
    expect((exported.workflow.nodes as Array<Record<string, unknown>>)[0].custom).toBe('keep');
    db.close();
  });

  it('rejects an API prompt and does not treat it as the canvas', () => {
    const db = openDb();
    const prompt = { '3': { class_type: 'KSampler', inputs: { seed: 1 }, pos: [9, 9] } };
    expect(classifyWorkflow(prompt)).toBe('api-prompt');
    const rejected = importWorkflow(db, prompt, 'import-api');
    expect(rejected.status).toBe('rejected');
    expect(rejected.result).toEqual({ error: 'API prompt is not a canvas workflow.' });
    expect(readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes).toHaveLength(0);
    const projected = projectWorkflow(uiV1);
    if ('error' in projected) throw new Error(projected.error);
    const api = toApiPrompt(projected.snapshot);
    expect(JSON.stringify(api)).not.toContain('"pos"');
    expect(JSON.stringify(api)).not.toContain('groups');
    expect(api['1'].class_type).toBe('CheckpointLoaderSimple');
    expect(api['1'].inputs.ckpt_name).toBe('old.safetensors');
    db.close();
  });

  it('gives a new v1 connection a numeric link id and does not lower lastLinkId', () => {
    const db = openDb();
    const imported = importWorkflow(db, uiV1, 'import-connect-v1');
    const connected = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'connect-1',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'connect', source: '1', target: '2', sourceHandle: 'out-0', targetHandle: 'in-0' },
    });
    expect(connected.status).toBe('applied');
    expect(connected.result).toMatchObject({ linkId: 10 });
    const exported = exportWorkflow(connected.projection!.snapshot as never, '2026-11-08T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const links = exported.workflow.links as Array<Record<string, unknown>>;
    const created = links.find((link) => link.id === 10);
    expect(created).toMatchObject({ id: 10, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: 'MODEL' });
    expect(typeof created?.id).toBe('number');
    expect((exported.workflow.state as { lastLinkId: number }).lastLinkId).toBeGreaterThanOrEqual(10);
    const nodes = exported.workflow.nodes as Array<Record<string, any>>;
    expect(nodes[1].inputs[0].link).toBe(10);
    expect(nodes[0].outputs[0].links).toEqual(expect.arrayContaining([9, 10]));
    db.close();
  });

  it('gives a new 0.4 connection a numeric tuple id and keeps last_link_id monotonic', () => {
    const db = openDb();
    const document = {
      version: 0.4,
      last_node_id: 2,
      last_link_id: 4,
      nodes: [
        {
          id: 1,
          type: 'LoadImage',
          pos: [0, 0],
          size: [10, 10],
          flags: {},
          order: 0,
          mode: 0,
          properties: {},
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [], slot_index: 0 }],
        },
        {
          id: 2,
          type: 'SaveImage',
          pos: [20, 0],
          size: [10, 10],
          flags: {},
          order: 1,
          mode: 0,
          properties: {},
          inputs: [{ name: 'images', type: 'IMAGE', link: null, slot_index: 0 }],
        },
      ],
      links: [],
      groups: [],
    };
    const imported = importWorkflow(db, document, 'import-connect-v04');
    const connected = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'connect-v04',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'connect', source: '1', target: '2', sourceHandle: 'out-0', targetHandle: 'in-0' },
    });
    expect(connected.status).toBe('applied');
    const exported = exportWorkflow(connected.projection!.snapshot as never, '2026-11-08T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.workflow.links).toEqual([[5, 1, 0, 2, 0, 'IMAGE']]);
    expect(exported.workflow.last_link_id).toBeGreaterThanOrEqual(5);
    const nodes = exported.workflow.nodes as Array<Record<string, any>>;
    expect(nodes[1].inputs[0].link).toBe(5);
    expect(nodes[0].outputs[0].links).toEqual([5]);
    db.close();
  });

  it('does not lower lastNodeId after a node is removed', () => {
    const db = openDb();
    const imported = importWorkflow(db, uiV1, 'import-remove');
    const removed = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'remove-3',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'remove-node', nodeId: '3' },
    });
    expect(removed.status).toBe('applied');
    const exported = exportWorkflow(removed.projection!.snapshot as never, '2026-11-08T00:00:00.000Z');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect((exported.workflow.nodes as unknown[]).map((node) => (node as { id: number }).id)).toEqual([1, 2]);
    expect((exported.workflow.state as { lastNodeId: number }).lastNodeId).toBeGreaterThanOrEqual(3);
    db.close();
  });

  it('rejects an array widget write without an index and a retarget to a missing node', () => {
    const db = openDb();
    const imported = importWorkflow(db, uiV1, 'import-reject');
    const rejectedParam = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'param-missing-index',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'set-parameter', nodeId: '2', key: 'text', value: 'new' },
    });
    expect(rejectedParam.status).toBe('rejected');
    expect(rejectedParam.result).toEqual({ error: 'widgetIndex is required when widgets_values is an array.' });
    const node = (readProjection(db, DESKTOP_PROJECT_ID)!.snapshot.nodes as Array<Record<string, any>>).find((item) => item.id === '2');
    expect(node?.data.comfy.widgets_values).toEqual(['old', { extra: true }]);
    const rejectedLink = commitCommand(db, {
      projectId: DESKTOP_PROJECT_ID,
      actionId: 'retarget-missing',
      expectedRevisionId: imported.projection!.currentRevisionId,
      actor: 'manual',
      runId: null,
      payload: { type: 'retarget-edge', edgeId: 'link-9', target: '99', targetHandle: 'in-0' },
    });
    expect(rejectedLink.status).toBe('rejected');
    expect(rejectedLink.result).toEqual({ error: 'Target node was not found.' });
    db.close();
  });
});
