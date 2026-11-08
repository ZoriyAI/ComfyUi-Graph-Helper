export interface SecretProbe {
  platform: NodeJS.Platform;
  backend: string;
  encryptionAvailable: boolean;
  roundtrip: boolean;
  plaintextInCipher: boolean;
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
  if (!probe.encryptionAvailable || !probe.roundtrip || probe.plaintextInCipher) {
    return {
      persist: false,
      reason: 'OS key storage did not prove encryption, so a key is not written.',
    };
  }
  return { persist: true, reason: 'OS key storage proved encryption.' };
}
