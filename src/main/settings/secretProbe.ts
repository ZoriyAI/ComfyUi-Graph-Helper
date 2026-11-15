/**
 * Looks at Electron's safeStorage and tests it with a throw-away round trip, without storing anything.
 * Used only by secretDecision.ts. Why the round trip: on Linux safeStorage can report "available" while it
 * really writes the text in clear (basic_text backend) or with a fixed key, so availability alone proves nothing.
 */
import { safeStorage } from 'electron';
import { isUnprotectedCipher, type SecretProbe } from '../../shared/config/secretPolicy';

/** Linux backends that are a real password manager (a keyring that needs the person's login). */
const OS_PASSWORD_MANAGERS = new Set(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6']);
// A throw-away text for the round trip below; never stored.
const CANARY = 'nodewise-studio-canary';

/** Reads the Electron backend. Does not call setUsePlainTextEncryption and does not write SQLite. */
export async function probeSecretBackend(): Promise<SecretProbe> {
  let backend = 'unknown';
  if (process.platform === 'linux') {
    try {
      backend = safeStorage.getSelectedStorageBackend();
    } catch {
      backend = 'unknown';
    }
  } else {
    backend = 'platform-default';
  }
  let encryptionAvailable = false;
  try {
    encryptionAvailable = await safeStorage.isAsyncEncryptionAvailable();
  } catch {
    encryptionAvailable = false;
  }
  let roundtrip = false;
  let plaintextInCipher = true;
  let unprotectedCipher = false;
  const eligible = process.platform !== 'linux' || OS_PASSWORD_MANAGERS.has(backend);
  if (encryptionAvailable && eligible && backend !== 'basic_text') {
    try {
      const cipher = await safeStorage.encryptStringAsync(CANARY);
      plaintextInCipher = cipher.includes(Buffer.from(CANARY));
      unprotectedCipher = isUnprotectedCipher(cipher);
      const back = await safeStorage.decryptStringAsync(cipher);
      roundtrip = back.result === CANARY && !plaintextInCipher;
    } catch {
      roundtrip = false;
      plaintextInCipher = true;
      unprotectedCipher = false;
    }
  }
  return {
    platform: process.platform,
    backend,
    encryptionAvailable,
    roundtrip,
    plaintextInCipher,
    unprotectedCipher,
  };
}
