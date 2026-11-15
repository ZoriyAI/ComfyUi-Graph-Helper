/**
 * The product's names for the build and check scripts, read from the TypeScript files that spell them
 * (src/shared/productNames.ts, and src/shared/legacyNames.ts for the name 0.x was shipped under), so no script
 * repeats a name. Used by forge.config.js, scripts/make-linux-portable.js and the smoke scripts.
 * Only plain `export const NAME = '...';` lines are read; tests/unit/productNames.test.ts checks the values match.
 */
const fs = require('fs');
const path = require('path');

/** The `export const NAME = '...';` lines of a repository file, as { NAME: value }. */
function stringConstants(file) {
  const text = fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
  const found = {};
  for (const match of text.matchAll(/^export const ([A-Z_]+) = '([^']*)';$/gm)) found[match[1]] = match[2];
  return found;
}

const names = stringConstants('src/shared/productNames.ts');
const legacy = stringConstants('src/shared/legacyNames.ts');

module.exports = {
  /** "NodeWise Studio" */
  DISPLAY_NAME: names.DISPLAY_NAME,
  /** "nodewise-studio": package, executable, desktop file, icons, profile folder. */
  APP_ID: names.APP_ID,
  /** The package, executable and profile folder of 0.x, which 1.0 replaces. */
  LEGACY_APP_ID: legacy.LEGACY_APP_ID,
};
