import { safeStorage } from 'electron';
import type { SecretProbe } from '../../shared/config/secretPolicy';

const OS_PASSWORD_MANAGERS = new Set(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6']);
const CANARY = 'comfy-graph-helper-canary';

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
  const eligible = process.platform !== 'linux' || OS_PASSWORD_MANAGERS.has(backend);
  if (encryptionAvailable && eligible && backend !== 'basic_text') {
    try {
      const cipher = await safeStorage.encryptStringAsync(CANARY);
      plaintextInCipher = cipher.includes(Buffer.from(CANARY));
      const back = await safeStorage.decryptStringAsync(cipher);
      roundtrip = back.result === CANARY && !plaintextInCipher;
    } catch {
      roundtrip = false;
      plaintextInCipher = true;
    }
  }
  return {
    platform: process.platform,
    backend,
    encryptionAvailable,
    roundtrip,
    plaintextInCipher,
  };
}
