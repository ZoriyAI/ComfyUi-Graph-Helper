import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { CHAT_CONTENT_CAP, loadChatHistory, saveChatMessage } from '../../../src/main/agent/chatHistory';
import { ensureWorkspace } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import type { ChatRecord } from '../../../src/shared/contracts';
import { mainLLMService } from '../../../src/main/llmService';

function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

const record = (overrides: Partial<ChatRecord>): ChatRecord => ({
  id: 'm1', projectId: DESKTOP_PROJECT_ID, role: 'user', content: 'hello', timestamp: 1, graphRevisionId: null, toolCalls: null, ...overrides,
});

describe('chat history', () => {
  it('round-trips messages in order with tool calls', () => {
    const db = openDb();
    expect(saveChatMessage(db, record({ id: 'm2', role: 'assistant', content: 'hi there', timestamp: 2, graphRevisionId: 'rev-1', toolCalls: [{ id: 't1', name: 'proposeNode', status: 'success' }] }))).toEqual({ ok: true });
    expect(saveChatMessage(db, record({}))).toEqual({ ok: true });
    expect(loadChatHistory(db, DESKTOP_PROJECT_ID)).toEqual([
      record({}),
      record({ id: 'm2', role: 'assistant', content: 'hi there', timestamp: 2, graphRevisionId: 'rev-1', toolCalls: [{ id: 't1', name: 'proposeNode', status: 'success' }] }),
    ]);
    // Streaming updates replace the same id.
    expect(saveChatMessage(db, record({ id: 'm2', role: 'assistant', content: 'hi there, done', timestamp: 2 }))).toEqual({ ok: true });
    expect(loadChatHistory(db, DESKTOP_PROJECT_ID).map((item) => item.content)).toEqual(['hello', 'hi there, done']);
    expect(loadChatHistory(db, 'other')).toEqual([]);
    expect(loadChatHistory(db, 42)).toEqual([]);
  });

  it('caps content at 50k characters', () => {
    const db = openDb();
    expect(saveChatMessage(db, record({ content: 'x'.repeat(CHAT_CONTENT_CAP + 10) }))).toEqual({ ok: true });
    expect(loadChatHistory(db, DESKTOP_PROJECT_ID)[0].content).toHaveLength(CHAT_CONTENT_CAP);
  });

  it('redacts secret-shaped text instead of refusing the message', () => {
    const db = openDb();
    const none = () => false;
    expect(saveChatMessage(db, record({ id: 'a', content: 'my key is sk-abc123def, keep the rest' }), none)).toEqual({ ok: true });
    expect(saveChatMessage(db, record({ id: 'b', content: 'api_key: 123', timestamp: 2 }), none)).toEqual({ ok: true });
    expect(saveChatMessage(db, record({ id: 'c', content: 'Authorization: Bearer xyz', timestamp: 3 }), none)).toEqual({ ok: true });
    expect(saveChatMessage(db, record({ id: 'd', timestamp: 4, toolCalls: [{ args: { token: 'sk-zzz999' } }] }), none)).toEqual({ ok: true });
    const stored = loadChatHistory(db, DESKTOP_PROJECT_ID);
    expect(stored.map((item) => item.content)).toEqual([
      'my key is [redacted], keep the rest',
      'api_key: [redacted]',
      'Authorization: Bearer [redacted]',
      'hello',
    ]);
    expect(stored[3].toolCalls).toEqual([{ args: { token: '[redacted]' } }]);
    const raw = JSON.stringify(db.prepare('SELECT content, tool_calls FROM chat_messages').all());
    for (const secret of ['sk-abc123def', 'sk-zzz999', 'xyz', ': 123']) expect(raw).not.toContain(secret);
  });

  it('refuses the exact held key or token and malformed records without writing', () => {
    const db = openDb();
    const HELD = 'held-plain-key-0123456789';
    const held = (text: string) => text.includes(HELD);
    expect(saveChatMessage(db, record({ content: `pasted ${HELD}` }), held).ok).toBe(false);
    expect(saveChatMessage(db, record({ toolCalls: [{ args: { value: HELD } }] }), held).ok).toBe(false);
    expect(saveChatMessage(db, { ...record({}), role: 'tool' }).ok).toBe(false);
    expect(saveChatMessage(db, null).ok).toBe(false);
    expect(saveChatMessage(db, record({ projectId: 'missing-project' })).ok).toBe(false);
    const raw = db.prepare('SELECT content, tool_calls FROM chat_messages').all();
    expect(raw).toEqual([]);
  });

  it('checks the held LLM key by default', () => {
    const db = openDb();
    const HELD = 'session-key-for-history-test-42';
    mainLLMService.setSessionKey(HELD);
    try {
      expect(saveChatMessage(db, record({ content: `oops ${HELD}` })).ok).toBe(false);
      expect(saveChatMessage(db, record({ content: 'fine' })).ok).toBe(true);
    } finally {
      mainLLMService.setSessionKey('');
    }
  });
});
