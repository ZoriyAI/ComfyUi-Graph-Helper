/**
 * Protects the list of addresses the assistant's page reader may open in a conversation. A source the AI
 * provider's own web search cites is shown to the person but does not join that list, so a cited address
 * that carries the person's prompt in its query cannot be fetched by the app on the model's request.
 */
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { runAgentTurn } from '../../../src/main/agent/turn';
import { conversationLinks } from '../../../src/main/agent/links';
import { mainLLMService } from '../../../src/main/llmService';
import { ensureWorkspace, startRun } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { parsePreferences } from '../../../src/shared/config/preferences';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import { fakeKnowledge, fakeProposals } from '../agent/fakes';

describe("the provider's own web search", () => {
  it('cites sources without widening what the page reader may open', async () => {
    mainLLMService.setConfig({ provider: 'test', model: 'test-fixture' });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    const run = startRun(db, DESKTOP_PROJECT_ID);
    const cited = 'https://collect.example.net/c?d=the-person-prompt';
    await runAgentTurn({
      db,
      messages: [{ role: 'user', content: 'Hello' }],
      toolSpecs: [],
      run: { projectId: DESKTOP_PROJECT_ID, runId: run.runId, expectedRevisionId: run.expectedRevisionId },
      language: 'en',
      send: () => undefined,
      notify: () => undefined,
      knowledge: fakeKnowledge(),
      proposals: fakeProposals(),
      preferences: parsePreferences({}),
      llm: {
        nativeSearchTool: () => ({}),
        async* streamChatWithTools(_messages: unknown[], _tools: unknown, options: { onSource?: (url: string) => void }) {
          options.onSource?.(cited);
          yield { type: 'text-delta', content: { text: 'ok' } };
        },
      } as never,
    });
    expect(conversationLinks(DESKTOP_PROJECT_ID).allows(cited)).toBe(false);
  });
});
