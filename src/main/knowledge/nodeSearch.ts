/**
 * Ranking of the node search. The add-node search on the canvas, the node library and the assistant's
 * searchNodeTypes tool all read node classes through main/knowledge/repository.ts searchNodeClasses, which scores
 * every class here.
 *
 * Why it looks beyond names: a newcomer types what a node does ("remove background", or the same in Russian, such as
 * "picture from text") more often than its class name. So a word may also match the description ComfyUI gives the
 * class and the built-in explanation the app ships for core nodes (both languages), ranked after every match in a
 * name. Small words ("to", and their Russian counterparts in STOP_WORDS) do not count, and in a query of two or more
 * words one word may miss, at a cost, so one unknown word does not hide every result. Words `in:TYPE` and `out:TYPE`
 * (also their Russian forms, the words for input and output; see FILTER) keep only classes with an input or an
 * output of that type, which is also how a link asks for the nodes that can be placed on it.
 */
import { CORE_KNOWLEDGE, type CoreNodeClass } from '../../shared/knowledge/coreKnowledge';
import { englishFor, normalizeWord, queryWords, rankFields } from '../../shared/knowledge/searchWords';
import { portsCompatible } from '../../shared/graph/linkTypes';

/** A match only in a description or explanation comes after every match in a name, a category or a pack. */
const TEXT_PENALTY = 4;
/** One word of a longer query that matches nothing costs this much instead of hiding the class. */
const MISSING_WORD_PENALTY = 6;

/** Small words that say nothing about a node. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'for', 'and', 'or', 'with', 'from', 'in', 'on', 'by', 'into', 'my',
  'и', 'в', 'во', 'на', 'из', 'для', 'с', 'со', 'к', 'по', 'от', 'или', 'а', 'мне', 'как', 'чтобы',
]);

/** The words of a query split into search words and type filters. */
export interface ParsedNodeQuery {
  words: string[];
  inputType?: string;
  outputType?: string;
}

/** A type filter word: `in:` or `out:`, in English or Russian, then the type. */
const FILTER = /^(in|out|вход|выход):(.+)$/i;

/** Reads `in:IMAGE` / `out:LATENT` (and their Russian forms) out of a query; the rest are search words. */
export function parseNodeQuery(query: string): ParsedNodeQuery {
  const parsed: ParsedNodeQuery = { words: [] };
  for (const token of queryWords(query)) {
    const filter = FILTER.exec(token);
    if (filter) {
      const type = filter[2].toUpperCase();
      if (/^(in|вход)$/i.test(filter[1])) parsed.inputType = type;
      else parsed.outputType = type;
      continue;
    }
    parsed.words.push(token);
  }
  const meaningful = parsed.words.filter((word) => !STOP_WORDS.has(normalizeWord(word)));
  // A query made only of small words still searches them.
  if (meaningful.length > 0) parsed.words = meaningful;
  return parsed;
}

/** The text with every regular-expression character escaped. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rank of a long text for one word: the word itself, or a word starting with it (four letters or more), so
 * "upscal" finds "upscaling"; a Russian word also counts through its stem and through its English words. Never a
 * piece in the middle of a word: in a paragraph that would match almost anything.
 */
export function rankText(text: string, word: string): number {
  const value = normalizeWord(text);
  const needle = normalizeWord(word);
  if (!value || !needle) return Infinity;
  const whole = new RegExp(`(^|[^a-zа-я0-9])${escape(needle)}([^a-zа-я0-9]|$)`);
  if (whole.test(value)) return TEXT_PENALTY;
  if (needle.length >= 4 && new RegExp(`(^|[^a-zа-я0-9])${escape(needle)}`).test(value)) return TEXT_PENALTY + 0.5;
  // A Russian word changes its ending with its role in the sentence: a word of five letters or more is also
  // looked for without its last two letters, so another form of the same word still matches.
  if (/[а-я]/.test(needle) && needle.length >= 5 && new RegExp(`(^|[^a-zа-я0-9])${escape(needle.slice(0, -2))}`).test(value)) return TEXT_PENALTY + 1;
  for (const english of englishFor(needle)) {
    if (new RegExp(`(^|[^a-z0-9])${escape(english)}`).test(value)) return TEXT_PENALTY + 1;
  }
  return Infinity;
}

/** What one class offers the search. */
export interface SearchableClass {
  names: Array<string | null | undefined>;
  texts: Array<string | null | undefined>;
  inputTypes: string[];
  outputTypes: string[];
}

/**
 * Score of one class for a parsed query (lower is better), or Infinity when it does not match or a type filter
 * keeps it out. `missing` counts the words that matched nothing: the caller keeps such classes only when no class
 * matches every word, so a precise query stays precise.
 */
export function scoreClass(item: SearchableClass, query: ParsedNodeQuery): { score: number; missing: number } {
  const none = { score: Infinity, missing: 0 };
  if (query.inputType && !item.inputTypes.some((type) => portsCompatible(query.inputType!, type))) return none;
  if (query.outputType && !item.outputTypes.some((type) => portsCompatible(type, query.outputType!))) return none;
  if (query.words.length === 0) return { score: 0, missing: 0 };
  let total = 0;
  let missing = 0;
  for (const word of query.words) {
    let best = rankFields(item.names, [word]);
    for (const text of item.texts) best = Math.min(best, rankText(text ?? '', word));
    if (best === Infinity) {
      missing += 1;
      total += MISSING_WORD_PENALTY;
    } else {
      total += best;
    }
  }
  // One word may miss in a query of two or three words; more in a longer one, but never most of them.
  const allowed = query.words.length < 2 ? 0 : Math.floor((query.words.length - 1) / 2) || 1;
  if (missing > allowed || missing === query.words.length) return none;
  return { score: total, missing };
}

/** The built-in explanation of a core node in both languages, for the search to read. */
export function knowledgeTexts(classType: string): string[] {
  const texts: string[] = [];
  for (const pack of Object.values(CORE_KNOWLEDGE)) {
    const entry = pack.nodes[classType as CoreNodeClass];
    if (entry) texts.push(entry.what, entry.why);
  }
  return texts;
}

/** The first sentence of a description, short enough for one line under a search result. */
export function shortDescription(text: string | null | undefined, limit = 140): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentence = /^(.+?[.!?])(\s|$)/.exec(clean)?.[1] ?? clean;
  return sentence.length > limit ? `${sentence.slice(0, limit - 1).trimEnd()}…` : sentence;
}

/** The built-in explanation's first sentence in the given language, for the result line. */
export function knowledgeLine(classType: string, language: 'en' | 'ru'): string {
  const entry = CORE_KNOWLEDGE[language].nodes[classType as CoreNodeClass];
  return entry ? shortDescription(entry.what) : '';
}
