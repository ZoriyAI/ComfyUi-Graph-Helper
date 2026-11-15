/**
 * The agent path's redaction helpers. The patterns live in src/shared/config/draft.ts (redactSecrets,
 * exactMatchRedactor); this module re-exports them so agent code keeps its import path. Used by main's agent turn,
 * prompt and chat history, main/llmService.ts and main/llm/toolPrivacy.ts before text goes to a model or a log.
 */
import { exactMatchRedactor as draftExactMatchRedactor, redactFieldValue, redactSecrets } from '../config/draft';

export { redactSecrets };

/** The text that stands in for a removed secret. */
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

/** Redacts structured textual fields, retaining supported opaque SDK file data and primitive types. */
export function redactValue(value: unknown, redact: (text: string) => string): unknown {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, redact));
  if (value instanceof URL) {
    const safe = redact(value.href);
    if (safe === value.href) return value;
    // Keep a valid URL instance even if a whole held URL was replaced by the redactor.
    return URL.canParse(safe) ? new URL(safe) : new URL('about:blank#redacted');
  }
  if (value && typeof value === 'object') {
    // Only supported binary file values bypass traversal, not arbitrary class instances.
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) return value;
    // Match the SDK's standard JSON normalization for dates (invalid dates become null).
    if (value instanceof Date) return redactValue(value.toJSON(), redact);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      redact(key),
      typeof item === 'string' ? redact(redactFieldValue(key, item)) : redactValue(item, redact),
    ]));
  }
  return value;
}
