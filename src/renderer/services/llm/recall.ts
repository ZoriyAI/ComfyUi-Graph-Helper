/**
 * Recall of earlier messages in the chat's message box.
 *
 * Who uses it: components/chat/MessageInput.tsx on the Up and Down keys. Pure, so it is tested without a window.
 */

/**
 * Up and Down in an empty message box bring back the person's earlier messages, newest first, as a terminal does.
 * `position` counts back from the newest (0 is the newest); null means nothing is recalled.
 */
export function recallStep(
  sent: readonly string[],
  position: number | null,
  key: 'up' | 'down',
): { position: number | null; text: string } {
  if (sent.length === 0) return { position: null, text: '' };
  if (key === 'up') {
    const next = position === null ? 0 : Math.min(position + 1, sent.length - 1);
    return { position: next, text: sent[sent.length - 1 - next] };
  }
  if (position === null || position === 0) return { position: null, text: '' };
  const next = position - 1;
  return { position: next, text: sent[sent.length - 1 - next] };
}
