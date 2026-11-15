/**
 * Checks that one assistant turn sizes its graph data and its history by the same context window: a model whose
 * provider lists a small window gets a data block that fits that window, not one sized for a large default window.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataBudgetChars, runAgentTurn } from '../../../src/main/agent/turn';
import { commitCommand, ensureWorkspace, readProjection, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID as P } from '../../../src/shared/project';
import { parsePreferences } from '../../../src/shared/config/preferences';

/** A workflow of `count` samplers in a chain, as a ComfyUI file stores it. */
function workflow(count: number) {
  return {
    last_node_id: count,
    last_link_id: count - 1,
    version: 0.4,
    nodes: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      type: 'KSampler',
      pos: [index * 400, 0],
      size: [300, 260],
      title: `Sampler number ${index + 1} with a long title`,
      inputs: [{ name: 'latent_image', type: 'LATENT', link: index === 0 ? null : index }],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: index === count - 1 ? [] : [index + 1] }],
      widgets_values: [42 + index, 'fixed', 20, 7, 'euler', 'normal', 1],
    })),
    links: Array.from({ length: count - 1 }, (_, index) => [index + 1, index + 1, 0, index + 2, 0, 'LATENT']),
  };
}

describe('one context window per turn', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => undefined); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('fits the data block to the window the provider lists', async () => {
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    const current = readProjection(db, P)!;
    const imported = commitCommand(db, {
      projectId: P, actionId: 'import-1', expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null,
      payload: { type: 'import-workflow', document: workflow(150) } as never,
    });
    expect(imported.status).toBe('applied');
    const run = startRun(db, P);
    const sent: string[] = [];
    const listed = 8000;
    const llm = {
      nativeSearchTool: () => null,
      nextSendConfig: () => ({ provider: 'openai', model: 'some-unlisted-model', baseURL: '' }),
      localContextTokens: () => null,
      listedContextTokens: () => listed,
      charsPerToken: () => 4,
      async* streamChatWithTools(messages: Array<{ role: string; content: string }>) {
        sent.push(messages[messages.length - 1].content);
        yield { type: 'text-delta', content: { text: 'ok' } };
      },
    };
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'What does this graph do?' }],
      toolSpecs: [],
      run: { projectId: P, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'en',
      send: () => undefined,
      notify: () => undefined,
      llm: llm as never,
      preferences: parsePreferences({}),
      fetchImpl: async () => { throw new Error('no network'); },
    });
    expect(sent).toHaveLength(1);
    // The question follows the data block in the last message.
    const data = sent[0].slice(0, sent[0].lastIndexOf('What does this graph do?'));
    expect(data.length).toBeGreaterThan(0);
    expect(data.length).toBeLessThanOrEqual(dataBudgetChars(listed, 4) + 10);
  });
});
