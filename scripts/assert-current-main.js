const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

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
