/**
 * Protects canvas additions that wait on something (a search, a class check, placement, model metadata, the commit):
 * each one remembers the level and graph where the person started it and is refused if they moved to another
 * subgraph or another graph meanwhile, and Ctrl+Z waits for a pending add before it undoes. Without this a node
 * could land inside the wrong subgraph, or Undo could take back the person's earlier work instead.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { addNote } from '../../src/renderer/commands/editingCommands';
import { addCheckedNode, addTypedNode } from '../../src/renderer/components/graph/AddNodeSearch';
import { addNodeFromLibrary } from '../../src/renderer/components/library/NodeLibrary';
import { addModelLoader, putModelIntoNode, selectedLoaderFor } from '../../src/renderer/components/library/placeModel';
import { placeNewNode } from '../../src/renderer/components/graph/placeNode';
import { useProjectionStore, setManualGate } from '../../src/renderer/services/commands/projection';
import { useGraphStore } from '../../src/renderer/state/graphState';
import { useCanvasStore } from '../../src/renderer/components/graph/canvasStore';
import { pendingCommits } from '../../src/renderer/services/commands/pending';
import { showToast } from '../../src/renderer/ui/toastStore';
import { revealNewNode } from '../../src/renderer/components/graph/lib/reveal';
import { undo } from '../../src/renderer/commands/undo';
import { useUndoStore } from '../../src/renderer/state/undoState';
import { commitCommand, ensureWorkspace, listRevisions, readProjection } from '../../src/main/commands/commit';
import { upsertObjectInfo } from '../../src/main/catalog/repository';
import { parseObjectInfo } from '../../src/shared/catalog/objectInfo';
import { migrate } from '../../src/main/settings/migrate';
import { commitManual } from '../../src/renderer/components/graph/commit';

vi.mock('../../src/renderer/components/graph/placeNode', () => ({ placeNewNode: vi.fn(async () => ({ x: 0, y: 0 })) }));
vi.mock('../../src/renderer/components/graph/lib/reveal', () => ({ addedNodeId: (r: any) => r?.result?.nodeId ?? null, revealNewNode: vi.fn() }));
vi.mock('../../src/renderer/ui/toastStore', () => ({ showToast: vi.fn() }));

/** A promise the test resolves by hand, to switch levels while an add is waiting on it. */
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
const model = { directory: 'checkpoints', name: 'chosen.safetensors' };
const node = { id: '1', type: 'comfy', position: { x: 0, y: 0 }, data: { comfyType: 'CheckpointLoaderSimple', inputs: [], outputs: [], parameters: { ckpt_name: 'old.safetensors' } } };
const definition = (id: string) => ({ id, name: id, nodes: [structuredClone(node)], edges: [], inputs: [], outputs: [], nestedIn: null, raw: {} });
const detail = { displayName: 'Loader', inputs: [{ widget: true, name: 'ckpt_name' }] };
const command = vi.fn(async (_request: any): Promise<any> => ({ status: 'applied', projection: null, result: { nodeId: '2' } }));
// The preload API the add paths call; every call resolves at once unless a test swaps in a deferred one.
const api = {
  commitCommand: command,
  validateNodeClass: vi.fn(async () => ({ ok: true })),
  nodeTypeDetail: vi.fn(async (): Promise<any> => detail),
  searchNodeTypes: vi.fn(async (): Promise<any[]> => []),
  listRevisions: vi.fn(async (): Promise<any[]> => []),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(placeNewNode).mockResolvedValue({ x: 0, y: 0 });
  api.nodeTypeDetail.mockResolvedValue(detail);
  api.validateNodeClass.mockResolvedValue({ ok: true });
  command.mockImplementation(async () => ({ status: 'applied', projection: null, result: { nodeId: '2' } }));
  vi.stubGlobal('window', { electronAPI: api, requestAnimationFrame: vi.fn() });
  useProjectionStore.setState({ projectId: 'desktop', graphKey: 'first', currentRevisionId: 'rev-1', revSeq: 1, activeRun: null });
  useGraphStore.setState({ nodes: [structuredClone(node)] as never, subgraphs: [definition('A'), definition('B')], activeSubgraphId: 'A', edges: [] });
  useCanvasStore.setState({ replay: null });
  setManualGate(null);
});

describe('async editor origin', () => {
  it('keeps a pending note on its original level and tracks it from the gesture', async () => {
    const placement = deferred<{ x: number; y: number }>();
    vi.mocked(placeNewNode).mockReturnValueOnce(placement.promise);
    const adding = addNote();
    expect(pendingCommits()).toBeGreaterThan(0);
    useGraphStore.setState({ activeSubgraphId: 'B' });
    placement.resolve({ x: 100, y: 100 }); await adding;
    expect(command).not.toHaveBeenCalled();
    expect(pendingCommits()).toBe(0);
  });

  it('captures the typed-search gesture before its first await', async () => {
    const search = deferred<any[]>();
    api.searchNodeTypes.mockReturnValueOnce(search.promise);
    const adding = addTypedNode('loader', null);
    useGraphStore.setState({ activeSubgraphId: 'B' });
    search.resolve([{ classType: 'CheckpointLoaderSimple' }]);
    await adding;
    expect(command).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ id: 'canvas-edit-refused' }));
    expect(pendingCommits()).toBe(0);
  });

  it.each(['level', 'graph'])('refuses an add/link gesture after a %s switch during validation', async (change) => {
    const validation = deferred<{ ok: boolean }>();
    api.validateNodeClass.mockReturnValueOnce(validation.promise as never);
    const adding = addCheckedNode('CheckpointLoaderSimple', null, undefined, { nodeId: '1', handle: 'out-0', direction: 'output', dataType: 'MODEL' });
    if (change === 'level') useGraphStore.setState({ activeSubgraphId: 'B' });
    else useProjectionStore.setState({ graphKey: 'second' });
    validation.resolve({ ok: true });
    await adding;
    expect(command).not.toHaveBeenCalled();
    expect(revealNewNode).not.toHaveBeenCalled();
    expect(pendingCommits()).toBe(0);
  });

  it('refuses a library add after leaving its definition during placement', async () => {
    const placement = deferred<{ x: number; y: number }>();
    vi.mocked(placeNewNode).mockReturnValueOnce(placement.promise);
    const adding = addNodeFromLibrary({ classType: 'CheckpointLoaderSimple', displayName: 'Loader' }, { added: 'Added', failed: 'Failed' });
    useGraphStore.setState({ activeSubgraphId: null });
    placement.resolve({ x: 10, y: 20 });
    await adding;
    expect(command).not.toHaveBeenCalled();
    expect(pendingCommits()).toBe(0);
  });

  it('refuses model additions and stale selected-loader targets with equal ids on another level', async () => {
    const target = await selectedLoaderFor(model, '1');
    expect(target?.origin.definitionId).toBe('A');
    const metadata = deferred<any>();
    api.nodeTypeDetail.mockReturnValueOnce(metadata.promise);
    const adding = addModelLoader(model);
    expect(pendingCommits()).toBe(1);
    useGraphStore.setState({ activeSubgraphId: 'B' });
    expect(await putModelIntoNode(model, target!)).toBe(false);
    metadata.resolve(detail);
    expect(await adding).toBeNull();
    expect(command).not.toHaveBeenCalled();
    expect(revealNewNode).not.toHaveBeenCalled();
    expect(pendingCommits()).toBe(0);
  });

  it('discards a selected-loader lookup that completed after a graph replacement', async () => {
    const metadata = deferred<any>();
    api.nodeTypeDetail.mockReturnValueOnce(metadata.promise);
    const lookup = selectedLoaderFor(model, '1');
    useProjectionStore.setState({ graphKey: 'second' });
    metadata.resolve(detail);
    expect(await lookup).toBeNull();
  });

  it('does not reveal a completed add after navigation while the commit was in flight', async () => {
    const reply = deferred<any>();
    command.mockReturnValueOnce(reply.promise);
    const adding = addModelLoader(model);
    await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    useGraphStore.setState({ activeSubgraphId: 'B' });
    reply.resolve({ status: 'applied', projection: null, result: { nodeId: '2' } });
    await adding;
    expect(revealNewNode).not.toHaveBeenCalled();
  });

  it('Ctrl+Z waits for exported model-loader metadata and undoes that loader, preserving prior work', async () => {
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    upsertObjectInfo(db, parseObjectInfo({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['chosen.safetensors']] } }, input_order: { required: ['ckpt_name'] }, output: ['MODEL', 'CLIP', 'VAE'] } }));
    const initial = readProjection(db, 'desktop')!;
    const previous = commitCommand(db, { projectId: 'desktop', actionId: 'previous', expectedRevisionId: initial.currentRevisionId, actor: 'manual', runId: null,
      payload: { type: 'add-node', nodeType: 'KSampler' } });
    expect(previous.status).toBe('applied');
    useProjectionStore.getState().apply(previous.projection!);
    useGraphStore.setState({ activeSubgraphId: null });
    useUndoStore.getState().setRevisions('desktop', listRevisions(db, 'desktop'));
    api.listRevisions.mockImplementation(async () => listRevisions(db, 'desktop'));
    command.mockImplementation(async (request) => { const result = commitCommand(db, request); expect(result.status, JSON.stringify(result.result)).toBe('applied'); return result; });
    const metadata = deferred<any>();
    api.nodeTypeDetail.mockReturnValueOnce(metadata.promise);
    const adding = addModelLoader(model);
    // Undo is pressed while the loader add still waits for its metadata; it must not run first.
    const undoing = undo();
    // Let pending microtasks run, so an undo that did not wait would have sent its command by now.
    await Promise.resolve();
    await Promise.resolve();
    expect(command).not.toHaveBeenCalled();
    expect(pendingCommits()).toBe(1);
    metadata.resolve(detail);
    expect(await adding, JSON.stringify(vi.mocked(showToast).mock.calls)).not.toBeNull();
    await undoing;
    expect(command.mock.calls.map(([request]) => request.payload.type)).toEqual(['add-node', 'restore-revision']);
    expect(readProjection(db, 'desktop')!.snapshot.nodes.map((item) => (item as { data: { comfyType: string } }).data.comfyType)).toEqual(['KSampler']);
    expect(pendingCommits()).toBe(0);
    db.close();
  });

  it('Undo rechecks edits that started while it was reading history', async () => {
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    const saved = commitCommand(db, { projectId: 'desktop', actionId: 'saved', expectedRevisionId: readProjection(db, 'desktop')!.currentRevisionId, actor: 'manual', runId: null,
      payload: { type: 'add-node', nodeType: 'KSampler' } });
    const first = commitCommand(db, { projectId: 'desktop', actionId: 'first', expectedRevisionId: saved.projection!.currentRevisionId, actor: 'manual', runId: null,
      payload: { type: 'add-node', nodeType: 'VAEDecode' } });
    useProjectionStore.setState({ revSeq: 0 });
    useProjectionStore.getState().apply(first.projection!);
    useGraphStore.setState({ activeSubgraphId: null });
    useUndoStore.getState().setRevisions('desktop', listRevisions(db, 'desktop'));
    const delivery = deferred<void>();
    command.mockImplementation(async (request) => {
      if (request.payload.type === 'add-node') await delivery.promise;
      return commitCommand(db, request);
    });
    let adding: Promise<unknown> | undefined;
    api.listRevisions.mockImplementation(async () => {
      // A second gesture starts after Undo's first pending-edit check, while history is being read.
      adding ??= commitManual({ type: 'add-node', nodeType: 'VAEDecode' });
      return listRevisions(db, 'desktop');
    });
    const undoing = undo();
    await vi.waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    delivery.resolve();
    await adding;
    await undoing;
    expect(readProjection(db, 'desktop')!.snapshot.nodes.map(item => (item as { id: string }).id))
      .toEqual(first.projection!.snapshot.nodes.map(item => (item as { id: string }).id));
    expect(command.mock.calls.at(-1)![0].payload).toEqual({ type: 'restore-revision', revisionId: first.projection!.currentRevisionId });
    expect(pendingCommits()).toBe(0);
    db.close();
  });
});
