const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const asar = require('@electron/asar');
const { launchOverCdp } = require('./lib/cdp-launch');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  // The packager names the folder after productName; the executable keeps the package name (forge.config.js).
  const bundle = path.join(root, 'out', `${pkg.productName || pkg.name}-linux-x64`);
  const exe = path.join(bundle, pkg.name);
  if (!fs.existsSync(exe)) fail(`PACKAGED_EXECUTABLE_MISSING ${exe}`);

  const debs = walk(path.join(root, 'out', 'make', 'deb')).filter((file) => file.endsWith('.deb'));
  if (debs.length !== 1) fail(`DEB_COUNT ${debs.length}`);
  const debStat = fs.statSync(debs[0]);
  if (debStat.size < 20 * 1024 * 1024) fail(`DEB_TOO_SMALL ${debStat.size}`);
  // The rpm is made where rpmbuild exists (CI); SMOKE_REQUIRE_RPM=1 makes its absence an error.
  const rpms = walk(path.join(root, 'out', 'make', 'rpm')).filter((file) => file.endsWith('.rpm'));
  if (rpms.length > 1 || (process.env.SMOKE_REQUIRE_RPM === '1' && rpms.length !== 1)) fail(`RPM_COUNT ${rpms.length}`);
  if (rpms.length === 1 && fs.statSync(rpms[0]).size < 20 * 1024 * 1024) fail(`RPM_TOO_SMALL ${fs.statSync(rpms[0]).size}`);

  // The fuses in the binary people get (scripts/check-fuses.js): the inspector, ELECTRON_RUN_AS_NODE and
  // NODE_OPTIONS off, the app only from app.asar.
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'check-fuses.js'), exe], { stdio: 'inherit' });
  } catch {
    fail('PACKAGED_FUSES');
  }

  const unpackedNodes = walk(path.join(bundle, 'resources', 'app.asar.unpacked')).filter((file) => file.endsWith('.node'));
  if (unpackedNodes.length === 0) fail('NATIVE_MODULE_NOT_UNPACKED');

  const asarPath = path.join(bundle, 'resources', 'app.asar');
  const main = asar.extractFile(asarPath, 'dist/main/index.js').toString('utf8');
  const database = asar.extractFile(asarPath, 'dist/main/database.js').toString('utf8');
  if (!main.includes('webSecurity: true') || !main.includes('contextIsolation: true') || !main.includes('sandbox: true')) {
    fail('PACKAGED_MAIN_SECURITY');
  }
  if (!database.includes('./settings/migrate')) fail('PACKAGED_MAIN_DATABASE');
  if (main.includes('setUsePlainTextEncryption')) fail('PACKAGED_PLAINTEXT_KEY');

  // Ship only what runs (forge.config.js ignore): no docs, maps, typings, tests or other platforms' binaries.
  const files = asar.listPackage(asarPath);
  const stray = files.filter((file) => (/\.(md|map|d\.ts)$/i.test(file) && !file.startsWith('/dist/help/')) || /^\/(src|tests|docs|scripts|\.github)(\/|$)/.test(file)
    || /^\/(README|STATUS|LICENSE)/.test(file));
  if (stray.length > 0) fail(`PACKAGED_STRAY_FILES ${stray.slice(0, 10).join(' ')}`);
  for (const needed of ['/dist/notices/third-party.json', '/dist/notices/LICENSE.txt', '/dist/help/guide.ru.md', '/dist/help/troubleshooting.en.md', '/dist/help/whatsnew.md', '/resources/icon.png']) {
    if (!files.includes(needed)) fail(`PACKAGED_MISSING ${needed}`);
  }
  const foreign = unpackedNodes.filter((file) => !file.endsWith(`${path.sep}linux-x64.node`));
  if (foreign.length > 0) fail(`PACKAGED_FOREIGN_NATIVE ${foreign.map((file) => path.basename(file)).join(' ')}`);
  // The deb's copyright file is made from the bundle's LICENSE: the app's licence, then the notices.
  const bundleLicence = fs.readFileSync(path.join(bundle, 'LICENSE'), 'utf8');
  if (!bundleLicence.startsWith('Graph Helper for ComfyUI') || !bundleLicence.includes('Copyright (c) 2026 ZoriyAI') || !bundleLicence.includes('electron ')) {
    fail('PACKAGED_LICENCE');
  }

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'linux-package-smoke-'));
  const env = { ...process.env };
  delete env.NODE_ENV;
  // Through the page, not the inspector: the inspector fuse is off in this binary (scripts/lib/cdp-launch.js).
  const app = await launchOverCdp({ executable: exe, args: [`--user-data-dir=${userData}`], env, userData, timeout: 60000 });
  try {
    const window = app.window;
    await window.locator('#chat-provider').waitFor({ timeout: 60000 });
    const title = await window.title();
    if (!title.includes('ComfyUI')) fail(`UNEXPECTED_TITLE ${title}`);
    const provider = await window.locator('#chat-provider').getAttribute('data-value');
    if (provider !== '') fail(`UNEXPECTED_PROVIDER ${provider}`);
    console.log(`PACKAGED_MAIN_OK ${path.basename(debs[0])} bytes=${debStat.size}${rpms.length === 1 ? ` ${path.basename(rpms[0])} bytes=${fs.statSync(rpms[0]).size}` : ' (no rpm: rpmbuild missing)'}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
