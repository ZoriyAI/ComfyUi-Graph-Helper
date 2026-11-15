import { describe, expect, it } from 'vitest';
import { mainLLMService } from '../../src/main/llmService';

/**
 * Installed AI SDK (`ai` TextStreamPart) text-delta contract:
 * `{ type: 'text-delta', id: string, text: string }`.
 * The provider stream uses `delta`; `streamText().fullStream` exposes `text`.
 * This test consumes the real fullStream through MainLLMService. No stubbed chunks.
 */
const EXPECTED_REPLY = 'I have added a TestNode and annotated it.';

describe('mainLLMService.streamChatWithTools', () => {
  it('emits text-start, text-delta.text, text-end, and finish for the test model', async () => {
    mainLLMService.setConfig({ provider: 'test', model: 'test-fixture' });

    const executed: string[] = [];
    const tools = {
      addNode: {
        description: 'Add a node to the graph',
        parameters: {
          type: 'object',
          properties: {
            nodeType: { type: 'string' },
            title: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['nodeType'],
        },
        execute: async (args: { nodeType: string }) => {
          executed.push(`addNode:${args.nodeType}`);
          return { success: true, nodeId: 'node-from-sdk', nodeType: args.nodeType };
        },
      },
      annotateNode: {
        description: 'Annotate a node',
        parameters: {
          type: 'object',
          properties: {
            nodeId: { type: 'string' },
            annotation: { type: 'string' },
          },
          required: ['nodeId', 'annotation'],
        },
        execute: async (args: { nodeId: string }) => {
          executed.push(`annotateNode:${args.nodeId}`);
          return { success: true, nodeId: args.nodeId };
        },
      },
    };

    const chunks: Array<{ type: string; content: any }> = [];
    for await (const chunk of mainLLMService.streamChatWithTools(
      [{ role: 'user', content: 'Add a test node' }],
      tools
    )) {
      // A stream that never ends fails on the test's own time limit, not on a wall-clock check that a busy
      // machine trips.
      chunks.push(chunk);
    }

    const types = chunks.map((chunk) => chunk.type);
    expect(types).toContain('text-start');
    expect(types).toContain('text-delta');
    expect(types).toContain('text-end');
    expect(types).toContain('finish');
    expect(types).not.toContain('error');

    const textDeltas = chunks.filter((chunk) => chunk.type === 'text-delta');
    expect(textDeltas.length).toBe(EXPECTED_REPLY.length);
    const ids = new Set<string>();
    for (const chunk of textDeltas) {
      expect(typeof chunk.content.text).toBe('string');
      expect(chunk.content).not.toHaveProperty('delta');
      expect(typeof chunk.content.id).toBe('string');
      expect(chunk.content.id.length).toBeGreaterThan(0);
      ids.add(chunk.content.id);
    }
    expect(ids.size).toBe(1);
    expect(textDeltas.map((chunk) => chunk.content.text).join('')).toBe(EXPECTED_REPLY);

    const start = chunks.find((chunk) => chunk.type === 'text-start');
    const end = chunks.find((chunk) => chunk.type === 'text-end');
    expect(start?.content.id).toBe([...ids][0]);
    expect(end?.content.id).toBe([...ids][0]);

    const finish = chunks.find((chunk) => chunk.type === 'finish');
    expect(['stop', 'tool-calls', 'other']).toContain(finish?.content.finishReason);

    expect(executed).toEqual(['addNode:TestNode', 'annotateNode:node-from-sdk']);
  }, 15000);
});
