import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { CHAT_CONTENT_CAP, loadChatHistory, saveChatMessage } from '../../../src/main/agent/chatHistory';
import { ensureWorkspace } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import type { ChatRecord } from '../../../src/shared/contracts';

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

  it('refuses secrets and malformed records without writing', () => {
    const db = openDb();
    expect(saveChatMessage(db, record({ content: 'my key is sk-abc123def' })).ok).toBe(false);
    expect(saveChatMessage(db, record({ content: 'api_key: 123' })).ok).toBe(false);
    expect(saveChatMessage(db, record({ content: 'Authorization: Bearer xyz' })).ok).toBe(false);
    expect(saveChatMessage(db, record({ toolCalls: [{ args: { token: 'sk-zzz999' } }] })).ok).toBe(false);
    expect(saveChatMessage(db, { ...record({}), role: 'tool' }).ok).toBe(false);
    expect(saveChatMessage(db, null).ok).toBe(false);
    expect(saveChatMessage(db, record({ projectId: 'missing-project' })).ok).toBe(false);
    const raw = db.prepare('SELECT content, tool_calls FROM chat_messages').all();
    expect(raw).toEqual([]);
  });
});
