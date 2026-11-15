/**
 * Checks how the chat tells a failed turn from an answer: by the flag the chat service sets or a known error kind,
 * never by the text. An assistant answer that happens to start with "Error" stays an ordinary answer, both on
 * screen (Message) and in the history sent back to the model (chatService).
 */
import { describe, expect, it } from 'vitest';
import { isFailedTurn } from '../../src/renderer/services/llm/chatModel';

describe('failed turn', () => {
  it('is decided by the flag or the error kind, not by the text', () => {
    expect(isFailedTurn({})).toBe(false);
    expect(isFailedTurn({ failed: true })).toBe(true);
    expect(isFailedTurn({ turnError: { kind: 'key', details: '', question: 'q' } as never })).toBe(true);
    const answer = { role: 'assistant', content: 'Error handling in ComfyUI works like this.' };
    expect(isFailedTurn(answer as never)).toBe(false);
  });
});
