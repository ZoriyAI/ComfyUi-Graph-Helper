const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { currentMain } = require('./assert-current-main');

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'prep-probe-'));
app.setPath('userData', userData);

app.whenReady().then(() => {
  if (!currentMain()) {
    console.error('OLD_TRACKED_DIST');
    app.exit(2);
    return;
  }
  try {
    const { initDatabase, getDatabase, closeDatabase } = require('../dist/main/database');
    const { readSettings, saveSettings, attemptSaveSecret, secretRecordCount } = require('../dist/main/settings/repository');
    initDatabase();
    const version = getDatabase().prepare('select sqlite_version() as v').get();
    console.log('ELECTRON_LOAD', process.versions.electron, process.versions.modules, JSON.stringify(version));
    const first = readSettings(getDatabase());
    if (first.source !== 'default') {
      console.error('ELECTRON_PROBE_FAIL fresh source', first.source);
      app.exit(3);
      return;
    }
    const saved = saveSettings(getDatabase(), {
      theme: 'graphite',
      motion: 'off',
      provider: '',
      model: 'probe-model',
      comfyOrigin: '',
    });
    if (!saved.ok) {
      console.error('ELECTRON_PROBE_FAIL save');
      app.exit(4);
      return;
    }
    const blocked = attemptSaveSecret(getDatabase());
    if (blocked.status !== 'secret-storage-blocked' || secretRecordCount(getDatabase()) !== 0) {
      console.error('ELECTRON_PROBE_FAIL secret');
      app.exit(5);
      return;
    }
    closeDatabase();
    initDatabase();
    const again = readSettings(getDatabase());
    if (again.source !== 'stored' || again.values.model !== 'probe-model') {
      console.error('ELECTRON_PROBE_FAIL reopen');
      app.exit(6);
      return;
    }
    const dbFile = path.join(userData, 'comfyui-desktop.db');
    if (!fs.existsSync(dbFile)) {
      console.error('ELECTRON_PROBE_FAIL missing db');
      app.exit(7);
      return;
    }
    closeDatabase();
    console.log('ELECTRON_REOPEN_OK', dbFile);
    app.exit(0);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    app.exit(1);
  }
});
