#!/usr/bin/env node
/**
 * Checks an installed app on any system, the way a person would start it. The Windows and macOS install scripts
 * (scripts/install/) run it from their build folder as the last step, and .github/workflows/install-scripts.yml runs
 * it on GitHub's Windows and macOS runners. It is the portable part of the Linux package checks
 * (smoke-installed-package.js, smoke-linux-portable.js): no package database, no desktop entry, no Xvfb.
 *
 *   node scripts/smoke-installed-app.js --app <executable> [--expect-version <x.y.z>] [--screenshot <file.png>]
 *
 * 1. `--version` prints "<display name> <version>" (the package.json version of this folder unless given).
 * 2. The app opens its window with a throw-away profile (never the person's own data folder): the page loads, the
 *    title is the display name, and the database file appears in that profile, which proves the native SQLite
 *    module loads inside the packaged Electron.
 * 3. A second start on the same profile hands over to the first and exits with 0 (one app per profile).
 *
 * `--use-mock-keychain` keeps the check away from the macOS Keychain: a build signed ad hoc on this Mac is new to the
 * Keychain, and a prompt there would hold the start until somebody answers it. Other systems ignore the switch.
 * The app is driven through its page (scripts/lib/cdp-launch.js), since release builds have the inspector fuse off.
 * Every line it prints starts with SMOKE_APP_; a failure prints SMOKE_APP_FAILED <what> and exits 1.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { DISPLAY_NAME } = require('./lib/product-names');

/** Switches added to every start of the app under test (see the header). */
const CHECK_SWITCHES = ['--use-mock-keychain'];

/** The options of this script; unknown words are refused so a typo never skips a check. */
function parseArgs(argv) {
  const options = { app: '', expectVersion: '', screenshot: '' };
  const names = { '--app': 'app', '--expect-version': 'expectVersion', '--screenshot': 'screenshot' };
  for (let i = 0; i < argv.length; i++) {
    const [name, inline] = argv[i].includes('=') ? [argv[i].slice(0, argv[i].indexOf('=')), argv[i].slice(argv[i].indexOf('=') + 1)] : [argv[i], undefined];
    const key = names[name];
    if (!key) throw new Error(`unknown option ${argv[i]}`);
    const value = inline ?? argv[++i];
    if (value === undefined || value === '') throw new Error(`${name} needs a value`);
    options[key] = value;
  }
  if (!options.app) throw new Error('--app <executable> is required');
  return options;
}

/** Whether `--version` printed exactly the expected line (trailing whitespace and a Windows line end allowed). */
function versionMatches(printed, version) {
  return printed.replace(/\r/g, '').trim() === `${DISPLAY_NAME} ${version}`;
}

function fail(message) {
  console.error(`SMOKE_APP_FAILED ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The environment of a person's session: no development mode, Electron not turned into Node. */
function personEnv() {
  const env = { ...process.env };
  delete env.NODE_ENV;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function checkVersion(app, version) {
  let printed = '';
  try {
    printed = execFileSync(app, ['--version'], { encoding: 'utf8', env: personEnv(), timeout: 60000, windowsHide: true });
  } catch (error) {
    fail(`VERSION_SWITCH ${app} did not answer: ${error.message}`);
  }
  if (!versionMatches(printed, version)) fail(`VERSION_SWITCH printed "${printed.trim()}", expected "${DISPLAY_NAME} ${version}"`);
  console.log(`SMOKE_APP_VERSION_OK ${printed.trim()}`);
}

/** A second start on the same profile must leave at once with 0, handing over to the first window. */
async function checkSecondInstance(app, profile) {
  const child = spawn(app, [...CHECK_SWITCHES, `--user-data-dir=${profile}`], { env: personEnv(), stdio: 'ignore', windowsHide: true });
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: 'timeout' });
    }, 40000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code });
    });
  });
  if (result.code === 'timeout') fail('SECOND_INSTANCE kept running next to the first (no single-instance lock)');
  if (result.code !== 0) fail(`SECOND_INSTANCE exited with ${result.code} instead of handing over to the first`);
  console.log('SMOKE_APP_SECOND_INSTANCE_OK');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(`USAGE ${error.message}`);
  }
  const app = path.resolve(options.app);
  if (!fs.existsSync(app)) fail(`APP_MISSING ${app}`);
  const version = options.expectVersion || JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
  checkVersion(app, version);

  // Loaded only now: the version check above needs nothing from node_modules.
  const { launchOverCdp } = require('./lib/cdp-launch');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewise-smoke-'));
  try {
    const started = await launchOverCdp({ executable: app, args: [...CHECK_SWITCHES, `--user-data-dir=${profile}`], env: personEnv(), userData: profile, timeout: 120000 });
    try {
      await started.window.locator('.app-shell').waitFor({ timeout: 90000 });
      const title = await started.window.title();
      if (title !== DISPLAY_NAME) fail(`WINDOW_TITLE ${title}`);
      if (!fs.existsSync(path.join(profile, 'comfyui-desktop.db'))) fail(`DATABASE_NOT_IN_PROFILE ${profile}`);
      if (options.screenshot) {
        fs.mkdirSync(path.dirname(path.resolve(options.screenshot)), { recursive: true });
        await started.window.screenshot({ path: options.screenshot });
        console.log(`SMOKE_APP_SCREENSHOT ${options.screenshot}`);
      }
      console.log(`SMOKE_APP_WINDOW_OK title="${title}"`);
      await checkSecondInstance(app, profile);
      try {
        process.kill(started.child.pid, 0);
      } catch {
        fail('FIRST_INSTANCE_GONE after the second start');
      }
    } finally {
      await started.close();
    }
  } finally {
    // Windows keeps a file open for a moment after the app exits: retry the clean-up rather than fail on it.
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        fs.rmSync(profile, { recursive: true, force: true });
        break;
      } catch {
        await sleep(1000);
      }
    }
  }
  console.log(`SMOKE_APP_OK ${DISPLAY_NAME} ${version}`);
}

module.exports = { parseArgs, versionMatches, CHECK_SWITCHES };

if (require.main === module) {
  main().catch((error) => fail(error && error.stack ? error.stack : String(error)));
}
