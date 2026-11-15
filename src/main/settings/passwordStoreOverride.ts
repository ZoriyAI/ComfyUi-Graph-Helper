/**
 * Settings ▸ Privacy ▸ "Password store": which OS store Electron should use for safeStorage on Linux when the
 * automatic choice does not see the person's keyring. Kept in a tiny file next to the database because it has to
 * be read before the app is ready (the switch must be set then), i.e. before SQLite is open. Never a secret.
 * Read by index.ts at start (the --password-store switch) and read and written by ipc.ts for the Privacy panel.
 */
import * as fs from 'fs';
import * as path from 'path';

/** The file name in the profile folder. */
export const PASSWORD_STORE_FILE = 'password-store.json';
/** Values Chromium's --password-store switch accepts that the panel offers. */
export const PASSWORD_STORE_CHOICES = ['gnome-libsecret', 'kwallet6', 'kwallet5', 'kwallet'] as const;
export type PasswordStoreChoice = typeof PASSWORD_STORE_CHOICES[number];

export function isPasswordStoreChoice(value: unknown): value is PasswordStoreChoice {
  return typeof value === 'string' && (PASSWORD_STORE_CHOICES as readonly string[]).includes(value);
}

/** The saved choice, or null for "detect automatically" (also for a missing or damaged file). */
export function readPasswordStoreOverride(userData: string): PasswordStoreChoice | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(userData, PASSWORD_STORE_FILE), 'utf8')) as { store?: unknown };
    return isPasswordStoreChoice(parsed?.store) ? parsed.store : null;
  } catch {
    return null;
  }
}

/** Saves the choice, or removes the file for "detect automatically". Applies at the next start. */
export function writePasswordStoreOverride(userData: string, choice: PasswordStoreChoice | null): void {
  const file = path.join(userData, PASSWORD_STORE_FILE);
  if (choice === null) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Already absent.
    }
    return;
  }
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ store: choice }));
}
