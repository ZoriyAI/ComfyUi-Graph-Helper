/**
 * Protects the saved chat: messages come back in order per project, a streaming update replaces its row, long
 * answers are kept whole up to the row guard, secret-looking text is redacted, and the exact held key or token is
 * refused outright. A person reopening the app expects the whole conversation back and no key written to disk.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { CHAT_CONTENT_CAP, loadChatHistory, saveChatMessage } from '../../../src/main/agent/chatHistory';
import { ensureWorkspace } from '../../../src/main/commands/commit';
import { migrate } from '../../../src/main/settings/migrate';
import { DESKTOP_PROJECT_ID } from '../../../src/shared/project';
import type { ChatRecord } from '../../../src/shared/contracts';
import { chatRecordFromMessage, isFailedTurn, messageFromChatRecord } from '../../../src/renderer/services/llm/chatModel';
import { mainLLMService } from '../../../src/main/llmService';

/** A fresh in-memory database with the schema and the desktop workspace. */
function openDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  ensureWorkspace(db);
  return db;
}

/** A valid person message in the desktop project; each case overrides only what it tests. */
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

  it('stores long messages whole up to the 1M row guard, and says what was left out past it', () => {
    const db = openDb();
    expect(saveChatMessage(db, record({ id: 'long', content: 'y'.repeat(200_000) }))).toEqual({ ok: true });
    expect(loadChatHistory(db, DESKTOP_PROJECT_ID)[0].content).toHaveLength(200_000);
    expect(saveChatMessage(db, record({ id: 'huge', timestamp: 5, content: 'x'.repeat(CHAT_CONTENT_CAP + 10) }))).toEqual({ ok: true });
    const huge = loadChatHistory(db, DESKTOP_PROJECT_ID).find((item) => item.id === 'huge')!;
    expect(huge.content.startsWith('x'.repeat(CHAT_CONTENT_CAP))).toBe(true);
    expect(huge.content.endsWith('[… 10 characters not stored]')).toBe(true);
  });

  it('loads every stored message, not only the latest 500', () => {
    const db = openDb();
    for (let index = 0; index < 650; index += 1) saveChatMessage(db, record({ id: `m${index}`, timestamp: index + 1, content: `m${index}` }));
    const loaded = loadChatHistory(db, DESKTOP_PROJECT_ID);
    expect(loaded).toHaveLength(650);
    expect(loaded[0].content).toBe('m0');
  });

  it('redacts secret-shaped text instead of refusing the message', () => {
    const db = openDb();
    // No held key is set, so only the pattern redaction is at work.
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
    mainLLMService.setSessionKey('google', HELD);
    try {
      expect(saveChatMessage(db, record({ content: `oops ${HELD}` })).ok).toBe(false);
      expect(saveChatMessage(db, record({ content: 'fine' })).ok).toBe(true);
    } finally {
      mainLLMService.forgetKeys();
    }
  });
});

it('keeps the failure marker through the database and renderer round trip without guessing from text', () => {
  const db = openDb();
  const failed = chatRecordFromMessage({ id: 'failed', role: 'assistant', content: 'The provider stopped', timestamp: 1, failed: true }, DESKTOP_PROJECT_ID, null);
  expect(saveChatMessage(db, failed)).toEqual({ ok: true });
  expect(saveChatMessage(db, record({ id: 'ordinary', role: 'assistant', content: 'Error: is a word in this explanation', timestamp: 2 }))).toEqual({ ok: true });
  const messages = loadChatHistory(db, DESKTOP_PROJECT_ID).map(messageFromChatRecord);
  expect(messages.map(isFailedTurn)).toEqual([true, false]);
  db.close();
});
