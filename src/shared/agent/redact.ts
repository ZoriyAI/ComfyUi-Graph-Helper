/**
 * The agent path's redaction helpers. The patterns live in src/shared/config/draft.ts (redactSecrets,
 * exactMatchRedactor); this module re-exports them so agent code keeps its import path.
 */
import { exactMatchRedactor as draftExactMatchRedactor, redactSecrets } from '../config/draft';

export { redactSecrets };

export const REDACTED = '[redacted]';

/** Held values shorter than this are not matched exactly, so they cannot blank ordinary words. */
const EXACT_MIN_LENGTH = 8;

function heldValues(values: ReadonlyArray<string | null | undefined>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.length >= EXACT_MIN_LENGTH);
}

/** A redactor for exact held values (the LLM key, the MCP token). Values shorter than 8 characters are ignored. */
export function exactMatchRedactor(values: ReadonlyArray<string | null | undefined>): (text: string) => string {
  return draftExactMatchRedactor(heldValues(values));
}

/** True when one of the exact held values appears in the text. */
export function containsExact(values: ReadonlyArray<string | null | undefined>, text: string): boolean {
  return heldValues(values).some((value) => text.includes(value));
}

/** Redacts a JSON-shaped tool result without stringifying numbers, booleans, nulls or arrays. */
export function redactValue<T>(value: T, redact: (text: string) => string): T {
  if (typeof value === 'string') return redact(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, redact)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), redactValue(item, redact)])) as T;
  }
  return value;
}
