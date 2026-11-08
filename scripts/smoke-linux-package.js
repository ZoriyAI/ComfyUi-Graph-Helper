const fs = require('fs');
const os = require('os');
const path = require('path');
const { _electron: electron } = require('playwright');
const asar = require('@electron/asar');

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
  const bundle = path.join(root, 'out', `${pkg.name}-linux-x64`);
  const exe = path.join(bundle, pkg.name);
  if (!fs.existsSync(exe)) fail(`PACKAGED_EXECUTABLE_MISSING ${exe}`);

  const debs = walk(path.join(root, 'out', 'make', 'deb')).filter((file) => file.endsWith('.deb'));
  if (debs.length !== 1) fail(`DEB_COUNT ${debs.length}`);
  const debStat = fs.statSync(debs[0]);
  if (debStat.size < 20 * 1024 * 1024) fail(`DEB_TOO_SMALL ${debStat.size}`);

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

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'linux-package-smoke-'));
  const env = { ...process.env };
  delete env.NODE_ENV;
  const app = await electron.launch({
    executablePath: exe,
    args: [`--user-data-dir=${userData}`],
    env,
    timeout: 60000,
  });
  try {
    const window = await app.firstWindow();
    const title = await window.title();
    if (!title.includes('ComfyUI')) fail(`UNEXPECTED_TITLE ${title}`);
    await window.locator('#chat-provider').waitFor();
    const provider = await window.locator('#chat-provider').inputValue();
    if (provider !== '') fail(`UNEXPECTED_PROVIDER ${provider}`);
    console.log(`PACKAGED_MAIN_OK ${path.basename(debs[0])} bytes=${debStat.size}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
