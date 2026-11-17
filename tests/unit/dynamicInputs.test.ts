/** Checks declared dynamic sockets and controls through graph commands and export. */
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { resolveInputs } from '../../src/shared/catalog/dynamicInputs';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { readCatalog, upsertObjectInfo } from '../../src/main/catalog/repository';
import { nodeClassDetail } from '../../src/main/knowledge/repository';
import { exportWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import { nodeLayout } from '../../src/renderer/components/fields/fieldModel';
import type { ComfyNodeData } from '../../src/renderer/types/graph';
import { dynamicObjectInfo, dynamicWorkflow } from '../e2e/fixtures/dynamicInputs';
import { widgetNamesOf } from '../../src/main/agent/tools';

const databases: Database.Database[] = []; let seq = 0;
const open = () => { const db = new Database(':memory:'); databases.push(db); migrate(db); ensureWorkspace(db); upsertObjectInfo(db, parseObjectInfo(dynamicObjectInfo)); return db; };
const head = (db: Database.Database) => readProjection(db, 'desktop')!;
const snap = (db: Database.Database) => head(db).snapshot as GraphSnapshot;
const commit = (db: Database.Database, payload: unknown) => commitCommand(db, { projectId: 'desktop', actionId: `dynamic-${++seq}`, expectedRevisionId: head(db).currentRevisionId, actor: 'manual', runId: null, payload });
const applied = (db: Database.Database, payload: unknown) => { const result = commit(db, payload); expect(result).toMatchObject({ status: 'applied' }); return result; };
const exportDoc = (db: Database.Database): Record<string, any> => { const result = exportWorkflow(snap(db), '2026-11-17', readCatalog(db)); if (!result.ok) throw new Error(result.error); return result.workflow; };
afterEach(() => databases.splice(0).forEach(db => db.close()));

describe('native dynamic input declarations', () => {
  it('removes obsolete promoted children through nested copies when a dynamic mode changes, and undoes', () => {
    const db = open(); applied(db, { type: 'import-workflow', document: dynamicWorkflow });
    const made = applied(db, { type: 'create-subgraph', name: 'Dynamic copy', nodeIds: ['2'], widgets: [{ nodeId: '2', name: 'mode.multiplier' }] }).result as { definitionId: string; nodeId: string };
    applied(db, { type: 'create-subgraph', name: 'Outer copy', nodeIds: [made.nodeId], widgets: [{ nodeId: made.nodeId, name: 'mode.multiplier' }] });
    const before = head(db).currentRevisionId;
    applied(db, { type: 'edit-in-subgraph', definitionId: made.definitionId, edit: { type: 'set-parameter', nodeId: '2', key: 'mode', value: 'dimensions' } });
    const saved = exportDoc(db);
    for (const definition of saved.definitions.subgraphs) expect(definition.widgets).toEqual([]);
    expect(saved.nodes.find((node: any) => node.title === 'Outer copy').widgets_values).toEqual([]);
    applied(db, { type: 'restore-revision', revisionId: before });
    expect(exportDoc(db).definitions.subgraphs.every((definition: any) => definition.widgets.length === 1)).toBe(true);
  });

  it('reads the selected positional branch, persists its declaration, and displays actual named fields', () => {
    const db = open(); applied(db, { type: 'import-workflow', document: dynamicWorkflow });
    const spec = readCatalog(db).nodes.find(node => node.classType === 'DynamicImage')!;
    const resolved = resolveInputs(spec, { widgets: ['multiplier', 4, 'tail'] });
    expect(resolved.widgetOrder).toEqual(['mode', 'mode.multiplier', 'after']);
    expect(resolved.values).toEqual({ mode: 'multiplier', 'mode.multiplier': 4, after: 'tail' });
    expect(resolved.widgetOrderReliable).toBe(true);
    expect(widgetNamesOf(readCatalog(db))('DynamicImage', snap(db).nodes[1].data)).toEqual(['mode', 'mode.multiplier', 'after']);
    const layout = nodeLayout(snap(db).nodes[1].data as ComfyNodeData, nodeClassDetail(db, 'DynamicImage'));
    expect(layout.fields.map(field => [field.name, field.value])).toEqual([['mode', 'multiplier'], ['mode.multiplier', 4], ['after', 'imported tail']]);
    expect(layout.dynamicUnsupported).toBe(false);
    const saved = exportDoc(db); expect(saved.nodes[1].widgets_values).toEqual(['multiplier', 4, 'imported tail']);
    expect(saved.nodes[1].properties).toEqual({ future: 'preserve' });
  });

  it('changes mode atomically, preserves links/unknown fields, caches branch values and supports Undo', () => {
    const db = open(); applied(db, { type: 'import-workflow', document: dynamicWorkflow }); const before = head(db).currentRevisionId;
    applied(db, { type: 'set-parameter', nodeId: '2', key: 'mode', value: 'dimensions', widgetIndex: 0 });
    let saved = exportDoc(db);
    expect(saved.nodes[1].widgets_values).toEqual(['dimensions', 512, 768, 'imported tail']);
    expect(saved.nodes[1].widgets_values_named).toEqual({ mode: 'dimensions', 'mode.width': 512, 'mode.height': 768, after: 'imported tail', future_widget: { keep: true } });
    expect(saved.nodes[1].inputs.map((input: any) => input.name)).toEqual(['image', 'mode.width', 'mode.height']);
    expect(saved.nodes[1].inputs[0].futureInput).toBe('keep'); expect(saved.links[0].futureLink).toBe('keep'); expect(saved.links).toHaveLength(2);
    applied(db, { type: 'set-parameter', nodeId: '2', key: 'mode.width', value: 1024 });
    applied(db, { type: 'set-parameter', nodeId: '2', key: 'mode', value: 'multiplier' });
    expect(exportDoc(db).nodes[1].widgets_values).toEqual(['multiplier', 4, 'imported tail']);
    expect(exportDoc(db).nodes[1].widgets_values_named['mode.multiplier']).toBe(4);
    applied(db, { type: 'set-parameter', nodeId: '2', key: 'mode', value: 'dimensions' });
    expect(exportDoc(db).nodes[1].widgets_values[1]).toBe(1024);
    applied(db, { type: 'restore-revision', revisionId: before }); saved = exportDoc(db);
    expect(saved.nodes[1].widgets_values).toEqual(['multiplier', 4, 'imported tail']);
    expect(saved.nodes[1].inputs).toEqual(dynamicWorkflow.nodes[1].inputs);
    const revision = head(db).currentRevisionId;
    expect(commit(db, { type: 'set-parameter', nodeId: '2', key: 'mode', value: 'custom' }).status).toBe('rejected');
    expect(head(db).currentRevisionId).toBe(revision);
  });

  it('grows only to the declared maximum, compacts on disconnect and remaps links without changing their ids', () => {
    const db = open(); const add = (nodeType: string) => applied(db, { type: 'add-node', nodeType });
    add('ImageSource'); add('ImageSource'); add('ImageSource'); add('ImageBatchMulti');
    const node = () => snap(db).nodes.find(node => node.data.comfyType === 'ImageBatchMulti')!;
    const sources = snap(db).nodes.filter(node => node.data.comfyType === 'ImageSource'); const nodeId = String(node().id);
    expect(node().data.inputs.map((input: any) => input.name)).toEqual(['images.image0', 'images.image1']);
    // Connecting the spare while the first slot is empty must not silently move the new connection.
    applied(db, { type: 'connect', source: String(sources[0].id), sourceHandle: 'out-0', target: nodeId, targetHandle: 'in-1' });
    expect(node().data.inputs).toHaveLength(3); expect(snap(db).edges[0].targetHandle).toBe('in-1');
    applied(db, { type: 'connect', source: String(sources[1].id), sourceHandle: 'out-0', target: nodeId, targetHandle: 'in-0' });
    applied(db, { type: 'connect', source: String(sources[2].id), sourceHandle: 'out-0', target: nodeId, targetHandle: 'in-2' });
    expect(node().data.inputs).toHaveLength(3); const before = head(db).currentRevisionId;
    const removed = snap(db).edges.find(edge => edge.targetHandle === 'in-0')!;
    const kept = snap(db).edges.filter(edge => edge.id !== removed.id).map(edge => String(edge.id));
    applied(db, { type: 'remove-edge', edgeId: String(removed.id) });
    expect(snap(db).edges.map(edge => [String(edge.id), edge.targetHandle])).toEqual([[kept[0], 'in-0'], [kept[1], 'in-1']]);
    expect(node().data.inputs).toHaveLength(3);
    expect(exportDoc(db).links.map((link: any) => link.target_slot)).toEqual([0, 1]);
    applied(db, { type: 'restore-revision', revisionId: before }); expect(snap(db).edges).toHaveLength(3);
  });

  it('keeps DynamicGroup row count and child values in native positional order', () => {
    const db = open(); applied(db, { type: 'add-node', nodeType: 'Rows' }); const node = snap(db).nodes[0];
    applied(db, { type: 'set-parameter', nodeId: String(node.id), key: 'loras', value: 2 });
    applied(db, { type: 'set-parameter', nodeId: String(node.id), key: 'loras.1.strength', value: .6 });
    expect(exportDoc(db).nodes[0].widgets_values).toEqual(['head', 2, 1, true, .6, true, 'tail']);
    expect(snap(db).nodes[0].data.inputs.some((input: any) => input.name === 'loras')).toBe(false);
    expect(commit(db, { type: 'set-parameter', nodeId: String(node.id), key: 'loras', value: 1000000 }).status).toBe('rejected');
  });

  it('edits a dynamic node inside a native subgraph while retaining its boundary links and root copy', () => {
    const db = open(); applied(db, { type: 'import-workflow', document: dynamicWorkflow });
    applied(db, { type: 'create-subgraph', name: 'Dynamic resize', nodeIds: ['2'], widgets: [{ nodeId: '2', name: 'mode.multiplier' }] });
    const definition = snap(db).subgraphs![0]; const root = structuredClone(snap(db).nodes); const before = head(db).currentRevisionId;
    applied(db, { type: 'edit-in-subgraph', definitionId: definition.id, edit: { type: 'set-parameter', nodeId: '2', key: 'mode.multiplier', value: 3 } });
    expect(snap(db).subgraphs![0].nodes[0].data.comfy.widgets_values).toEqual(['multiplier', 3, 'imported tail']);
    expect(snap(db).nodes).toEqual(root); expect(snap(db).subgraphs![0].edges).toHaveLength(definition.edges.length);
    applied(db, { type: 'restore-revision', revisionId: before });
    expect(snap(db).subgraphs![0].nodes[0].data.comfy.widgets_values).toEqual(['multiplier', 4, 'imported tail']);
  });

  it('retains list semantics and resolves MatchType across compatible inputs with transactional refusal', () => {
    const db = open(); const list = readCatalog(db).nodes.find(node => node.classType === 'ListConsumer')!;
    expect(list.inputs[0].isList).toBe(true); expect(list.outputs[0].isList).toBe(true);
    for (const nodeType of ['ImageSource', 'MaskSource', 'Match']) applied(db, { type: 'add-node', nodeType });
    const [image, mask, match] = snap(db).nodes;
    applied(db, { type: 'connect', source: String(image.id), sourceHandle: 'out-0', target: String(match.id), targetHandle: 'in-0' });
    expect(snap(db).nodes[2].data.inputs[1].dataType).toBe('IMAGE'); expect(snap(db).nodes[2].data.outputs[0].dataType).toBe('IMAGE');
    const revision = head(db).currentRevisionId;
    expect(commit(db, { type: 'connect', source: String(mask.id), sourceHandle: 'out-0', target: String(match.id), targetHandle: 'in-1' }).status).toBe('rejected');
    expect(head(db).currentRevisionId).toBe(revision);
    applied(db, { type: 'remove-edge', edgeId: String(snap(db).edges[0].id) });
    expect(snap(db).nodes[2].data.outputs[0].dataType).toBe('*');
    expect(snap(db).nodes[2].data.inputs[1].dataType).toBe('IMAGE,MASK');
  });

  it('uses native named values and actual auxiliary widget names without dropping unknown named entries', () => {
    const db = open(); const document = structuredClone(dynamicWorkflow); document.nodes[1].widgets_values![1] = 2;
    applied(db, { type: 'import-workflow', document });
    const layout = nodeLayout(snap(db).nodes[1].data as ComfyNodeData, nodeClassDetail(db, 'DynamicImage'));
    expect(layout.fields.find(field => field.name === 'mode.multiplier')?.value).toBe(4);
    applied(db, { type: 'set-parameter', nodeId: '2', key: 'mode.multiplier', value: 5 });
    expect(exportDoc(db).nodes[1]).toMatchObject({ widgets_values: ['multiplier', 5, 'imported tail'], widgets_values_named: { 'mode.multiplier': 5, future_widget: { keep: true } } });
    const spec = parseObjectInfo({ SeedRows: { input: { required: { rows: ['COMFY_DYNAMICGROUP_V3', { min: 1, max: 2, template: { required: { seed: ['INT', { default: 10 }] } } }] } }, output: [] } }).nodes[0];
    const resolved = resolveInputs(spec, { widgets: [1, 10, 'randomize'], namedWidgets: { rows: 1, 'rows.0.seed': 20, 'rows.0.seed.0': 'fixed' } });
    expect(resolved.nativeWidgetOrder).toEqual(['rows', 'rows.0.seed', 'rows.0.seed.0']);
    expect(resolved.values['rows.0.seed::control_after_generate']).toBe('fixed');
    expect(resolved.values['rows.0.seed']).toBe(20);
  });

  it('updates the native named after-run control of an ordinary node, including a declared name override', () => {
    const db = open(); upsertObjectInfo(db, parseObjectInfo({ SeedControl: { input: { required: { seed: ['INT', { default: 10, control_prefix: 'left' }] } }, output: [] } }));
    const document = { version: 1, state: { lastNodeId: 1, lastLinkId: 0 }, nodes: [{ id: 1, type: 'SeedControl', pos: [0, 0], size: [200, 100], flags: {}, order: 0, mode: 0, properties: {},
      widgets_values: [10, 'randomize'], widgets_values_named: { seed: 10, 'left control_after_generate': 'randomize' } }], links: [] };
    applied(db, { type: 'import-workflow', document });
    applied(db, { type: 'set-parameter', nodeId: '1', key: 'seed::control_after_generate', value: 'fixed' });
    expect(exportDoc(db).nodes[0]).toMatchObject({ widgets_values: [10, 'fixed'], widgets_values_named: { seed: 10, 'left control_after_generate': 'fixed' } });
    expect(document.nodes[0].widgets_values_named['left control_after_generate']).toBe('randomize');
  });
});
