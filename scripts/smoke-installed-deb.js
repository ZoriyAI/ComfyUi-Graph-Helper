#!/usr/bin/env node
/**
 * Checks the app as a person gets it: installed from the .deb, started without --user-data-dir, with its own
 * profile under $HOME. Run under Xvfb (CI: after `sudo apt-get install ./out/make/deb/x64/*.deb`).
 *
 *   node scripts/smoke-installed-deb.js check            the installed package: control fields, desktop entry,
 *                                                       icons, copyright, --version, the window, the profile path,
 *                                                       the window class, one instance per profile
 *   node scripts/smoke-installed-deb.js upgrade-prepare  with the PREVIOUS release installed: leave a setting and a
 *                                                       graph in the profile at $SMOKE_HOME
 *   node scripts/smoke-installed-deb.js upgrade-verify   with the NEW release installed over it: they are still there
 *
 * SMOKE_HOME (default: a new temp folder) is the HOME the app runs with; APP (default /usr/bin/comfyui-graph-builder)
 * the executable; SMOKE_SKIP_DPKG=1 skips the package-file checks. Every failure prints one SMOKE_* line and exits 1.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { _electron: electron } = require('playwright');

const PACKAGE = 'comfyui-graph-builder';
const APP = process.env.APP || `/usr/bin/${PACKAGE}`;
const DISPLAY_NAME = 'Graph Helper for ComfyUI';
const MARK_URL = 'https://comfy.example.com/upgrade-check/mcp';

function fail(message) {
  console.error(`SMOKE_FAILED ${message}`);
  process.exit(1);
}

function home() {
  const dir = process.env.SMOKE_HOME || fs.mkdtempSync(path.join(os.tmpdir(), 'deb-smoke-home-'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function appEnv(homeDir) {
  const env = { ...process.env, HOME: homeDir, XDG_CONFIG_HOME: path.join(homeDir, '.config') };
  delete env.NODE_ENV;
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

async function launch(homeDir) {
  const app = await electron.launch({ executablePath: APP, args: [], env: appEnv(homeDir), timeout: 90000 });
  const window = await app.firstWindow({ timeout: 90000 });
  await window.locator('.app-shell').waitFor({ timeout: 60000 });
  return { app, window };
}

function dpkgField(field) {
  return execFileSync('dpkg-query', ['-W', `-f=\${${field}}`, PACKAGE], { encoding: 'utf8' }).trim();
}

function checkPackageFiles() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const version = dpkgField('Version');
  if (version !== pkg.version) fail(`DEB_VERSION ${version} != ${pkg.version}`);
  const maintainer = dpkgField('Maintainer');
  if (!/<[^>]+@[^>]+>/.test(maintainer)) fail(`DEB_MAINTAINER ${maintainer}`);
  if (dpkgField('Section') !== 'graphics') fail(`DEB_SECTION ${dpkgField('Section')}`);
  const description = dpkgField('Description');
  if (!description.includes('ComfyUI') || description.split('\n').length < 3) fail('DEB_DESCRIPTION');

  const desktop = fs.readFileSync(`/usr/share/applications/${PACKAGE}.desktop`, 'utf8');
  for (const line of [`Name=${DISPLAY_NAME}`, `StartupWMClass=${PACKAGE}`, `Icon=${PACKAGE}`, 'Comment[ru]=', 'GenericName[ru]=']) {
    if (!desktop.includes(line)) fail(`DESKTOP_ENTRY missing ${line}`);
  }
  for (const size of [16, 32, 48, 128, 256, 512]) {
    const icon = `/usr/share/icons/hicolor/${size}x${size}/apps/${PACKAGE}.png`;
    if (!fs.existsSync(icon)) fail(`ICON_MISSING ${icon}`);
  }
  const copyright = fs.readFileSync(`/usr/share/doc/${PACKAGE}/copyright`, 'utf8');
  if (!copyright.startsWith(DISPLAY_NAME) || !copyright.includes('Copyright (c) 2026 ZoriyAI') || !copyright.includes('@xyflow/react')) {
    fail('COPYRIGHT_FILE is not the app licence with the notices');
  }
  const sandbox = fs.statSync(`/usr/lib/${PACKAGE}/chrome-sandbox`);
  if ((sandbox.mode & 0o4000) === 0 || sandbox.uid !== 0) fail('CHROME_SANDBOX not SUID root');

  const printed = execFileSync(APP, process.getuid && process.getuid() === 0 ? ['--no-sandbox', '--version'] : ['--version'], { encoding: 'utf8', env: appEnv(home()), timeout: 30000 }).trim();
  if (printed !== `${DISPLAY_NAME} ${pkg.version}`) fail(`VERSION_SWITCH printed "${printed}"`);
  console.log(`SMOKE_PACKAGE_OK version=${version} maintainer="${maintainer}"`);
}

async function check() {
  // SMOKE_SKIP_DPKG=1: try the app part against an unpacked bundle (APP=...) on a machine without the package.
  if (process.env.SMOKE_SKIP_DPKG !== '1') checkPackageFiles();
  const homeDir = home();
  const { app, window } = await launch(homeDir);
  try {
    const facts = await app.evaluate(({ app: electronApp, BrowserWindow }) => ({
      name: electronApp.getName(),
      userData: electronApp.getPath('userData'),
      desktop: process.env.CHROME_DESKTOP || '',
      title: BrowserWindow.getAllWindows()[0]?.getTitle() ?? '',
      minimum: BrowserWindow.getAllWindows()[0]?.getMinimumSize() ?? [],
    }));
    const expected = path.join(homeDir, '.config', PACKAGE);
    if (facts.userData !== expected) fail(`PROFILE_PATH ${facts.userData} != ${expected}`);
    if (facts.name !== PACKAGE) fail(`APP_NAME ${facts.name}`);
    // The window class and the Wayland app id come from the desktop name; it must be the installed entry.
    if (facts.desktop !== `${PACKAGE}.desktop`) fail(`DESKTOP_NAME ${facts.desktop}`);
    if (facts.title !== DISPLAY_NAME) fail(`WINDOW_TITLE ${facts.title}`);
    if (facts.minimum[0] < 800 || facts.minimum[1] < 560) fail(`MINIMUM_SIZE ${facts.minimum.join('x')}`);
    if (!fs.existsSync(path.join(expected, 'comfyui-desktop.db'))) fail('DATABASE_NOT_IN_PROFILE');
    const provider = await window.locator('#chat-provider').getAttribute('data-value');
    if (provider !== '') fail(`UNEXPECTED_PROVIDER ${provider}`);

    // A second start on the same profile must not open a second app on the same database.
    const firstPid = await app.evaluate(() => process.pid);
    // Root (a container) needs --no-sandbox; the CI runner's user does not.
    const sandboxFlag = process.getuid && process.getuid() === 0 ? ' --no-sandbox' : '';
    const second = execFileSync('bash', ['-c', `timeout 40 "${APP}"${sandboxFlag} >/dev/null 2>&1; echo $?`], { encoding: 'utf8', env: appEnv(homeDir) }).trim();
    if (second === '124') fail('SECOND_INSTANCE kept running next to the first (no single-instance lock)');
    if (second !== '0') fail(`SECOND_INSTANCE exited with ${second} instead of handing over to the first`);
    const stillFirst = await app.evaluate(() => process.pid);
    if (stillFirst !== firstPid) fail('FIRST_INSTANCE_GONE');
    console.log(`SMOKE_INSTALLED_OK profile=${facts.userData} desktop=${facts.desktop} second-start-exit=${second}`);
  } finally {
    await app.close();
  }
}

async function upgradePrepare() {
  const homeDir = home();
  const { app, window } = await launch(homeDir);
  try {
    const result = await window.evaluate(async (url) => {
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
  if (!homeDir || !fs.existsSync(path.join(homeDir, '.config', PACKAGE, 'comfyui-desktop.db'))) fail('UPGRADE_VERIFY no prepared profile in SMOKE_HOME');
  const { app, window } = await launch(homeDir);
  try {
    const found = await window.evaluate(async () => {
      const api = window.electronAPI;
      const read = await api.getSettings();
      const projection = await api.readProjection('desktop');
      const titles = (projection?.snapshot.nodes ?? []).map((node) => node?.data?.title ?? node?.title ?? '');
      return { mcpUrl: read.values?.mcpUrl ?? '', titles };
    });
    if (found.mcpUrl !== MARK_URL) fail(`UPGRADE_LOST_SETTINGS mcpUrl=${found.mcpUrl}`);
    if (!found.titles.includes('Upgrade check')) fail(`UPGRADE_LOST_GRAPH nodes=${JSON.stringify(found.titles)}`);
    console.log('SMOKE_UPGRADE_KEPT settings and graph');
  } finally {
    await app.close();
  }
}

const mode = process.argv[2] || 'check';
const run = { check, 'upgrade-prepare': upgradePrepare, 'upgrade-verify': upgradeVerify }[mode];
if (!run) fail(`UNKNOWN_MODE ${mode}`);
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
