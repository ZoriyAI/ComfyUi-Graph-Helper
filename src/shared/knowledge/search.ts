/** Lower is better. Infinity means no match. Both sides are compared lower-case. */
export const MATCH_PREFIX = 0;
export const MATCH_WORD = 1;
export const MATCH_SUBSTRING = 2;

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
