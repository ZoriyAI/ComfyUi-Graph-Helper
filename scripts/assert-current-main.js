/**
 * Refuses to start or package an old dist/main. `npm run dev:electron`, `npm start`, `npm run package:linux` and the
 * release workflow run it after the build; electron-sqlite-probe.js calls currentMain() too. A stale, once-tracked
 * dist/ could otherwise be shipped without the window's security settings or the settings migration.
 * Prints CURRENT_MAIN_OK, or OLD_TRACKED_DIST and exits 2.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

/**
 * True when dist/main is the current build: two markers that only a current build carries (the window's
 * webSecurity setting and the database's call into the settings migration).
 */
function currentMain() {
  const mainPath = path.join(root, 'dist/main/index.js');
  const databasePath = path.join(root, 'dist/main/database.js');
  const main = fs.existsSync(mainPath) ? fs.readFileSync(mainPath, 'utf8') : '';
  const database = fs.existsSync(databasePath) ? fs.readFileSync(databasePath, 'utf8') : '';
  return main.includes('webSecurity: true') && database.includes('./settings/migrate');
}

if (require.main === module) {
  if (!currentMain()) {
    console.error('OLD_TRACKED_DIST');
    process.exit(2);
  }
  console.log('CURRENT_MAIN_OK');
}

module.exports = { currentMain };
