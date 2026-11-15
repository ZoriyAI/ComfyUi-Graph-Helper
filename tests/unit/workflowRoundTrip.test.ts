/**
 * Protects the promise that a ComfyUI workflow file opened in NodeWise Studio and exported again comes out the same,
 * byte for byte in JSON terms, except for what the person changed. Odd fields (stale link ids, string counters,
 * dict-shaped widget values, unknown keys) are carried untouched, and nodes added in the app get valid ids and slots.
 * A person can move a workflow between the app and ComfyUI without losing anything.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { readCatalog, upsertObjectInfo } from '../../src/main/catalog/repository';
import { migrate } from '../../src/main/settings/migrate';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { missingOnGraph } from '../../src/shared/graph/compatibility';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { exportWorkflow, missingDeps, type GraphSnapshot } from '../../src/shared/workflow/codec';

type Json = Record<string, any>;
const EXPORTED_AT = '2026-11-14T00:00:00.000Z';

function fixture(name: string): Json {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/workflows', name), 'utf8')) as Json;
}

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

let seq = 0;
function commit(db: Database.Database, payload: Record<string, unknown>) {
  const current = readProjection(db, DESKTOP_PROJECT_ID)!;
  seq += 1;
  return commitCommand(db, {
    projectId: DESKTOP_PROJECT_ID,
    actionId: `rt-${seq}`,
    expectedRevisionId: current.currentRevisionId,
    actor: 'manual',
    runId: null,
    payload,
  });
}

/** The same path as ipc.ts exportWorkflowDocument. */
function exported(db: Database.Database): Json {
  const projection = readProjection(db, DESKTOP_PROJECT_ID)!;
  const result = exportWorkflow(projection.snapshot as GraphSnapshot, EXPORTED_AT, readCatalog(db));
  if (!result.ok) throw new Error(result.error);
  return JSON.parse(JSON.stringify(result.workflow)) as Json;
}

function imported(document: Json): Database.Database {
  const db = openDb();
  expect(commit(db, { type: 'import-workflow', document }).status).toBe('applied');
  return db;
}

describe('workflow round trip through the app', () => {
  it('keeps stale output link ids, links: null, id order, string counters and a missing extra', () => {
    const original = fixture('stale-slots-0.4.json');
    const db = imported(original);
    expect(exported(db)).toEqual(original);
    db.close();
  });

  it('carries every field of a 0.4 file with subgraphs, special nodes and unknown keys untouched', () => {
    const original = fixture('many-features-0.4.json');
    const db = imported(original);
    const expected = JSON.parse(JSON.stringify(original)) as Json;
    expect(exported(db)).toEqual(expected);
    db.close();
  });

  it('a move changes only that position, and a removed node clears only its own links', () => {
    const original = fixture('stale-slots-0.4.json');
    const db = imported(original);
    commit(db, { type: 'move-node', nodeId: '3', x: 640, y: 10 });
    const moved = JSON.parse(JSON.stringify(original)) as Json;
    moved.nodes[2].pos = [640, 10];
    expect(exported(db)).toEqual(moved);

    commit(db, { type: 'remove-node', nodeId: '2' });
    const removed = JSON.parse(JSON.stringify(moved)) as Json;
    removed.nodes.splice(1, 1);
    // The expected file after removing node 2: its links go, and the slots that pointed at them are cleared.
    removed.links = removed.links.filter((link: unknown[]) => link[0] === 11);
    removed.nodes[0].outputs[0].links = [11, 7];
    removed.nodes[1].inputs[0].link = null;
    expect(exported(db)).toEqual(removed);
    db.close();
  });

  it('a value change in a dict-shaped widgets_values keeps the dict', () => {
    const original = fixture('many-features-0.4.json');
    const db = imported(original);
    expect(commit(db, { type: 'set-parameter', nodeId: '1', key: 'label', value: 'cool' }).status).toBe('applied');
    const workflow = exported(db);
    expect(workflow.nodes[0].widgets_values).toEqual({ amount: 0.5, label: 'cool', nested: { keep: [1, 2] } });
    expect(workflow.nodes[0].mode).toBe(4);
    expect(workflow.nodes[0].flags).toEqual({ collapsed: true, pinned: true });
    db.close();
  });

  it('a node added and linked in the app gets a free numeric id, slots holding the link and default values', () => {
    const original = fixture('stale-slots-0.4.json');
    const db = imported(original);
    upsertObjectInfo(db, parseObjectInfo({
      SketchFrame: {
        input: {
          required: {
            picture: ['PICTURE'],
            width: ['INT', { default: 512, min: 64 }],
            seed: ['INT', { default: 7, control_after_generate: true }],
            style: [['thin', 'bold']],
          },
        },
        input_order: { required: ['picture', 'width', 'seed', 'style'] },
        output: ['PICTURE'],
        output_name: ['PICTURE'],
        python_module: 'custom_nodes.sketch_pack',
      },
    }));
    const added = commit(db, { type: 'add-node', nodeType: 'SketchFrame', title: 'Frame', x: 900, y: 0, parameters: { width: 640 } });
    expect(added.status).toBe('applied');
    const nodeId = (added.result as { nodeId: string }).nodeId;
    const linked = commit(db, { type: 'connect', source: '2', sourceHandle: 'out-0', target: nodeId, targetHandle: 'in-0' });
    expect(linked.status).toBe('applied');

    const workflow = exported(db);
    const node = workflow.nodes[4];
    expect(node.id).toBe(5);
    expect(workflow.last_node_id).toBe(5);
    expect(workflow.last_link_id).toBe(13);
    expect(workflow.links[3]).toEqual([13, 2, 0, 5, 0, 'PICTURE']);
    expect(node.inputs).toEqual([
      { name: 'picture', type: 'PICTURE', link: 13 },
      { name: 'width', type: 'INT', link: null, widget: { name: 'width' } },
      { name: 'seed', type: 'INT', link: null, widget: { name: 'seed' } },
      { name: 'style', type: 'COMBO', link: null, widget: { name: 'style' } },
    ]);
    expect(node.outputs).toEqual([{ name: 'PICTURE', type: 'PICTURE', links: [], slot_index: 0 }]);
    // A seed with control_after_generate takes an extra widget value right after it, as ComfyUI writes it.
    expect(node.widgets_values).toEqual([640, 7, 'randomize', 'thin']);
    expect(node.properties).toEqual({ 'Node name for S&R': 'SketchFrame' });
    expect(workflow.nodes[1].outputs[0].links).toEqual([12, 13]);
    // Everything else is as it was.
    const rest = JSON.parse(JSON.stringify(workflow)) as Json;
    rest.nodes.splice(4, 1);
    rest.links.splice(3, 1);
    rest.nodes[1].outputs[0].links = [12];
    rest.last_node_id = original.last_node_id;
    rest.last_link_id = original.last_link_id;
    expect(rest).toEqual(original);
    db.close();
  });

  it('a graph built from scratch exports the four state counters ComfyUI checks', () => {
    const db = openDb();
    commit(db, { type: 'add-node', nodeType: 'CheckpointLoaderSimple' });
    const workflow = exported(db);
    expect(workflow.version).toBe(1);
    expect(workflow.state).toEqual({ lastGroupId: 0, lastNodeId: 1, lastLinkId: 0, lastRerouteId: 0 });
    expect(workflow.nodes[0].id).toBe(1);
    db.close();
  });
});

describe('what the app says on import', () => {
  it('does not call browser-only nodes, subgraphs or group nodes missing, but checks what is inside them', () => {
    const document = fixture('many-features-0.4.json');
    const catalog = { nodeTypes: ['PaletteSource'], models: [], nodes: [] };
    expect(missingDeps(document, catalog).missingNodes).toEqual([
      'GetNode', 'InnerPainter', 'PaletteMix', 'PaletteSink', 'SetNode', 'SwatchLeft',
    ]);
    const withPack = {
      ...catalog,
      nodes: [{ classType: 'ImageResizeKJ', pack: 'custom_nodes.comfyui-kjnodes', pythonModule: 'custom_nodes.comfyui-kjnodes', inputs: [], outputs: [], widgetOrder: [] }],
    };
    expect(missingDeps(document, withPack).missingNodes).toEqual(['InnerPainter', 'PaletteMix', 'PaletteSink', 'SwatchLeft']);
    // A subgraph instance carries its definition's id as its type; neither it nor a Reroute counts as missing.
    const canvas = [{ data: { comfyType: 'Reroute' } }, { data: { comfyType: '9b1f0c2d-1111-4222-8333-444455556666' } }];
    expect(missingOnGraph(canvas, withPack, document).missingNodes).toEqual(['InnerPainter', 'PaletteMix', 'PaletteSink', 'SwatchLeft']);
  });

  it('lists what is kept for export but shown differently', () => {
    const db = openDb();
    const result = commit(db, { type: 'import-workflow', document: fixture('many-features-0.4.json') });
    expect((result.result as Json).shownDifferently).toEqual({ groupNodes: 1 });
    db.close();
  });
});
