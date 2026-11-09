export interface SecretProbe {
  platform: NodeJS.Platform;
  backend: string;
  encryptionAvailable: boolean;
  roundtrip: boolean;
  plaintextInCipher: boolean;
  /**
   * True when the ciphertext uses Chromium's hardcoded-password fallback.
   * Electron's safeStorage docs: if no secret store is available, values are
   * encrypted with a hardcoded plaintext password. That form is prefixed `v10`.
   * `getSelectedStorageBackend()` can still say `gnome_libsecret` in that case.
   */
  unprotectedCipher: boolean;
}

function currentPlatform(): string {
  return typeof process !== 'undefined' && typeof process.platform === 'string' ? process.platform : '';
}

/**
 * On Linux Chromium marks the hardcoded-password fallback with `v10`; a real keyring cipher is `v11`.
 * macOS Keychain and Windows DPAPI ciphers also start with `v10` and are protected, so the check is Linux-only.
 */
export function isUnprotectedCipher(cipher: Uint8Array, platform: string = currentPlatform()): boolean {
  if (platform !== 'linux') return false;
  return cipher.length >= 3 && cipher[0] === 0x76 && cipher[1] === 0x31 && cipher[2] === 0x30;
}

const OS_PASSWORD_MANAGERS = new Set(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6']);

/**
 * Persistence is allowed only after an OS password manager proves a round trip
 * whose ciphertext does not contain the plaintext. `basic_text` is rejected
 * even when Electron reports encryption as available.
 */
export function secretPersistenceDecision(probe: SecretProbe): { persist: boolean; reason: string } {
  const linuxWithoutOsStore = probe.platform === 'linux' && !OS_PASSWORD_MANAGERS.has(probe.backend);
  if (probe.backend === 'basic_text' || linuxWithoutOsStore) {
    return {
      persist: false,
      reason: 'OS key storage is not an OS password manager, so a key is not written.',
    };
  }
  if (probe.unprotectedCipher) {
    return {
      persist: false,
      reason: 'OS key storage fell back to an unprotected cipher, so a key is not written.',
    };
  }
  if (!probe.encryptionAvailable || !probe.roundtrip || probe.plaintextInCipher) {
    return {
      persist: false,
      reason: 'OS key storage did not prove encryption, so a key is not written.',
    };
  }
  return { persist: true, reason: 'OS key storage proved encryption.' };
}
