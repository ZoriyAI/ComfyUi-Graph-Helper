import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { instanceGraph, instanceParameterMutation, lessonContextKey, parameterAddress, validInstanceDepth, type InstanceGraphSource } from '../../src/renderer/components/graph/lib/instanceContext';
import { lessonGraphInContext, doFix } from '../../src/renderer/components/lessons/lessonModel';
import { captureEditOrigin, originIsCurrent } from '../../src/renderer/components/graph/lib/editOrigin';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { lessonStoredProgress, useLessonStore } from '../../src/renderer/state/lessonState';
import { useProjectionStore } from '../../src/renderer/services/commands/projection';
import { useCanvasStore } from '../../src/renderer/components/graph/canvasStore';
import { parsePreferences, preferencesSchema } from '../../src/shared/config/preferences';
import { commitCommand, ensureWorkspace, readProjection } from '../../src/main/commands/commit';
import { migrate } from '../../src/main/settings/migrate';
import { exportWorkflow, projectWorkflow, type GraphSnapshot } from '../../src/shared/workflow/codec';
import type { GraphEdge, GraphNode } from '../../src/renderer/types/graph';
import { INNER_ID, OUTER_ID, nestedSubgraphWorkflow } from '../e2e/fixtures/nestedSubgraphWorkflow';

vi.mock('../../src/renderer/state/preferencesState', () => ({ currentPreferences: () => parsePreferences({}), savePreferencesPatch: vi.fn(async () => true) }));

function workflow(): any {
  const raw: any = structuredClone(nestedSubgraphWorkflow);
  const outer = raw.nodes[1];
  outer.properties.proxyWidgets = [['1', '1::text']];
  outer.widgets_values = ['first copy'];
  raw.nodes.push({ ...structuredClone(outer), id: 4, title: 'Second copy', widgets_values: ['second copy'], inputs: [], outputs: [] });
  raw.state.lastNodeId = 4;
  const nested = raw.definitions.subgraphs[0].nodes[0];
  nested.properties.proxyWidgets = [['1', 'text']];
  nested.widgets_values = ['shared nested default'];
  return raw;
}

function source(copy = '2'): InstanceGraphSource {
  const parsed = projectWorkflow(workflow());
  if ('error' in parsed) throw Error(parsed.error);
  return { nodes: parsed.snapshot.nodes as GraphNode[], edges: parsed.snapshot.edges as GraphEdge[], subgraphs: parsed.snapshot.subgraphs!, subgraphPath: [OUTER_ID, INNER_ID], subgraphInstancePath: [copy, '1'] };
}

beforeEach(() => {
  useGraphStore.setState({ nodes: [], edges: [], subgraphs: [], subgraphPath: [], subgraphInstancePath: [], activeSubgraphId: null });
  useProjectionStore.setState({ projectId: 'desktop', graphKey: 'workflow', revSeq: 0, currentRevisionId: '', activeRun: null });
  useCanvasStore.setState({ replay: null });
  useLessonStore.setState({ ...parsePreferences({}).lessons, persistence: 'saved', reached: {}, learning: false });
});
afterEach(() => vi.unstubAllGlobals());

describe('lessons on a selected subgraph copy', () => {
  it('reads the outer copy override through two levels without mutating a shared definition', () => {
    const first = source();
    const before = JSON.stringify(first.subgraphs);
    const one = instanceGraph(first);
    const two = instanceGraph({ ...first, subgraphInstancePath: ['4', '1'] });
    expect(lessonGraphInContext(one, {}).nodes[0].values.text).toBe('first copy');
    expect(lessonGraphInContext(two, {}).nodes[0].values.text).toBe('second copy');
    expect(JSON.stringify(first.subgraphs)).toBe(before);
    expect(one.owners.get(parameterAddress('1', 'text'))).toEqual({ definitionId: null, nodeId: '2', widgetIndex: 0 });
    expect(instanceParameterMutation(two, '1', 'text', 'changed')).toEqual({ type: 'set-parameter', nodeId: '4', key: 'widgets::0', widgetIndex: 0, value: 'changed' });
  });

  it('keeps a template and its copies distinct, including the same inner copy under different parents', () => {
    const first = source();
    const a = lessonContextKey(first, 'p', 'g');
    const b = lessonContextKey({ ...first, subgraphInstancePath: ['4', '1'] }, 'p', 'g');
    const template = lessonContextKey({ ...first, subgraphInstancePath: [null, null] }, 'p', 'g');
    expect(new Set([a, b, template, lessonContextKey(first, 'p', 'other-graph')]).size).toBe(4);
    expect(lessonContextKey({ ...first, subgraphPath: [] }, 'p', 'g')).toBe('');
    expect(instanceParameterMutation(instanceGraph({ ...first, subgraphInstancePath: [null, null] }), '1', 'text', 'shared')).toEqual({
      type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { type: 'set-parameter', nodeId: '1', key: 'text', value: 'shared' },
    });
  });

  it('invalidates an origin when another copy of the same definition is entered', () => {
    const graph = source();
    useGraphStore.setState({ ...graph, activeSubgraphId: INNER_ID });
    const origin = captureEditOrigin();
    useGraphStore.setState({ subgraphInstancePath: ['4', '1'] });
    expect(originIsCurrent(origin)).toBe(false);
    expect(validInstanceDepth({ ...graph, nodes: graph.nodes.filter(node => node.id !== '2') })).toBe(0);
    expect(validInstanceDepth({ ...graph, subgraphInstancePath: [null, null] })).toBe(2);
  });

  it('stores reading, answers and outcomes independently and restores them through the preference schema', async () => {
    const a = lessonContextKey(source(), 'p', 'g');
    const b = lessonContextKey(source('4'), 'p', 'g');
    const state = useLessonStore.getState();
    state.markRead('image', 'intro', a);
    state.answer('image', 'practice', 'checked', 'yes', a);
    state.setOutcomes('image', ['structure', 'run-self'], a);
    state.finish('image', a);
    state.answer('image', 'practice', 'checked', 'no', b);
    await Promise.resolve();
    const stored = preferencesSchema.parse({ lessons: JSON.parse(JSON.stringify(useLessonStore.getState())) }).lessons;
    useLessonStore.setState({ ...parsePreferences({}).lessons, persistence: 'saved' });
    useLessonStore.getState().hydrate(stored);
    expect(lessonStoredProgress(useLessonStore.getState(), a)).toMatchObject({ read: { image: ['intro'] }, done: ['image'], answers: { image: { practice: { checked: 'yes' } } }, outcomes: { image: ['structure', 'run-self'] } });
    expect(lessonStoredProgress(useLessonStore.getState(), b).answers.image.practice.checked).toBe('no');
    expect(useLessonStore.getState().done).toEqual([]);
    useLessonStore.getState().again('image', b);
    expect(lessonStoredProgress(useLessonStore.getState(), b).answers).toEqual({});
    expect(lessonStoredProgress(useLessonStore.getState(), a).done).toEqual(['image']);
  });

  it('does not count a linked outside value as the inner default or change the ignored widget', () => {
    const graph = source();
    const inner = graph.subgraphs.find(item => item.id === INNER_ID)!;
    inner.inputs.push({ id: 'text-slot', name: 'text', type: 'STRING' });
    inner.nodes[0].data.inputs.push({ id: 'in-1', name: 'text', dataType: 'STRING', optional: false });
    inner.edges.push({ id: 'text-edge', source: '-10', sourceHandle: 'out-1', target: '1', targetHandle: 'in-1' });
    const outer = graph.subgraphs.find(item => item.id === OUTER_ID)!;
    outer.edges.push({ id: 'outside-value', source: '2', sourceHandle: 'out-0', target: '1', targetHandle: 'in-1' });
    const view = instanceGraph(graph);
    expect(lessonGraphInContext(view, {}).nodes[0].values.text).toBeUndefined();
    expect(instanceParameterMutation(view, '1', 'text', 'ignored')).toBeNull();
  });

  it('resets navigation when another document reuses the same definition and local node IDs', () => {
    const graph = source();
    useGraphStore.setState({ ...graph, activeSubgraphId: INNER_ID });
    useProjectionStore.getState().apply({ projectId: 'desktop', graphKey: 'other', currentRevisionId: 'new', revSeq: 1, activeRun: null, snapshot: { ...graph } } as never);
    expect(useGraphStore.getState().subgraphPath).toEqual([]);
    expect(useGraphStore.getState().subgraphInstancePath).toEqual([]);
  });

  it('applies an input widget to every inner target and keeps its single owning copy', () => {
    const graph = source();
    const definition = graph.subgraphs.find(item => item.id === INNER_ID)!;
    definition.inputs = [{ id: 'text-slot', name: 'text', type: 'STRING' }];
    definition.nodes[0].data.inputs = [{ id: 'in-0', name: 'text', dataType: 'STRING', optional: false }];
    definition.nodes.push({ ...structuredClone(definition.nodes[0]), id: 'other' });
    definition.edges = ['1', 'other'].map((id, index) => ({ id: `text-${index}`, source: '-10', sourceHandle: 'out-0', target: id, targetHandle: 'in-0' }));
    const instance: GraphNode = { id: 'boundary-copy', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: INNER_ID, kind: 'subgraph-instance', inputs: [], outputs: [], parameters: {}, comfy: { properties: { proxyWidgets: [['-1', 'text']] }, widgets_values: ['input value'] } } };
    const view = instanceGraph({ ...graph, nodes: [instance], edges: [], subgraphPath: [INNER_ID], subgraphInstancePath: [instance.id] });
    expect(lessonGraphInContext(view, {}).nodes.map(node => node.values.text)).toEqual(['input value', 'input value']);
    expect(instanceParameterMutation(view, 'other', 'text', 'both')).toMatchObject({ nodeId: instance.id, widgetIndex: 0, value: 'both' });
  });

  it('uses the shared field when an imported copy has no stored value slot to update', () => {
    const graph = source();
    graph.nodes[1].data.comfy = { properties: { proxyWidgets: [['1', '1::text']] } };
    const nested = graph.subgraphs.find(item => item.id === OUTER_ID)!.nodes[0];
    delete nested.data.comfy.widgets_values;
    const mutation = instanceParameterMutation(instanceGraph(graph), '1', 'text', 'shared');
    expect(mutation).toMatchObject({ type: 'edit-in-subgraph', definitionId: INNER_ID, edit: { nodeId: '1', key: 'text', value: 'shared' } });
  });
});

describe('a lesson change through the real command store', () => {
  it('changes only the selected copy, survives native export/import, and Undo restores it', async () => {
    const db = new Database(':memory:');
    migrate(db); ensureWorkspace(db);
    const head = () => readProjection(db, 'desktop')!;
    const commit = (actionId: string, payload: unknown) => commitCommand(db, { projectId: 'desktop', actionId, expectedRevisionId: head().currentRevisionId, actor: 'manual', runId: null, payload });
    try {
      expect(commit('import', { type: 'import-workflow', document: workflow() }).status).toBe('applied');
      useProjectionStore.getState().apply(head());
      useGraphStore.getState().enterSubgraph(OUTER_ID, '4');
      useGraphStore.getState().enterSubgraph(INNER_ID, '1');
      const before = head();
      vi.stubGlobal('window', { electronAPI: { commitCommand: (request: Parameters<typeof commitCommand>[1]) => Promise.resolve(commitCommand(db, request)) } });
      await doFix({ kind: 'set-field', nodeId: '1', field: 'text', value: 'lesson copy only' });
      const snapshot = head().snapshot as GraphSnapshot;
      expect(snapshot.nodes.find(node => node.id === '4')!.data.comfy.widgets_values[0]).toBe('lesson copy only');
      expect(snapshot.nodes.find(node => node.id === '2')!.data.comfy.widgets_values[0]).toBe('first copy');
      expect(snapshot.subgraphs).toEqual(before.snapshot.subgraphs);
      const exported = exportWorkflow(snapshot, '2026-11-17T00:00:00Z');
      expect(exported.ok).toBe(true);
      if (!exported.ok) throw Error(exported.error);
      const reread = projectWorkflow(exported.workflow);
      expect('snapshot' in reread).toBe(true);
      if ('error' in reread) throw Error(reread.error);
      expect(reread.snapshot.nodes.find(node => node.id === '4')!.data.comfy.widgets_values[0]).toBe('lesson copy only');
      expect(commit('undo', { type: 'restore-revision', revisionId: before.currentRevisionId }).status).toBe('applied');
      expect(head().snapshot.nodes).toEqual(before.snapshot.nodes);
    } finally { db.close(); }
  });
});
