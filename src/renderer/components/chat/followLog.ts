/**
 * Keeps a growing part of the chat in view while the person reads at the end of the conversation. BuildCard.tsx
 * (the running step) and BuildSummary.tsx (the closing line) call it; both grow without a new message, so the log's
 * own scroll-to-end in ChatDock.tsx does not see them.
 */
import { motionIsFull } from '../../motion/policy';

/** How close to the end of the conversation a person must be for the chat to keep up with the helper. */
const NEAR_END_PX = 240;

/**
 * Brings a growing part of the chat (the running build step, the build summary) into view, but only while the person
 * is reading at the end of the conversation: someone who scrolled up to an older message is not pulled away.
 */
export function followInLog(element: HTMLElement | null): void {
  const log = element?.closest<HTMLElement>('[role="log"]');
  if (!element || !log) return;
  const fromEnd = log.scrollHeight - log.scrollTop - log.clientHeight;
  const below = element.getBoundingClientRect().bottom - log.getBoundingClientRect().bottom;
  // The part of the element still below the visible log does not count as distance: it is what grew.
  if (fromEnd - Math.max(0, below) > NEAR_END_PX) return;
  element.scrollIntoView({ block: 'nearest', behavior: motionIsFull() ? 'smooth' : 'auto' });
}
