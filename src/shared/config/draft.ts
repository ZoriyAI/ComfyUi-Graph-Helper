import { nonSecretSettingsSchema } from './schema';

const SECRET_FIELD = /^(api[_-]?key|token|secret|password|authorization|credential)$/i;

/** Same reject-before-parse check the settings repository uses. No secret is stored. */
export function carriesSecret(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_FIELD.test(key)) return true;
    if (typeof value !== 'string') continue;
    if (/sk-[A-Za-z0-9]/.test(value) || /api[_-]?key\s*[:=]/i.test(value) || /bearer\s+\S/i.test(value)) return true;
  }
  return false;
}

export function settingsWriteError(input: unknown): string | null {
  if (carriesSecret(input)) return 'Settings cannot store a secret';
  if (!nonSecretSettingsSchema.safeParse(input).success) return 'Settings do not match the schema';
  return null;
}
