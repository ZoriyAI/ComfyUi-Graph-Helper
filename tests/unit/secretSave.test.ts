import { describe, expect, it } from 'vitest';
import { consumeSecretSave } from '../../src/renderer/components/settings/secretSave';

const FAKE_MARKER = 'fake-marker-not-a-key';

describe('consumeSecretSave', () => {
  it('clears the field when the save resolves blocked', async () => {
    let seen = '';
    const outcome = await consumeSecretSave(async (value) => {
      seen = value;
      return { status: 'secret-storage-blocked' };
    }, FAKE_MARKER);
    expect(seen).toBe(FAKE_MARKER);
    expect(outcome.secret).toBe('');
    expect(outcome.note).toBe('secret-storage-blocked. The key was not written.');
  });

  it('clears the field when the save promise rejects', async () => {
    let seen = '';
    const outcome = await consumeSecretSave(async (value) => {
      seen = value;
      throw new Error('rejected');
    }, FAKE_MARKER);
    expect(seen).toBe(FAKE_MARKER);
    expect(outcome.secret).toBe('');
    expect(outcome.note).toBe('The key was not written.');
  });
});
