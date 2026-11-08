import { nonSecretSettingsSchema } from './schema';

const SECRET_FIELD = /^(api[_-]?key|token|secret|password|authorization|credential)$/i;

function valueCarriesSecret(value: string): boolean {
  return /sk-[A-Za-z0-9]/.test(value) || /api[_-]?key\s*[:=]/i.test(value) || /bearer\s+\S/i.test(value);
}

/** Same reject-before-parse check the settings repository uses. No secret is stored. */
export function carriesSecret(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_FIELD.test(key)) return true;
    if (typeof value !== 'string') continue;
    if (valueCarriesSecret(value)) return true;
  }
  return false;
}

/** Names of fields whose values match the existing secret check. */
export function secretBearingFields(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  return Object.entries(input).flatMap(([key, value]) => (
    typeof value === 'string' && valueCarriesSecret(value) ? [key] : []
  ));
}

export function settingsWriteError(input: unknown): string | null {
  if (carriesSecret(input)) return 'Settings cannot store a secret';
  if (!nonSecretSettingsSchema.safeParse(input).success) return 'Settings do not match the schema';
  return null;
}
