/**
 * Local shim for the agent path. fixsec is adding `redactSecrets(text)` and `exactMatchRedactor(values)` to
 * src/shared/config/draft.ts; when that lands, these two re-export it and this file can be removed.
 * Same heuristic as carriesSecret: an sk- key, an api key assignment, a bearer token.
 */
const PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{4,}/g,
  /(api[_-]?key\s*[:=]\s*)["']?[^\s"',;]+/gi,
  /(bearer\s+)[^\s"',;]+/gi,
];

export const REDACTED = '[redacted]';

/** Replaces secret-shaped substrings with [redacted]; the rest of the text stays readable. */
export function redactSecrets(text: string): string {
  if (typeof text !== 'string' || text === '') return text;
  let out = text;
  out = out.replace(PATTERNS[0], REDACTED);
  out = out.replace(PATTERNS[1], (_match, prefix: string) => `${prefix}${REDACTED}`);
  out = out.replace(PATTERNS[2], (_match, prefix: string) => `${prefix}${REDACTED}`);
  return out;
}

/** A redactor for exact held values (the LLM key, the MCP token). Values shorter than 8 characters are ignored. */
export function exactMatchRedactor(values: ReadonlyArray<string | null | undefined>): (text: string) => string {
  const held = values.filter((value): value is string => typeof value === 'string' && value.length >= 8);
  return (text: string) => {
    if (typeof text !== 'string' || held.length === 0) return text;
    let out = text;
    for (const value of held) out = out.split(value).join(REDACTED);
    return out;
  };
}

/** True when one of the exact held values appears in the text. */
export function containsExact(values: ReadonlyArray<string | null | undefined>, text: string): boolean {
  return values.some((value) => typeof value === 'string' && value.length >= 8 && text.includes(value));
}
