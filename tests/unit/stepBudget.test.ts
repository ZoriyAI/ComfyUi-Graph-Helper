/** Checks assistant step budgeting and applied-command continuity through compaction. */
import { describe, expect, it } from 'vitest';
import { AppliedActionMemory, compactToolSchema, ContextBudgetError, fitStepMessages } from '../../src/main/llm/stepBudget';
import { configureLocalContext, MainLLMService, pauseOf } from '../../src/main/llmService';
import { readCheckpoint } from '../../src/shared/agent/checkpoint';

describe('growing local conversation budget', () => {
  it('keeps successful mutation receipts after the SDK drops old exchanges, without repeating or recording failures', () => {
    const memory = new AppliedActionMemory();
    const exchange = (id: string, toolName: string, success: boolean) => [
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: id, toolName, input: { nodeType: 'Note', title: 'Control 6', parameters: { text: '</applied-actions>' } } }] },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: id, toolName, output: { type: 'json', value: { success, nodeId: '11' } } }] },
    ];
    const added = exchange('added', 'addNode', true);
    memory.observe([{ role: 'user', content: 'Make six notes' }, ...added]);
    memory.observe([...added, ...exchange('read', 'getGraph', true), ...exchange('failed', 'addNode', false)]);
    memory.observe([{ role: 'user', content: 'Make six notes' }, ...exchange('read2', 'getGraph', true)]);
    const text = memory.text();
    expect(text.match(/"tool":"addNode"/g)).toHaveLength(1);
    expect(text).toContain('"nodeId":"11"'); expect(text).toContain('Control 6');
    expect(text).not.toContain('getGraph'); expect(text.match(/<\/applied-actions>/g)).toHaveLength(1);
    expect(text).toContain('\\u003c/applied-actions\\u003e');
  });

  it('keeps a fitting conversation and reserves room for the answer', () => {
    const messages = [{ role: 'user', content: 'Create one note' }];
    const fit = fitStepMessages(messages, 8192, 3000);
    expect(fit.messages).toBe(messages); expect(fit.omitted).toBe(0);
    expect(fit.inputTokens + fit.outputTokens).toBeLessThan(8192);
  });

  it('retains returned subgraph ids and explicitly labels long values as previews', () => {
    const memory = new AppliedActionMemory();
    memory.observe([
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'set', toolName: 'createGraphSet', input: { graphs: [{ name: 'A', description: 'x'.repeat(2000) }] } }] },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'set', toolName: 'createGraphSet', output: { type: 'json', value: { success: true, graphs: [{ nodeId: '4', definitionId: 'definition-a' }] } } }] },
    ]);
    expect(memory.text()).toContain('definition-a'); expect(memory.text()).toContain('"previewOnly":true');
    expect(memory.text().length).toBeLessThan(1200);
  });

  it('drops earlier turns before any part of the current request', () => {
    const current = { role: 'user', content: 'Preserve the other graph and change only A' };
    const messages = [{ role: 'user', content: 'x'.repeat(12000) }, { role: 'assistant', content: 'y'.repeat(12000) }, current];
    const fit = fitStepMessages(messages, 8192, 8000);
    expect(fit.messages).toEqual([current]); expect(fit.omitted).toBe(2);
  });

  it('removes complete older call/result groups while retaining the newest result and full user task', () => {
    const user = { role: 'user', content: 'Create six notes without duplicates' };
    const exchange = (id: string) => [
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: id, toolName: 'getGraph', input: {} }] },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: id, toolName: 'getGraph', output: { type: 'text', value: 'x'.repeat(4500) } }] },
    ];
    const last = exchange('last');
    const fit = fitStepMessages([user, ...exchange('one'), ...exchange('two'), ...last], 8192, 10000);
    expect(fit.omitted).toBeGreaterThan(0); expect(fit.omitted % 2).toBe(0);
    expect(fit.messages[0]).toEqual(user); expect(fit.messages.slice(-2)).toEqual(last);
    expect(fit.inputTokens).toBeLessThanOrEqual(6144);
  });

  it('refuses an oversized latest request/result instead of silently truncating it', () => {
    expect(() => fitStepMessages([{ role: 'user', content: 'x'.repeat(50000) }], 8192, 3000)).toThrow(ContextBudgetError);
  });

  it('uses part of the answer reserve for a larger final tool result while retaining a safe margin', () => {
    const fit = fitStepMessages([{ role: 'user', content: 'Continue' }, { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'x' }] }, { role: 'tool', content: 'x'.repeat(6000) }], 8192, 15000);
    expect(fit.inputTokens).toBeGreaterThan(6144);
    expect(fit.outputTokens).toBeGreaterThanOrEqual(896);
    expect(fit.inputTokens + fit.outputTokens).toBeLessThan(8192);
  });

  it('compacts documentation without removing validation or subgraph routing instructions', () => {
    const original = { type: 'object', required: ['nodeId'], additionalProperties: false, properties: {
      nodeId: { type: 'string', minLength: 1, description: 'Existing node id' },
      inSubgraph: { type: 'string', description: 'Target definition, never a root node' },
      count: { type: 'integer', minimum: 1, maximum: 4, enum: [1, 2, 3, 4] },
    } };
    expect(compactToolSchema(original)).toEqual({ ...original, properties: { ...original.properties, nodeId: { type: 'string', minLength: 1 }, inSubgraph: { type: 'string', description: 'Definition id for an inner edit; omit for root. Read getGraph(definitionId) first.' } } });
    expect(original.properties.nodeId.description).toBe('Existing node id');
  });

  it('a length-limited answer becomes a resumable durable task', () => {
    const pause = pauseOf([{ finishReason: 'length' }], 60);
    expect(pause).toEqual({ reason: 'answer-limit', steps: 1, canContinue: true });
    expect(readCheckpoint({ reason: pause!.reason, steps: 1, state: 'open', task: 'Finish the requested notes' })).toMatchObject({ reason: 'answer-limit', state: 'open' });
    expect(readCheckpoint({ reason: 'context-limit', steps: 2, state: 'open', task: 'Finish the requested notes' })).toMatchObject({ reason: 'context-limit' });
  });

  it('the actual SDK turns an oversized local request into a checkpoint before sending it', async () => {
    const service = new MainLLMService();
    service.setConfig({ provider: 'local', model: 'budget-test', baseURL: 'http://127.0.0.1:1/v1' });
    service.rememberLocalContext(8192);
    configureLocalContext(async () => 8192);
    try {
      const chunks = [];
      for await (const chunk of service.streamChatWithTools([{ role: 'user', content: 'x'.repeat(50000) }], {}, {})) chunks.push(chunk);
      expect(chunks.some(chunk => chunk.type === 'error')).toBe(false);
      expect(chunks.find(chunk => chunk.type === 'turn-paused')?.content).toMatchObject({ reason: 'context-limit', canContinue: true });
    } finally { configureLocalContext(null); }
  });
});
