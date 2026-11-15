/**
 * Protects the "why" each build step carries: the build tools accept an optional reason, clip it, drop secret-looking
 * text, save it as an explanation after the commit and announce the step to the chat right after the canvas update.
 * A person watching the assistant build reads these reasons step by step, so a lost or leaked one is visible to them.
 * The last case runs the offline test transport through a full text to image build.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBuildTools, stepWhy } from '../../../src/main/agent/buildTools';
import { runAgentTurn } from '../../../src/main/agent/turn';
import { mainLLMService } from '../../../src/main/llmService';
import { ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { mutationFromTool } from '../../../src/shared/commands/tools';
import { BUILD_TOOL_SPECS } from '../../../src/shared/commands/toolSpecs';
import { BUILD_STEP_TOOLS, type AgentBuildStep } from '../../../src/shared/contracts';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { fakeKnowledge, fakeProposals } from './fakes';

/** A fresh in-memory database with the schema and the desktop workspace. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

describe('build tool `why`', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is an optional string of at most 600 characters on every step tool, and mutationFromTool ignores it', () => {
    for (const name of BUILD_STEP_TOOLS) {
      const spec = BUILD_TOOL_SPECS.find((item) => item.name === name)!;
      expect(spec.parameters.properties.why, name).toMatchObject({ type: 'string', maxLength: 600 });
      expect(spec.parameters.required).not.toContain('why');
    }
    expect(BUILD_TOOL_SPECS.find((item) => item.name === 'annotateNode')!.parameters.properties.why).toBeUndefined();
    expect(mutationFromTool('addNode', { nodeType: 'KSampler', why: 'because' })).toEqual(mutationFromTool('addNode', { nodeType: 'KSampler' }));
    expect(mutationFromTool('removeNode', { nodeId: '4', why: 'x' })).toEqual({ type: 'remove-node', nodeId: '4' });
  });

  it('keeps a trimmed, clipped why and drops a secret-looking one', () => {
    expect(stepWhy({ why: '  one   sentence ' })).toBe('one sentence');
    expect(stepWhy({ why: 'x'.repeat(900) })).toHaveLength(600);
    expect(stepWhy({ why: 'use sk-abc123' })).toBe('');
    expect(stepWhy({})).toBe('');
  });

  it('saves the why as an inference explanation after the commit and announces the step after the projection', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const knowledge = fakeKnowledge();
    const events: string[] = [];
    const steps: AgentBuildStep[] = [];
    const tools = createBuildTools(BUILD_TOOL_SPECS, {
      db,
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      onProjection: () => events.push('projection'),
      onBuildStep: (step) => { events.push('build-step'); steps.push(step); },
      saveWhy: knowledge.saveExplanation,
    });
    const loader = await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple', why: 'Brings the model.' }, { toolCallId: 'c1' }) as Record<string, unknown>;
    expect(loader).toMatchObject({ success: true, why: 'Brings the model.', explanationId: 'exp-1' });
    const sampler = await tools.addNode.execute({ nodeType: 'KSampler' }, { toolCallId: 'c2' }) as Record<string, unknown>;
    expect(sampler.why).toBeUndefined();
    const link = await tools.connectNodes.execute({ sourceNodeId: loader.nodeId, sourceHandle: 'out-0', targetNodeId: sampler.nodeId, targetHandle: 'in-0', why: 'The sampler needs the model.' }, { toolCallId: 'c3' }) as Record<string, unknown>;
    expect(link).toMatchObject({ success: true, explanationId: 'exp-2' });
    // A removal keeps its why in the result but saves no explanation: the node it would belong to is gone.
    const removed = await tools.removeNode.execute({ nodeId: sampler.nodeId, why: 'Not needed after all.' }, { toolCallId: 'c4' }) as Record<string, unknown>;
    expect(removed).toMatchObject({ success: true, why: 'Not needed after all.', explanationId: null });
    const note = await tools.annotateNode.execute({ nodeId: loader.nodeId, annotation: 'x', why: 'ignored' }, { toolCallId: 'c5' }) as Record<string, unknown>;
    expect(note.why).toBeUndefined();

    // The trailing projection is the annotation, which is not a build step.
    expect(events).toEqual(['projection', 'build-step', 'projection', 'build-step', 'projection', 'build-step', 'projection', 'build-step', 'projection']);
    expect(knowledge.saved).toEqual([
      expect.objectContaining({ owner: { kind: 'node', id: loader.nodeId, classType: 'CheckpointLoaderSimple' }, aspect: 'why', provenance: 'inference', createdBy: 'ai', projectId: DESKTOP_PROJECT_ID, text: 'Brings the model.' }),
      expect.objectContaining({ owner: { kind: 'edge', id: link.edgeId }, aspect: 'why', provenance: 'inference', createdBy: 'ai' }),
    ]);
    expect(knowledge.saved[0].revisionId).toMatch(/^rev-/);
    expect(steps[0]).toMatchObject({ toolName: 'addNode', toolCallId: 'c1', nodeId: loader.nodeId, why: 'Brings the model.', explanationId: 'exp-1', explanation: { id: 'exp-1' } });
    expect(steps[1]).toMatchObject({ toolName: 'addNode', why: '', explanationId: null });
    expect(steps[2]).toMatchObject({ toolName: 'connectNodes', nodeId: sampler.nodeId, edgeId: link.edgeId, why: 'The sampler needs the model.' });
    expect(steps[3]).toMatchObject({ toolName: 'removeNode', nodeId: sampler.nodeId, explanationId: null });
    expect(steps[0].revisionId).toBe(knowledge.saved[0].revisionId);
  });

  it('names the ends of a link and the node a removal took, for the chat, and keeps the message the model reads', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const tools = createBuildTools(BUILD_TOOL_SPECS, {
      db,
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      toolContext: () => ({ snapshot: readProjection(db, DESKTOP_PROJECT_ID)?.snapshot as { nodes: Array<Record<string, unknown>> } }),
    });
    const loader = await tools.addNode.execute({ nodeType: 'CheckpointLoaderSimple' }, { toolCallId: 'c1' }) as Record<string, unknown>;
    const sampler = await tools.addNode.execute({ nodeType: 'KSampler', title: 'My sampler' }, { toolCallId: 'c2' }) as Record<string, unknown>;
    const link = await tools.connectNodes.execute({ sourceNodeId: loader.nodeId, sourceHandle: 'out-0', targetNodeId: sampler.nodeId, targetHandle: 'in-0' }, { toolCallId: 'c3' }) as Record<string, unknown>;
    expect(link).toMatchObject({
      success: true,
      message: 'Connected the nodes',
      sourceNodeId: loader.nodeId,
      targetNodeId: sampler.nodeId,
      sourcePort: 'MODEL',
      targetPort: 'model',
      dataType: 'MODEL',
    });
    const removed = await tools.removeNode.execute({ nodeId: sampler.nodeId }, { toolCallId: 'c4' }) as Record<string, unknown>;
    expect(removed).toMatchObject({ success: true, message: 'Removed the node', removedType: 'KSampler', removedTitle: 'My sampler' });
  });

  it('keeps the commit when the save fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const tools = createBuildTools(BUILD_TOOL_SPECS, {
      db,
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      saveWhy: () => { throw new Error('no table'); },
    });
    expect(await tools.addNode.execute({ nodeType: 'KSampler', why: 'x' }, { toolCallId: 'c1' })).toMatchObject({ success: true, explanationId: null });
    expect(readProjection(db, DESKTOP_PROJECT_ID)?.snapshot.nodes).toHaveLength(1);
  });
});

describe('TEST transport: build a text to image graph', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // The test provider plays a recorded build without a network or a key.
    mainLLMService.setConfig({ provider: 'test', model: 'test-fixture' });
  });
  afterEach(() => {
    mainLLMService.setConfig({ provider: '' });
    vi.restoreAllMocks();
  });

  it('builds seven nodes and nine connections one tool call per step, each with a why and a build-step chunk', async () => {
    const db = openDb();
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const knowledge = fakeKnowledge();
    const chunks: Array<{ type: string; content?: unknown }> = [];
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'build a text to image graph' }],
      toolSpecs: BUILD_TOOL_SPECS,
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      context: { intent: 'build', selection: [] },
      language: 'en',
      send: (chunk) => chunks.push(chunk),
      notify: () => undefined,
      knowledge,
      proposals: fakeProposals(),
      // Any web lookup during the turn fails at once instead of reaching the internet.
      fetchImpl: async () => { throw new Error('no network'); },
    });
    const types = chunks.map((chunk) => chunk.type);
    expect(types).not.toContain('error');
    expect(types[types.length - 1]).toBe('done');
    const snapshot = readProjection(db, DESKTOP_PROJECT_ID)!.snapshot as { nodes: Array<{ data: { comfyType: string } }>; edges: unknown[] };
    expect(snapshot.nodes.map((node) => node.data.comfyType)).toEqual(['CheckpointLoaderSimple', 'CLIPTextEncode', 'CLIPTextEncode', 'EmptyLatentImage', 'KSampler', 'VAEDecode', 'SaveImage']);
    expect(snapshot.edges).toHaveLength(9);
    const steps = chunks.filter((chunk) => chunk.type === 'build-step').map((chunk) => chunk.content as AgentBuildStep);
    // Seven nodes plus nine links make sixteen steps.
    expect(steps).toHaveLength(16);
    expect(steps.every((step) => step.why.length > 0 && step.explanationId)).toBe(true);
    // Each build-step directly follows its projection.
    types.forEach((type, index) => { if (type === 'build-step') expect(types[index - 1]).toBe('projection'); });
    expect(knowledge.saved).toHaveLength(16);
    const text = chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => (chunk.content as { text: string }).text).join('');
    expect(text).toContain('step by step');
  }, 20000);
});
