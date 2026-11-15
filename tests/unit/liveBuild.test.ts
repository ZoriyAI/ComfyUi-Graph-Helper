/**
 * The live build: when the assistant builds a graph, the canvas shows it one step at a time with a callout saying
 * why (graph/lib/buildQueue.ts and canvasStore, drawn by BuildLayer; the steps arrive through the chat service). The
 * pace must leave time to read, honour reduced motion, and catch up on a backlog, and a step's why must reach the
 * callout and the knowledge store even when it arrives after the node is shown.
 */
import { describe, expect, it } from 'vitest';
import {
  CALLOUT_HOLD_MS,
  READ_PAUSE_MS,
  calloutText,
  paramKey,
  parameterChanges,
  shortValue,
  stepCounter,
  stepDelayMs,
  stepKey,
} from '../../src/renderer/components/graph/lib/buildQueue';
import { useCanvasStore } from '../../src/renderer/components/graph/canvasStore';

describe('live build pacing', () => {
  it('waits for the reveal plus a reading pause, slower when following, faster with a backlog, never when motion is off', () => {
    expect(stepDelayMs({ revealMs: 320, motion: 'full', follow: false, queued: 1 })).toBe(320 + READ_PAUSE_MS);
    expect(stepDelayMs({ revealMs: 320, motion: 'full', follow: true, queued: 1 })).toBe(Math.round((320 + READ_PAUSE_MS) * 1.6));
    expect(stepDelayMs({ revealMs: 320, motion: 'full', follow: false, queued: 14 })).toBe(Math.round((320 + READ_PAUSE_MS) * 0.6));
    // Reduced motion: no animation time, still one step at a time at reading pace.
    expect(stepDelayMs({ revealMs: 0, motion: 'reduced', follow: false, queued: 1 })).toBe(READ_PAUSE_MS);
    expect(stepDelayMs({ revealMs: 320, motion: 'off', follow: true, queued: 3 })).toBe(0);
    expect(CALLOUT_HOLD_MS).toBeGreaterThanOrEqual(3500);
  });

  it('counts steps as shown of shown plus queued', () => {
    expect(stepCounter(3, 4)).toEqual({ index: 3, total: 7 });
    expect(stepCounter(0, 0)).toEqual({ index: 1, total: 1 });
  });
});

describe('build step keys and field changes', () => {
  it('files a build-step chunk under the key the projection diff produces', () => {
    expect(stepKey({ toolName: 'addNode', nodeId: 'node-1' })).toBe('node-1');
    expect(stepKey({ toolName: 'insertSubgraph', nodeId: 'n9' })).toBe('n9');
    expect(stepKey({ toolName: 'connectNodes', nodeId: 'node-2', edgeId: 'link-3' })).toBe('link-3');
    expect(stepKey({ toolName: 'setParameter', nodeId: 'node-2', key: 'steps' })).toBe(paramKey('node-2', 'steps'));
    expect(stepKey({ toolName: 'removeNode', nodeId: 'node-2' })).toBe('remove:node-2');
    expect(stepKey({ toolName: 'connectNodes' })).toBeNull();
  });

  it('turns a changed field into an old → new item on its node', () => {
    const before = [{ id: 'a', data: { parameters: { steps: 20, cfg: 7 } } }, { id: 'b', data: {} }];
    const after = [{ id: 'a', data: { parameters: { steps: 30, cfg: 7, sampler: 'euler' } } }, { id: 'b', data: {} }, { id: 'c', data: { parameters: { x: 1 } } }];
    expect(parameterChanges(before, after)).toEqual([
      { key: 'param:a:steps', kind: 'param', anchor: 'a', change: { key: 'steps', from: '20', to: '30' } },
      { key: 'param:a:sampler', kind: 'param', anchor: 'a', change: { key: 'sampler', from: '—', to: 'euler' } },
    ]);
    expect(shortValue('x'.repeat(60))).toHaveLength(41);
    expect(shortValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe('callout text', () => {
  it('prefers the agent\'s why, then purpose, annotation, catalog, fallback', () => {
    expect(calloutText({ why: ' Because. ', purpose: 'P', catalog: 'C', fallback: 'F' })).toBe('Because.');
    expect(calloutText({ why: '', purpose: 'P', catalog: 'C', fallback: 'F' })).toBe('P');
    expect(calloutText({ why: null, annotation: 'A', catalog: 'C', fallback: 'F' })).toBe('A');
    expect(calloutText({ catalog: ' C ', fallback: 'F' })).toBe('C');
    expect(calloutText({ fallback: 'F' })).toBe('F');
  });

  it('gives a callout already on screen the why that arrives after it', () => {
    const store = useCanvasStore.getState();
    store.setCallout({ nodeId: 'node-1', key: 'node-1', kind: 'node', title: 'KSampler', text: 'Added by the helper.' });
    store.noteBuildStep('node-1', { toolName: 'addNode', why: 'Makes the image.' });
    expect(useCanvasStore.getState().callout).toMatchObject({ text: 'Makes the image.', toolName: 'addNode' });
    expect(useCanvasStore.getState().stepInfo['node-1']).toEqual({ toolName: 'addNode', why: 'Makes the image.' });
    // Queued nodes and edges stay hidden; field changes are not hidden.
    store.setQueue([{ key: 'n', kind: 'node', anchor: 'n' }, { key: 'param:n:steps', kind: 'param', anchor: 'n' }, { key: 'e', kind: 'edge', anchor: 'n' }]);
    expect(useCanvasStore.getState().pending).toEqual(['n', 'e']);
    store.setQueue([]);
    store.setCallout(null);
  });
});

describe('build-step chunk in the chat service', () => {
  it('puts the saved why into the knowledge store at once and files the step for the canvas', async () => {
    const { acceptBuildStep, parseBuildStep } = await import('../../src/renderer/services/llm/chatService');
    const { useKnowledgeStore } = await import('../../src/renderer/state/knowledgeState');
    expect(parseBuildStep({ toolName: 'addNode' })).toBeNull();
    expect(parseBuildStep('nope')).toBeNull();
    const explanation = {
      id: 'exp-9', projectId: 'desktop', owner: { kind: 'node', id: 'node-7', classType: 'KSampler' }, aspect: 'why', text: 'Makes the image.',
      provenance: 'inference', sourceUrl: null, revisionId: 'rev-desktop-3', createdBy: 'ai', createdAt: 5,
    };
    acceptBuildStep({ toolName: 'addNode', toolCallId: 'c1', nodeId: 'node-7', why: 'Makes the image.', explanationId: 'exp-9', explanation, revisionId: 'rev-desktop-3' });
    expect(useKnowledgeStore.getState().explanations['node:node-7']).toEqual([explanation]);
    expect(useCanvasStore.getState().stepInfo['node-7']).toEqual({ toolName: 'addNode', why: 'Makes the image.' });
  });
});
