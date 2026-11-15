/**
 * Manual check, run with Electron after a build: prints SECRET_RUNTIME with what the secret-store probe found on
 * this desktop and whether the app would keep a key. Stores nothing. Exits 1 only when the app would keep a key
 * in a store whose cipher is not protected.
 */
const { app } = require('electron');
const path = require('path');
const { passwordStoreFlag } = require(path.join(__dirname, '../dist/shared/config/passwordStore.js'));

// The --password-store choice the app makes at start when no override is saved (src/main/index.ts).
const flag = passwordStoreFlag(process.env.XDG_CURRENT_DESKTOP, process.argv);
if (flag) app.commandLine.appendSwitch('password-store', flag);

app.whenReady().then(async () => {
  const { probeSecretBackend } = require(path.join(__dirname, '../dist/main/settings/secretProbe.js'));
  const { secretPersistenceDecision } = require(path.join(__dirname, '../dist/shared/config/secretPolicy.js'));
  const probe = await probeSecretBackend();
  const decision = secretPersistenceDecision(probe);
  const report = {
    persist: decision.persist,
    backend: probe.backend,
    reason: decision.reason,
    roundtrip: probe.roundtrip,
    unprotectedCipher: probe.unprotectedCipher,
    plaintextInCipher: probe.plaintextInCipher,
    encryptionAvailable: probe.encryptionAvailable,
  };
  console.log(`SECRET_RUNTIME ${JSON.stringify(report)}`);
  app.exit(decision.persist && probe.unprotectedCipher ? 1 : 0);
});
