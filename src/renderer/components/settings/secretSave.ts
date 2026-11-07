export type SecretSaveOutcome = { secret: ''; note: string };

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
