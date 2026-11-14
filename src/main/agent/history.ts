import { CHARS_PER_TOKEN, estimateTokens } from '../../shared/agent/contextWindow';

/**
 * Keeps a turn's dialog within a token budget taken from the model's context window (see
 * shared/agent/contextWindow.ts): the newest messages stay, the oldest go first. The system prompt is not part of
 * the dialog and is never trimmed. A tool result is never kept without the assistant message that called it, and
 * the kept dialog starts with a person's message; the latest message is always kept. The caller tells the model how
 * many messages were left out (`omitted`), so nothing disappears silently.
 */

type Message = { role: string; content: unknown };

export interface TrimmedHistory<T> {
  messages: T[];
  /** Earlier messages that did not fit. */
  omitted: number;
}

function size(message: Message): number {
  if (typeof message.content === 'string') return message.content.length;
  try {
    return JSON.stringify(message.content ?? '').length;
  } catch {
    return 0;
  }
}

export function trimHistory<T extends Message>(messages: T[], budgetTokens: number, charsPerToken = CHARS_PER_TOKEN): TrimmedHistory<T> {
  if (messages.length === 0) return { messages, omitted: 0 };
  const tokens = (message: Message) => estimateTokens(size(message), charsPerToken);
  let start = messages.length - 1;
  let used = tokens(messages[start]);
  while (start > 0 && used + tokens(messages[start - 1]) <= budgetTokens) {
    start -= 1;
    used += tokens(messages[start]);
  }
  // A tool message answers the assistant call before it; without that call it cannot stand first.
  while (start < messages.length - 1 && messages[start].role !== 'user') start += 1;
  return { messages: messages.slice(start), omitted: start };
}

/** The line the model reads when earlier messages were left out. */
export function omittedHistoryText(omitted: number): string {
  if (omitted <= 0) return '';
  return `${omitted} earlier ${omitted === 1 ? 'message was' : 'messages were'} left out of this conversation to fit the model's context window; ask the person for details if needed.`;
}
