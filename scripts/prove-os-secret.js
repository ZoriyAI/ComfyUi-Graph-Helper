/**
 * Manual check, run with Electron on a Linux desktop after a build: when the app decides the OS secret store is
 * safe to use, a key really is stored encrypted (never in plain text in the database file) and reads back.
 * Prints SECRET_POSITIVE with a JSON report; exits 1 when the decision said "persist" but the proof failed.
 * Works in a throwaway database; the marker string is not a real key.
 */
const { app, safeStorage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { passwordStoreFlag } = require(path.join(__dirname, '../dist/shared/config/passwordStore.js'));
// The --password-store choice the app makes at start when no override is saved (src/main/index.ts).
const flag = passwordStoreFlag(process.env.XDG_CURRENT_DESKTOP, process.argv);
if (flag) app.commandLine.appendSwitch('password-store', flag);

app.whenReady().then(async () => {
  const { probeSecretBackend } = require(path.join(__dirname, '../dist/main/settings/secretProbe.js'));
  const { isUnprotectedCipher, secretPersistenceDecision } = require(path.join(__dirname, '../dist/shared/config/secretPolicy.js'));
  const { migrate } = require(path.join(__dirname, '../dist/main/settings/migrate.js'));
  const { forgetProviderKey, readProviderKeyCipher, saveSecretIfProven } = require(path.join(__dirname, '../dist/main/settings/repository.js'));
  const Database = require('better-sqlite3');
  const probe = await probeSecretBackend();
  const decision = secretPersistenceDecision(probe);
  const report = {
    persist: decision.persist,
    backend: probe.backend,
    reason: decision.reason,
    unprotectedCipher: probe.unprotectedCipher,
    stored: false,
    plaintext: false,
    cipherUnprotected: false,
    roundtrip: false,
  };
  if (decision.persist) {
    const marker = `prove-${process.pid}-not-logged`;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'os-secret-'));
    const dbPath = path.join(dir, 'probe.db');
    const db = new Database(dbPath);
    migrate(db);
    const cipher = await safeStorage.encryptStringAsync(marker);
    const saved = saveSecretIfProven(db, decision, marker, cipher);
    report.stored = saved.status === 'stored';
    report.cipherUnprotected = isUnprotectedCipher(cipher);
    report.plaintext = fs.readFileSync(dbPath).includes(Buffer.from(marker));
    const stored = readProviderKeyCipher(db);
    if (stored) {
      const opened = await safeStorage.decryptStringAsync(stored);
      report.roundtrip = opened.result === marker;
    }
    forgetProviderKey(db);
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(`SECRET_POSITIVE ${JSON.stringify(report)}`);
  const failed = report.persist && (!report.stored || report.plaintext || report.cipherUnprotected || !report.roundtrip);
  app.exit(failed ? 1 : 0);
});
