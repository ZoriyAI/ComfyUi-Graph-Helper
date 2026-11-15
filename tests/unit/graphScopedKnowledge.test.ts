/**
 * The renderer side of explanations scoped by graph and by subgraph definition: object refs (contracts/objects,
 * graph/lib/selection) and the knowledge store as projections arrive (state/knowledgeState with
 * services/commands/projection). Node ids repeat across graphs and inside definitions, so without the scope a person
 * would read the note written for another graph's node 3 on this one.
 */
import { describe, expect, it, vi } from 'vitest';
import { inSubgraph, objectKey, objectScope, type ObjectRef } from '../../src/shared/contracts/objects';
import type { Explanation } from '../../src/shared/contracts/knowledge';
import type { Projection } from '../../src/shared/commands/types';
import { DESKTOP_PROJECT_ID } from '../../src/shared/project';
import { edgeRef, nodeRef, portRef, sameRefs, selectionRefs } from '../../src/renderer/components/graph/lib/selection';

describe('object refs inside a subgraph definition', () => {
  it('name their definition, so node 3 inside is not node 3 of the main canvas', () => {
    const root = nodeRef({ id: '3', data: { comfyType: 'KSampler' } });
    const inner = nodeRef({ id: '3', data: { comfyType: 'KSampler' } }, 'def-a');
    expect(root).toEqual({ kind: 'node', id: '3', classType: 'KSampler' });
    expect(inner).toEqual({ kind: 'node', id: '3', classType: 'KSampler', subgraphId: 'def-a' });
    expect(objectKey(root)).not.toBe(objectKey(inner));
    expect(objectKey(inner)).not.toBe(objectKey(nodeRef({ id: '3' }, 'def-b')));
    expect(objectScope(inner)).toBe('def-a');
    expect(objectKey(portRef('3', 'in-0', 'input', 'model', 'def-a'))).toBe('port:3:input:model@def-a');
    expect(objectKey(edgeRef('link-1'))).toBe('edge:link-1');
    // Kinds that are not drawn inside a definition ignore it.
    const classRef: ObjectRef = { kind: 'nodeClass', id: 'KSampler', subgraphId: 'def-a' };
    expect(objectScope(classRef)).toBe('');
    expect(inSubgraph(classRef, 'def-b')).toBe(classRef);
    expect(inSubgraph(inner, null)).toEqual(root);
  });

  it('selection refs of a definition carry it, and a change of definition is a change of selection', () => {
    const nodes = [{ id: '1', selected: true, data: { comfyType: 'VAELoader' } }];
    const edges = [{ id: 'link-2', selected: true }];
    const port = portRef('1', 'out-0', 'output', 'VAE');
    const inner = selectionRefs(nodes, edges, port, 'def-a');
    expect(inner.map(objectScope)).toEqual(['def-a', 'def-a', 'def-a']);
    expect(sameRefs(inner, selectionRefs(nodes, edges, port))).toBe(false);
    expect(sameRefs(inner, selectionRefs(nodes, edges, port, 'def-a'))).toBe(true);
  });
});

describe('the knowledge store when another graph is on screen', () => {
  it('drops the old graph’s words at once and reads the new graph’s, keeping class knowledge', async () => {
    let graph = 'A';
    const listExplanations = vi.fn(async (request: { owner?: ObjectRef }): Promise<Explanation[]> => {
      const owner = request.owner!;
      const text = owner.kind === 'nodeClass' ? 'class' : `graph ${graph}`;
      return [{ id: `${graph}-${objectKey(owner)}`, projectId: DESKTOP_PROJECT_ID, owner, aspect: 'what', text, provenance: 'user', sourceUrl: null, revisionId: null, createdBy: 'user', createdAt: 1 }];
    });
    // The test runs without a window; the store asks window.electronAPI, so a fake bridge with only this call stands in.
    (globalThis as unknown as { window: unknown }).window = { electronAPI: { listExplanations } };
    const { useKnowledgeStore } = await import('../../src/renderer/state/knowledgeState');
    const { applyProjection } = await import('../../src/renderer/services/commands/projection');
    const projection = (revSeq: number, graphKey: string): Projection => ({
      projectId: DESKTOP_PROJECT_ID, snapshot: { nodes: [], edges: [] }, currentRevisionId: `rev-${revSeq}`, revSeq, activeRun: null, graphKey,
    });
    const node: ObjectRef = { kind: 'node', id: '1' };
    const classRef: ObjectRef = { kind: 'nodeClass', id: 'KSampler' };
    expect(applyProjection(projection(1, 'graph-a'))).toBe(true);
    await useKnowledgeStore.getState().loadExplanations(node);
    await useKnowledgeStore.getState().loadExplanations(classRef);
    expect(useKnowledgeStore.getState().explanations[objectKey(node)][0].text).toBe('graph A');

    // An edit keeps the graph: nothing is read again.
    listExplanations.mockClear();
    applyProjection(projection(2, 'graph-a'));
    expect(listExplanations).not.toHaveBeenCalled();

    graph = 'B';
    applyProjection(projection(3, 'graph-b'));
    // At once: no card shows graph A's words on graph B's node 1 while the new list is read.
    expect(useKnowledgeStore.getState().explanations[objectKey(node)]).toBeUndefined();
    expect(useKnowledgeStore.getState().explanations[objectKey(classRef)][0].text).toBe('class');
    await vi.waitFor(() => expect(useKnowledgeStore.getState().explanations[objectKey(node)]?.[0].text).toBe('graph B'));
  });
});
