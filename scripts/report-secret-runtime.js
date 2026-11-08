const { app } = require('electron');
const path = require('path');
const { passwordStoreFlag } = require(path.join(__dirname, '../dist/shared/config/passwordStore.js'));

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
