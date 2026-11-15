/**
 * A helper for saving a pasted secret: whatever happens, the field is emptied so the key never stays on screen.
 * Only tests/unit/secretSave.test.ts calls it today; the key fields in ./sections save through their own code.
 * Its notes are English text, not catalog keys, and it reports "not written" for every outcome.
 */

/** What the field shows after a save attempt: always an empty secret, plus a note. */
export type SecretSaveOutcome = { secret: ''; note: string };

/** Calls `save` with the value and returns an emptied field and a note; a rejected save is treated as not written. */
export async function consumeSecretSave(
  save: (value: string) => Promise<{ status: string }>,
  value: string,
): Promise<SecretSaveOutcome> {
  try {
    const result = await save(value);
    return {
      secret: '',
      note: result.status === 'secret-storage-blocked'
        ? 'secret-storage-blocked. The key was not written.'
        : 'The key was not written.',
    };
  } catch {
    return { secret: '', note: 'The key was not written.' };
  }
}
