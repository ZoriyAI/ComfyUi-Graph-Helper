/**
 * The canonical text of a command payload: JSON with object keys sorted at every depth. main/commands/commit.ts
 * stores it with each applied command, so a retried action id with the same payload is recognised as the same
 * command and one with a different payload is refused, whatever order the keys came in.
 */
/** A copy of `value` with object keys in sorted order; arrays keep their order. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Identity of a mutation. The expected revision is a lock, not part of this body. */
export function canonicalPayload(payload: unknown): string {
  return JSON.stringify(sortValue(payload));
}
