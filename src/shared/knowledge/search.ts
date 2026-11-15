/**
 * The plain match ranking every catalog search builds on: a prefix beats a whole word, which beats a substring.
 * searchWords.ts adds exact, Russian-synonym and one-typo matches on top of it and re-exports these ranks, so the
 * node search and the model search in main sort the same way.
 */
/** Lower is better. Infinity means no match. Both sides are compared lower-case. */
export const MATCH_PREFIX = 0;
export const MATCH_WORD = 1;
export const MATCH_SUBSTRING = 2;

/** The query as literal text inside a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Prefix of the whole field beats a whole word inside it ("Lora" in "Load LoRA"), which beats any substring.
 * Word boundaries are any non-alphanumeric character, so "loaders/video" has the word "video".
 */
export function rankMatch(field: string, query: string): number {
  const value = field.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return MATCH_PREFIX;
  if (value.startsWith(needle)) return MATCH_PREFIX;
  if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(value)) return MATCH_WORD;
  if (value.includes(needle)) return MATCH_SUBSTRING;
  return Infinity;
}
