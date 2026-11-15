/**
 * Protects the long chat: the saved history loads in pages of 200, newest first, with nothing lost between pages,
 * and the up and down arrows in the message box bring back the person's earlier messages. A person with a long
 * conversation must be able to scroll back to the start and reuse what they typed.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { loadChatHistory, saveChatMessage } from '../../src/main/agent/chatHistory';
import { migrate } from '../../src/main/settings/migrate';
import { ensureWorkspace } from '../../src/main/commands/commit';
import { recallStep } from '../../src/renderer/services/llm/recall';

describe('the chat loads in pages (RB-11) and the up arrow brings back earlier messages', () => {
  it('returns the newest page first and older pages before a message, nothing lost', () => {
    const db = new Database(':memory:');
    migrate(db);
    ensureWorkspace(db);
    for (let index = 0; index < 450; index += 1) {
      // Three messages share each timestamp, so page boundaries must not rely on time alone.
      saveChatMessage(db, { id: `m${index}`, projectId: 'desktop', role: index % 2 ? 'assistant' : 'user', content: `message ${index}`, timestamp: 1000 + Math.floor(index / 3), graphRevisionId: null, toolCalls: null }, () => false);
    }
    expect(loadChatHistory(db, 'desktop')).toHaveLength(450);
    const newest = loadChatHistory(db, 'desktop', { limit: 200 });
    expect(newest).toHaveLength(200);
    expect(newest.at(-1)!.id).toBe('m449');
    expect(newest[0].id).toBe('m250');
    const older = loadChatHistory(db, 'desktop', { limit: 200, beforeId: newest[0].id });
    expect(older.map((item) => item.id)).toEqual(Array.from({ length: 200 }, (_, index) => `m${index + 50}`));
    const oldest = loadChatHistory(db, 'desktop', { limit: 200, beforeId: older[0].id });
    expect(oldest).toHaveLength(50);
    expect([...oldest, ...older, ...newest].map((item) => item.id)).toEqual(loadChatHistory(db, 'desktop').map((item) => item.id));
    expect(loadChatHistory(db, 'desktop', { limit: 200, beforeId: 'missing' })).toEqual([]);
  });

  it('↑ and ↓ walk through the person\'s messages, newest first', () => {
    const sent = ['first', 'second', 'third'];
    let step = recallStep(sent, null, 'up');
    expect(step).toEqual({ position: 0, text: 'third' });
    step = recallStep(sent, step.position, 'up');
    expect(step.text).toBe('second');
    step = recallStep(sent, 2, 'up');
    expect(step).toEqual({ position: 2, text: 'first' });
    expect(recallStep(sent, 1, 'down')).toEqual({ position: 0, text: 'third' });
    expect(recallStep(sent, 0, 'down')).toEqual({ position: null, text: '' });
    expect(recallStep([], null, 'up')).toEqual({ position: null, text: '' });
  });
});
