#!/usr/bin/env node
/**
 * Checks the app as a person gets it: installed from the .deb or the .rpm (or with install.sh), started without
 * --user-data-dir, with its own profile under $HOME. Run under Xvfb, after installing the package.
 *
 *   node scripts/smoke-installed-package.js check            the installed package: package fields, desktop entry,
 *                                                            icons, copyright, --version, the window, the profile
 *                                                            path, the window class, one instance per profile
 *   node scripts/smoke-installed-package.js upgrade-prepare  with the PREVIOUS release (0.9, packaged under the old
 *                                                            name) installed: leave a setting and a graph in its
 *                                                            profile at $SMOKE_HOME
 *   node scripts/smoke-installed-package.js upgrade-verify   with the NEW release installed over it: the old package
 *                                                            is gone, its profile folder was taken over under the
 *                                                            new name, and the setting and the graph are there
 *
 * SMOKE_PACKAGE: deb (default), rpm, or none (no package database: install.sh, an unpacked AppImage).
 * SMOKE_HOME (default: a new temp folder) is the HOME the app runs with; APP (default /usr/bin/nodewise-studio)
 * the executable. Every failure prints one SMOKE_* line and exits 1. The names come from src/shared/productNames.ts
 * and src/shared/legacyNames.ts (scripts/lib/product-names.js).
 *
 * The app is driven through its page (scripts/lib/cdp-launch.js): release builds have the inspector fuse off.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const asar = require('@electron/asar');
const { launchOverCdp } = require('./lib/cdp-launch');
const { APP_ID, DISPLAY_NAME, LEGACY_APP_ID } = require('./lib/product-names');

const PACKAGE = APP_ID;
const APP = process.env.APP || `/usr/bin/${PACKAGE}`;
const KIND = process.env.SMOKE_PACKAGE || 'deb';
const MARK_URL = 'https://comfy.example.com/upgrade-check/mcp';

function fail(message) {
  console.error(`SMOKE_FAILED ${message}`);
  process.exit(1);
}

function home() {
  const dir = process.env.SMOKE_HOME || fs.mkdtempSync(path.join(os.tmpdir(), 'package-smoke-home-'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function appEnv(homeDir) {
  const env = { ...process.env, HOME: homeDir, XDG_CONFIG_HOME: path.join(homeDir, '.config') };
  delete env.NODE_ENV;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function profileOf(homeDir, name = PACKAGE) {
  return path.join(homeDir, '.config', name);
}

/** Starts an installed app: this release by default, or the previous one (its executable and profile name). */
async function launch(homeDir, legacyRendererFile, executable = APP, name = PACKAGE) {
  const app = await launchOverCdp({ executable, env: appEnv(homeDir), userData: profileOf(homeDir, name), timeout: 90000, legacyRendererFile });
  await app.window.locator('.app-shell').waitFor({ timeout: 60000 });
  return app;
}

function packageField(field) {
  if (KIND === 'rpm') {
    const tag = { Version: 'VERSION', Maintainer: 'PACKAGER', Section: 'GROUP', Description: 'DESCRIPTION', License: 'LICENSE' }[field];
    return execFileSync('rpm', ['-q', '--queryformat', `%{${tag}}`, PACKAGE], { encoding: 'utf8' }).trim();
  }
  return execFileSync('dpkg-query', ['-W', `-f=\${${field}}`, PACKAGE], { encoding: 'utf8' }).trim();
}

function checkPackageFiles() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const version = packageField('Version');
  if (version !== pkg.version) fail(`PACKAGE_VERSION ${version} != ${pkg.version}`);
  if (KIND === 'deb') {
    const maintainer = packageField('Maintainer');
    if (!/<[^>]+@[^>]+>/.test(maintainer)) fail(`DEB_MAINTAINER ${maintainer}`);
    if (packageField('Section') !== 'graphics') fail(`DEB_SECTION ${packageField('Section')}`);
  } else if (packageField('License') !== 'MIT AND LicenseRef-Commons-Clause') {
    fail(`RPM_LICENSE ${packageField('License')}`);
  }
  const description = packageField('Description');
  if (!description.includes('ComfyUI') || description.split('\n').length < 3) fail('PACKAGE_DESCRIPTION');
  // Installing this package removes the one 0.x was shipped as (forge.config.js, rpm.spec.ejs).
  const replaces = KIND === 'rpm'
    ? execFileSync('rpm', ['-q', '--obsoletes', PACKAGE], { encoding: 'utf8' })
    : `${packageField('Replaces')} ${packageField('Conflicts')}`;
  if ((replaces.match(new RegExp(`\\b${LEGACY_APP_ID}\\b`, 'g')) ?? []).length < (KIND === 'rpm' ? 1 : 2)) fail(`PACKAGE_REPLACES ${replaces.trim()}`);

  const desktop = fs.readFileSync(`/usr/share/applications/${PACKAGE}.desktop`, 'utf8');
  for (const line of [`Name=${DISPLAY_NAME}`, `StartupWMClass=${PACKAGE}`, `Icon=${PACKAGE}`, 'Comment[ru]=', 'GenericName[ru]=']) {
    if (!desktop.includes(line)) fail(`DESKTOP_ENTRY missing ${line}`);
  }
  for (const size of [16, 32, 48, 128, 256, 512]) {
    const icon = `/usr/share/icons/hicolor/${size}x${size}/apps/${PACKAGE}.png`;
    if (!fs.existsSync(icon)) fail(`ICON_MISSING ${icon}`);
  }
  // Both packages make the bundle's LICENSE (the app's licence and the notices) their copyright file.
  const licenceFile = `/usr/share/doc/${PACKAGE}/copyright`;
  const copyright = fs.readFileSync(licenceFile, 'utf8');
  if (!copyright.startsWith(DISPLAY_NAME) || !copyright.includes('“Commons Clause” License Condition v1.0') || !copyright.includes('Copyright (c) 2026 ZoriyAI') || !copyright.includes('@xyflow/react')) {
    fail(`COPYRIGHT_FILE ${licenceFile} is not the app licence with the notices`);
  }
  const sandbox = fs.statSync(`/usr/lib/${PACKAGE}/chrome-sandbox`);
  if ((sandbox.mode & 0o4000) === 0 || sandbox.uid !== 0) fail('CHROME_SANDBOX not SUID root');
  console.log(`SMOKE_PACKAGE_OK kind=${KIND} version=${version}`);
}

/** desktopName in the package.json inside the app.asar next to the real executable. */
function shippedDesktopName() {
  const archive = path.join(path.dirname(fs.realpathSync(APP)), 'resources', 'app.asar');
  try {
    return JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8')).desktopName || '';
  } catch {
    return '';
  }
}

function checkVersionSwitch() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const printed = execFileSync(APP, process.getuid && process.getuid() === 0 ? ['--no-sandbox', '--version'] : ['--version'], { encoding: 'utf8', env: appEnv(home()), timeout: 30000 }).trim();
  if (printed !== `${DISPLAY_NAME} ${pkg.version}`) fail(`VERSION_SWITCH printed "${printed}"`);
}

async function check() {
  if (KIND !== 'none') checkPackageFiles();
  checkVersionSwitch();
  const homeDir = home();
  const app = await launch(homeDir);
  try {
    const { window } = app;
    const expected = profileOf(homeDir);
    if (!fs.existsSync(path.join(expected, 'comfyui-desktop.db'))) fail(`DATABASE_NOT_IN_PROFILE ${expected}`);
    // The window class and the Wayland app id come from the desktop name; it must be the installed entry.
    // The window class and the Wayland app id come from package.json desktopName (Electron sets CHROME_DESKTOP
    // from it inside the main process, out of reach of the page): it must name the installed entry.
    const desktop = shippedDesktopName();
    if (desktop !== `${PACKAGE}.desktop`) fail(`DESKTOP_NAME ${desktop}`);
    const title = await window.title();
    if (title !== DISPLAY_NAME) fail(`WINDOW_TITLE ${title}`);
    const provider = await window.locator('#chat-provider').getAttribute('data-value');
    if (provider !== '') fail(`UNEXPECTED_PROVIDER ${provider}`);

    // A second start on the same profile must not open a second app on the same database.
    // Root (a container) needs --no-sandbox; the CI runner's user does not.
    const sandboxFlag = process.getuid && process.getuid() === 0 ? ' --no-sandbox' : '';
    const second = execFileSync('bash', ['-c', `timeout 40 "${APP}"${sandboxFlag} >/dev/null 2>&1; echo $?`], { encoding: 'utf8', env: appEnv(homeDir) }).trim();
    if (second === '124') fail('SECOND_INSTANCE kept running next to the first (no single-instance lock)');
    if (second !== '0') fail(`SECOND_INSTANCE exited with ${second} instead of handing over to the first`);
    try {
      process.kill(app.child.pid, 0);
    } catch {
      fail('FIRST_INSTANCE_GONE');
    }
    console.log(`SMOKE_INSTALLED_OK profile=${expected} desktop=${desktop} second-start-exit=${second}`);
  } finally {
    await app.close();
  }
}

/** The previous release's executable: 0.x was packaged under the old name; a later one under the current name. */
function previousApp() {
  const legacy = `/usr/bin/${LEGACY_APP_ID}`;
  return fs.existsSync(legacy) ? { executable: legacy, name: LEGACY_APP_ID } : { executable: APP, name: PACKAGE };
}

async function upgradePrepare() {
  const homeDir = home();
  const previous = previousApp();
  // v0.8.0 uses loadFile; resolve the installed executable, not the checkout or an arbitrary file:// page.
  const legacyRendererFile = path.join(path.dirname(fs.realpathSync(previous.executable)), 'resources', 'app.asar', 'dist', 'renderer', 'index.html');
  const app = await launch(homeDir, legacyRendererFile, previous.executable, previous.name);
  try {
    const result = await app.window.evaluate(async (url) => {
      const api = window.electronAPI;
      const read = await api.getSettings();
      const saved = await api.saveSettings({ ...(read.values ?? {}), mcpUrl: url });
      const current = await api.readProjection('desktop');
      const outcome = await api.commitCommand({
        projectId: 'desktop', actionId: `upgrade-${Date.now()}`, expectedRevisionId: current.currentRevisionId, actor: 'manual', runId: null,
        payload: { type: 'add-node', nodeType: 'CheckpointLoaderSimple', title: 'Upgrade check', x: 120, y: 80 },
      });
      return { saved: saved.ok, status: outcome.status };
    }, MARK_URL);
    if (!result.saved) fail('UPGRADE_PREPARE settings not saved');
    if (result.status !== 'applied') fail(`UPGRADE_PREPARE graph not changed (${result.status})`);
    console.log(`SMOKE_UPGRADE_PREPARED home=${homeDir}`);
  } finally {
    await app.close();
  }
}

async function upgradeVerify() {
  const homeDir = process.env.SMOKE_HOME;
  const legacyProfile = profileOf(homeDir || '', LEGACY_APP_ID);
  const prepared = [profileOf(homeDir || ''), legacyProfile].some((dir) => fs.existsSync(path.join(dir, 'comfyui-desktop.db')));
  if (!homeDir || !prepared) fail('UPGRADE_VERIFY no prepared profile in SMOKE_HOME');
  // The old package is gone: the new one replaced it (Replaces / Conflicts, Obsoletes), not installed beside it.
  if (fs.existsSync(`/usr/bin/${LEGACY_APP_ID}`)) fail(`UPGRADE_OLD_PACKAGE_LEFT /usr/bin/${LEGACY_APP_ID}`);
  const app = await launch(homeDir);
  try {
    const found = await app.window.evaluate(async () => {
      const api = window.electronAPI;
      const read = await api.getSettings();
      const projection = await api.readProjection('desktop');
      const titles = (projection?.snapshot.nodes ?? []).map((node) => node?.data?.title ?? node?.title ?? '');
      return { mcpUrl: read.values?.mcpUrl ?? '', titles };
    });
    if (found.mcpUrl !== MARK_URL) fail(`UPGRADE_LOST_SETTINGS mcpUrl=${found.mcpUrl}`);
    if (!found.titles.includes('Upgrade check')) fail(`UPGRADE_LOST_GRAPH nodes=${JSON.stringify(found.titles)}`);
    // The 0.x profile was taken over (renamed), not copied: no second folder is left behind.
    if (fs.existsSync(legacyProfile)) fail(`UPGRADE_OLD_PROFILE_LEFT ${legacyProfile}`);
    console.log('SMOKE_UPGRADE_KEPT settings and graph; the old package and profile folder were taken over');
  } finally {
    await app.close();
  }
}

if (!['deb', 'rpm', 'none'].includes(KIND)) fail(`UNKNOWN_PACKAGE_KIND ${KIND}`);
const mode = process.argv[2] || 'check';
const run = { check, 'upgrade-prepare': upgradePrepare, 'upgrade-verify': upgradeVerify }[mode];
if (!run) fail(`UNKNOWN_MODE ${mode}`);
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
