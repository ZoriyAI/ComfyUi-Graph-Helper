/**
 * Plain text in which the first mention of each glossary word explains itself.
 *
 * Who uses it: MarkdownLite when a text asks for `terms` (lesson steps, the window tour). A newcomer reads "latent" or
 * "conditioning" in a lesson and does not know it: the word is underlined with dots, and hovering it or reaching it
 * with Tab shows the glossary's one sentence. Why only the first mention: a paragraph full of underlines is harder to
 * read than one without. The meanings come from the glossary (knowledge/sets/foundations.ts), never from here.
 */
import React from 'react';
import Hint from '../../ui/Hint';
import { findTerms } from '../../../shared/journey/terms';
import styles from './TermText.module.css';

/** `text` with its glossary words marked; `seen` is shared by one whole text, so each term is marked once. */
export default function TermText({ text, language, seen }: { text: string; language: string; seen: Set<string> }) {
  const found = findTerms(text, language, seen);
  if (found.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const match of found) {
    if (match.start > at) parts.push(text.slice(at, match.start));
    const word = text.slice(match.start, match.end);
    parts.push(
      <Hint key={match.start} label={`${match.entry.term}: ${match.entry.text}`}>
        {/* Reachable with Tab so the meaning is not for mouse users only; it is read with the word as its description. */}
        <span className={styles.term} tabIndex={0} data-term={match.entry.id} aria-description={match.entry.text}>{word}</span>
      </Hint>,
    );
    at = match.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
