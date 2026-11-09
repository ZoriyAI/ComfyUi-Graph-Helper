/**
 * Keeps a turn's dialog within a character budget: the newest messages stay, the oldest go first.
 * The system prompt is not part of the dialog and is never trimmed. A tool result is never kept without the
 * assistant message that called it, and the kept dialog starts with a person's message.
 */
export const HISTORY_BUDGET = 24_000;

type Message = { role: string; content: unknown };

function size(message: Message): number {
  if (typeof message.content === 'string') return message.content.length;
  try {
    return JSON.stringify(message.content ?? '').length;
  } catch {
    return 0;
  }
}

export function trimHistory<T extends Message>(messages: T[], budget = HISTORY_BUDGET): T[] {
  if (messages.length === 0) return messages;
  let start = messages.length - 1;
  let used = size(messages[start]);
  while (start > 0 && used + size(messages[start - 1]) <= budget) {
    start -= 1;
    used += size(messages[start]);
  }
  // A tool message answers the assistant call before it; without that call it cannot stand first.
  while (start < messages.length - 1 && messages[start].role !== 'user') start += 1;
  return messages.slice(start);
}
