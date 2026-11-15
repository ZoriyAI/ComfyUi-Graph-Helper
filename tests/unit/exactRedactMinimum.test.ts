/**
 * Checks that the agent path and the settings path redact held secrets from the same length: a short key of a
 * person's own server (five to seven characters) is hidden before text reaches a model or a log, by both.
 */
import { describe, expect, it } from 'vitest';
import { containsExact, exactMatchRedactor as agentRedactor } from '../../src/shared/agent/redact';
import { EXACT_MATCH_MIN_LENGTH, exactMatchRedactor as draftRedactor } from '../../src/shared/config/draft';

describe('one minimum for exact redaction', () => {
  it('hides a short held key on both paths, and ignores a value under the minimum', () => {
    expect(EXACT_MATCH_MIN_LENGTH).toBe(4);
    for (const redact of [agentRedactor, draftRedactor]) {
      expect(redact(['secret1'])('the key is secret1.')).toBe('the key is [redacted].');
      expect(redact(['abc'])('abc stays')).toBe('abc stays');
    }
    expect(containsExact(['token'], 'Bearer token')).toBe(true);
    expect(containsExact(['abc'], 'abc')).toBe(false);
  });
});
