/**
 * Staggered arrival for items that appear together in a list.
 *
 * Who uses it: components/chat/Message.tsx, for the tool cards of an assistant's turn.
 * Why: the steps of a turn read as steps when they come in one by one, not as one block.
 */
import { useEffect, useRef } from 'react';
import { EASE_OUT, useMotionTimings } from './policy';

/** Between two items that arrive together, and the most any one item waits. */
const STEP_S = 0.07;
const MAX_WAIT_S = 0.42;

/**
 * Items that arrive together appear one after another (motion package). Who uses it: the chat's tool cards, so the
 * steps of an assistant's turn come in as steps instead of as one block. An item that arrives alone (a card added
 * while the turn streams) does not wait. With motion off nothing waits; with Reduced the order stays, as short fades.
 *
 * Returns the `transition` for an item by its key.
 */
export function useStagger(keys: readonly string[]): (key: string) => { duration: number; delay: number; ease: typeof EASE_OUT } {
  const timings = useMotionTimings();
  // The keys seen at the last render; null on the first render, so a list shown at once does not stagger.
  const known = useRef<Set<string> | null>(null);
  const fresh = known.current ? keys.filter((key) => !known.current!.has(key)) : [];
  useEffect(() => {
    known.current = new Set(keys);
  });
  return (key: string) => {
    const index = fresh.indexOf(key);
    const delay = timings.level === 'off' || index <= 0 ? 0 : Math.min(MAX_WAIT_S, index * STEP_S);
    return { duration: timings.enter, delay, ease: EASE_OUT };
  };
}
