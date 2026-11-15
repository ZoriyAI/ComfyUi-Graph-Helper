#!/usr/bin/env node
/**
 * Checks the tar.gz and the AppImage that scripts/make-linux-portable.js made, as a person would use them. Run under
 * Xvfb.
 *
 *   tar.gz:   unpack; run.sh --version; run.sh opens the window; install.sh into a fresh HOME (app folder, launcher,
 *             menu entry, icons); the launcher opens the window with the profile in that HOME; uninstall.sh removes
 *             what install.sh made and keeps the profile; uninstall.sh --purge deletes the profile
 *   AppImage: --appimage-extract (no FUSE needed), the AppDir's files, AppRun --version, AppRun opens the window.
 *             Without the runtime, the kept SquashFS payload is unpacked with unsquashfs and checked the same way.
 *
 * Both: the fuses of the binary inside. SMOKE_REQUIRE_APPIMAGE=1 makes a missing .AppImage an error (CI).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { launchOverCdp } = require('./lib/cdp-launch');
const { DISPLAY_NAME } = require('./lib/product-names');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const NAME = pkg.name;
const OUT = path.join(root, 'out', 'make', 'portable');
const ROOT_USER = process.getuid && process.getuid() === 0;

function fail(message) {
  console.error(`PORTABLE_SMOKE_FAILED ${message}`);
  process.exit(1);
}

function have(command) {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** A person's session with `homeDir` as HOME and the default XDG folders, so the scripts use their own defaults. */
function cleanEnv(homeDir) {
  const env = { ...process.env, HOME: homeDir };
  delete env.NODE_ENV;
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.XDG_CONFIG_HOME;
  delete env.XDG_DATA_HOME;
  return env;
}

function mustExist(file, label) {
  if (!fs.existsSync(file)) fail(`${label} missing: ${file}`);
}

function mustBeExecutable(file) {
  mustExist(file, 'FILE');
  if ((fs.statSync(file).mode & 0o111) === 0) fail(`NOT_EXECUTABLE ${file}`);
}

function validateDesktop(file) {
  if (!have('desktop-file-validate')) {
    console.log(`PORTABLE_DESKTOP_NOT_VALIDATED ${path.basename(file)} (desktop-file-validate missing)`);
    return;
  }
  try {
    execFileSync('desktop-file-validate', [file], { stdio: 'inherit' });
  } catch {
    fail(`DESKTOP_ENTRY_INVALID ${file}`);
  }
}

function checkFuses(binary) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'check-fuses.js'), binary], { stdio: 'inherit' });
  } catch {
    fail(`FUSES ${binary}`);
  }
}

/** `--version` must print the display name and the package version. */
function checkVersion(starter, env) {
  const printed = execFileSync(starter, [...(ROOT_USER ? ['--no-sandbox'] : []), '--version'], { encoding: 'utf8', env, timeout: 30000 }).trim();
  if (printed !== `${DISPLAY_NAME} ${pkg.version}`) fail(`VERSION_SWITCH ${starter} printed "${printed}"`);
}

/** Starts the app through `starter` and waits for the window; profile is where its user data must land. */
async function openWindow(starter, env, profile, args = []) {
  const app = await launchOverCdp({ executable: starter, args, env, userData: profile, timeout: 90000 });
  try {
    await app.window.locator('.app-shell').waitFor({ timeout: 60000 });
    const title = await app.window.title();
    if (title !== DISPLAY_NAME) fail(`WINDOW_TITLE ${title}`);
    mustExist(path.join(profile, 'comfyui-desktop.db'), 'DATABASE_IN_PROFILE');
  } finally {
    await app.close();
  }
}

async function checkTarball(work) {
  const tarball = path.join(OUT, `${NAME}-${pkg.version}-linux-x64.tar.gz`);
  mustExist(tarball, 'TARBALL');
  const unpackDir = path.join(work, 'unpacked');
  fs.mkdirSync(unpackDir);
  execFileSync('tar', ['-xzf', tarball, '-C', unpackDir]);
  const folder = path.join(unpackDir, `${NAME}-${pkg.version}-linux-x64`);
  for (const script of ['run.sh', 'install.sh', 'uninstall.sh', NAME]) mustBeExecutable(path.join(folder, script));
  mustExist(path.join(folder, 'resources', 'app.asar'), 'ASAR');
  mustExist(path.join(folder, 'chrome-sandbox'), 'CHROME_SANDBOX');
  validateDesktop(path.join(folder, 'share', 'applications', `${NAME}.desktop`));
  for (const size of [16, 32, 48, 128, 256, 512]) mustExist(path.join(folder, 'share', 'icons', 'hicolor', `${size}x${size}`, 'apps', `${NAME}.png`), 'ICON');
  checkFuses(path.join(folder, NAME));

  // In place.
  const placeHome = path.join(work, 'home-in-place');
  fs.mkdirSync(placeHome);
  checkVersion(path.join(folder, 'run.sh'), cleanEnv(placeHome));
  const placeProfile = path.join(work, 'profile-in-place');
  await openWindow(path.join(folder, 'run.sh'), cleanEnv(placeHome), placeProfile, [`--user-data-dir=${placeProfile}`]);
  console.log('PORTABLE_RUN_SH_OK');

  // Installed for one user, in a fresh HOME.
  const userHome = path.join(work, 'home');
  fs.mkdirSync(userHome);
  const env = cleanEnv(userHome);
  execFileSync(path.join(folder, 'install.sh'), [], { env, stdio: 'inherit' });
  const appDir = path.join(userHome, '.local', 'share', NAME);
  const launcher = path.join(userHome, '.local', 'bin', NAME);
  const entry = path.join(userHome, '.local', 'share', 'applications', `${NAME}.desktop`);
  mustBeExecutable(launcher);
  mustBeExecutable(path.join(appDir, NAME));
  mustBeExecutable(path.join(appDir, 'uninstall.sh'));
  if (fs.existsSync(path.join(appDir, 'install.sh'))) fail('INSTALL_SH_COPIED into the app folder');
  mustExist(path.join(userHome, '.local', 'share', 'icons', 'hicolor', '256x256', 'apps', `${NAME}.png`), 'INSTALLED_ICON');
  validateDesktop(entry);
  const entryText = fs.readFileSync(entry, 'utf8');
  if (!entryText.includes(`Exec="${launcher}" %U`)) fail(`DESKTOP_EXEC ${entryText.match(/^Exec=.*$/m)?.[0]}`);
  checkVersion(launcher, env);
  const profile = path.join(userHome, '.config', NAME);
  await openWindow(launcher, env, profile);
  console.log(`PORTABLE_INSTALL_OK app=${appDir}`);

  // Installing again over the first copy replaces it.
  execFileSync(path.join(folder, 'install.sh'), [], { env, stdio: 'ignore' });
  mustBeExecutable(path.join(appDir, NAME));

  execFileSync(path.join(appDir, 'uninstall.sh'), [], { env, stdio: 'inherit' });
  for (const gone of [appDir, launcher, entry, path.join(userHome, '.local', 'share', 'icons', 'hicolor', '256x256', 'apps', `${NAME}.png`)]) {
    if (fs.existsSync(gone)) fail(`UNINSTALL_LEFT ${gone}`);
  }
  mustExist(path.join(profile, 'comfyui-desktop.db'), 'PROFILE_KEPT_AFTER_UNINSTALL');
  execFileSync(path.join(folder, 'uninstall.sh'), ['--purge'], { env, stdio: 'inherit' });
  if (fs.existsSync(profile)) fail(`PURGE_LEFT ${profile}`);
  console.log('PORTABLE_UNINSTALL_OK');
}

async function checkAppDir(appDir, label) {
  mustBeExecutable(path.join(appDir, 'AppRun'));
  const appRun = fs.readFileSync(path.join(appDir, 'AppRun'), 'utf8');
  if (!appRun.includes(`APP_SUBDIR=usr/lib/${NAME}`) || !appRun.includes('IN_APPIMAGE=1')) fail('APPRUN_NOT_REWRITTEN');
  validateDesktop(path.join(appDir, `${NAME}.desktop`));
  mustExist(path.join(appDir, `${NAME}.png`), 'APPDIR_ICON');
  mustExist(path.join(appDir, '.DirIcon'), 'DIRICON');
  const binary = path.join(appDir, 'usr', 'lib', NAME, NAME);
  mustBeExecutable(binary);
  checkFuses(binary);
  const homeDir = path.join(path.dirname(appDir), 'home');
  fs.mkdirSync(homeDir, { recursive: true });
  const env = cleanEnv(homeDir);
  checkVersion(path.join(appDir, 'AppRun'), env);
  await openWindow(path.join(appDir, 'AppRun'), env, path.join(homeDir, '.config', NAME));
  console.log(`PORTABLE_APPIMAGE_OK ${label}`);
}

async function checkAppImage(work) {
  const image = path.join(OUT, `${NAME}-${pkg.version}-x86_64.AppImage`);
  const payload = path.join(OUT, 'appimage-payload.squashfs');
  const dir = path.join(work, 'appimage');
  fs.mkdirSync(dir);
  if (fs.existsSync(image)) {
    mustBeExecutable(image);
    // --appimage-extract needs no FUSE; it unpacks squashfs-root next to the working folder.
    execFileSync(image, ['--appimage-extract'], { cwd: dir, stdio: 'ignore' });
    await checkAppDir(path.join(dir, 'squashfs-root'), path.basename(image));
    return;
  }
  if (process.env.SMOKE_REQUIRE_APPIMAGE === '1') fail(`APPIMAGE missing: ${image}`);
  if (fs.existsSync(payload) && have('unsquashfs')) {
    execFileSync('unsquashfs', ['-q', '-d', path.join(dir, 'squashfs-root'), payload], { stdio: 'ignore' });
    await checkAppDir(path.join(dir, 'squashfs-root'), `${path.basename(payload)} (payload only: no runtime here)`);
    return;
  }
  console.log('PORTABLE_APPIMAGE_NOT_CHECKED (no .AppImage and no payload)');
}

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-smoke-'));
  try {
    await checkTarball(work);
    await checkAppImage(work);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
