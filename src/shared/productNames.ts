/**
 * The product's own names, spelled once.
 *
 * Who reads them: the main process through src/main/identity.ts (window, dialogs, profile folder, user agent, MCP
 * client), and the window's texts through the i18n catalog, which puts DISPLAY_NAME and SHORT_NAME into sentences as
 * interpolation values ({{app}}, {{appShort}}) instead of spelling the name. They live in src/shared, not in
 * src/main/identity.ts, because the renderer bundle cannot import main-process code; identity.ts re-exports them
 * and stays the place the main process reads every name from.
 *
 * Files that cannot import TypeScript (package.json, forge.config.js, the desktop entry template, the shell scripts
 * in resources/linux/portable) repeat these values; tests/unit/productNames.test.ts compares each of them with
 * the constants here, so a later rename is a change of this file and a test run that lists what still differs.
 *
 * The brand rule: "ComfyUI" never appears in a name, id, file name or icon name; only in sentences that say what
 * the app works with.
 */

/** What a person reads: window title, About, desktop entry, dialogs, documents. */
export const DISPLAY_NAME = 'NodeWise Studio';

/** The short form, where space is tight or in a sentence after the first mention. */
export const SHORT_NAME = 'NodeWise';

/** The machine id: package, executable, desktop file, icons, profile folder, MCP clientInfo. */
export const APP_ID = 'nodewise-studio';

/** The product token of the user agent (`NodeWiseStudio/<version>`). */
export const USER_AGENT_PRODUCT = 'NodeWiseStudio';

/** The ending a saved project file gets; files with an older ending still open (src/shared/legacyNames.ts). */
export const PROJECT_FILE_SUFFIX = '.nodewise.json';

/** The `format` field written into every project file. */
export const NATIVE_PROJECT_FORMAT_ID = 'nodewise-studio-project';
