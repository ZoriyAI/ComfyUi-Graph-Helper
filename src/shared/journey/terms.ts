/**
 * Finds words of the glossary in a text, so a word a newcomer may not know explains itself where it first appears.
 *
 * Who uses it: the lesson steps and the window tour (renderer, MarkdownLite with `terms`), which underline the first
 * mention of each glossary term and show its one-sentence meaning on hover or keyboard focus.
 * Why word stems: Russian changes the end of a word with its case and number (the word for "node" takes several
 * endings), so a term matches from its stem; English adds "s". Only whole words match, and only terms of three
 * letters and more, so short words never light up inside others. The glossary itself (knowledge/sets/foundations.ts) is the one source of the meanings.
 */

import { glossary, type GlossaryEntry } from '../knowledge/sets/foundations';

/** One place in a text where a glossary term starts. */
export interface TermMatch {
  start: number;
  end: number;
  entry: GlossaryEntry;
}

/** Terms that are also everyday words in running text ("run the graph"): their hint would point at the wrong sense. */
const NOT_HINTED = new Set(['run']);

/** Russian word endings cut off to get a stem. */
const RU_ENDINGS = /[аяоеьыиуюй]$/u;

/** The pattern a term is found by: its stem with a short ending, as a whole word. */
function patternOf(term: string, language: 'en' | 'ru'): RegExp | null {
  const word = term.trim();
  if (word.length < 3) return null;
  const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/\s/.test(word) || /[^\p{L}]/u.test(word)) return new RegExp(`(?<![\\p{L}\\p{N}])${escaped(word)}(?![\\p{L}\\p{N}])`, 'iu');
  if (language === 'ru' && /[Ѐ-ӿ]/u.test(word)) {
    const stem = word.length > 4 ? word.replace(RU_ENDINGS, '') : word.replace(RU_ENDINGS, '') || word;
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped(stem)}\\p{L}{0,3}(?![\\p{L}\\p{N}])`, 'iu');
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped(word)}(?:s|es)?(?![\\p{L}\\p{N}])`, 'iu');
}

/** The built patterns per language, made once: the glossary does not change while the app runs. */
const cache = new Map<string, Array<{ entry: GlossaryEntry; pattern: RegExp }>>();

function patterns(language: string): Array<{ entry: GlossaryEntry; pattern: RegExp }> {
  const lang = language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const known = cache.get(lang);
  if (known) return known;
  const built = glossary(lang)
    .filter((entry) => !NOT_HINTED.has(entry.id))
    .map((entry) => ({ entry, pattern: patternOf(entry.term, lang) }))
    .filter((item): item is { entry: GlossaryEntry; pattern: RegExp } => item.pattern !== null)
    // Longer terms first: the Russian term for "data type" wins over a shorter term inside it.
    .sort((a, b) => b.entry.term.length - a.entry.term.length);
  cache.set(lang, built);
  return built;
}

/**
 * The first place of each glossary term in `text`, left to right, not overlapping. `seen` holds term ids already
 * explained earlier in the same block; the ones found here are added to it.
 */
export function findTerms(text: string, language: string, seen: Set<string> = new Set()): TermMatch[] {
  const found: TermMatch[] = [];
  for (const { entry, pattern } of patterns(language)) {
    if (seen.has(entry.id)) continue;
    const match = pattern.exec(text);
    if (!match) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (found.some((item) => start < item.end && end > item.start)) continue;
    found.push({ start, end, entry });
  }
  for (const item of found) seen.add(item.entry.id);
  return found.sort((a, b) => a.start - b.start);
}
