#!/usr/bin/env node
/**
 * The two Linux formats Electron Forge has no maker for, made from the folder `electron-forge package` (or `make`)
 * left in out/:
 *
 *   out/make/portable/nodewise-studio-<version>-linux-x64.tar.gz
 *       the app folder with run.sh (start in place), install.sh (install for the current user, no root) and
 *       uninstall.sh; icons and the menu entry under share/
 *   out/make/portable/nodewise-studio-<version>-x86_64.AppImage
 *       one file that runs on any distribution: the AppImage runtime followed by a SquashFS image of the app
 *
 * The AppImage needs mksquashfs (squashfs-tools) and the AppImage type 2 runtime for x86_64
 * (https://github.com/AppImage/type2-runtime, file runtime-x86_64), given by APPIMAGE_RUNTIME=<file>. Without the
 * runtime the SquashFS image is still made and kept as out/make/portable/appimage-payload.squashfs, so the AppImage's
 * contents can be checked; REQUIRE_APPIMAGE=1 (CI) makes a missing tool an error instead.
 *
 *   node scripts/make-linux-portable.js   (`npm run make:linux` runs it right after electron-forge make)
 *
 * scripts/smoke-linux-portable.js checks both results; tests/unit/linuxPortable.test.ts tests the exported helpers.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const NAME = pkg.name;
const ARCH = 'x64';
const APPIMAGE_ARCH = 'x86_64';
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

function fail(message) {
  console.error(`PORTABLE_FAILED ${message}`);
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

/**
 * The desktop entry of the deb and rpm (resources/linux/desktop.ejs), with the package name, the display name
 * (productName) and the line under it (description) filled in, as the makers fill them from forge.config.js.
 */
function desktopEntry() {
  const template = fs.readFileSync(path.join(root, 'resources', 'linux', 'desktop.ejs'), 'utf8');
  const text = template
    .replace(/<%=\s*name\s*%>/g, NAME)
    .replace(/<%=\s*productName\s*%>/g, pkg.productName)
    .replace(/<%=\s*description\s*%>/g, pkg.description);
  if (text.includes('<%')) fail('desktop.ejs uses a field make-linux-portable.js does not fill; teach it the new field');
  return text;
}

/** The icon PNGs into the hicolor theme layout under `shareDir`, where desktops look for an app's icon. */
function copyIcons(shareDir) {
  for (const size of ICON_SIZES) {
    const dir = path.join(shareDir, 'icons', 'hicolor', `${size}x${size}`, 'apps');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(root, 'resources', 'icons', `${size}x${size}.png`), path.join(dir, `${NAME}.png`));
  }
}

function writeExecutable(file, text) {
  fs.writeFileSync(file, text);
  fs.chmodSync(file, 0o755);
}

/** run.sh made to start the app from usr/lib/<name> inside the AppImage. */
function appRunScript() {
  const script = fs.readFileSync(path.join(root, 'resources', 'linux', 'portable', 'run.sh'), 'utf8');
  const result = script.replace(/^APP_SUBDIR=\.$/m, `APP_SUBDIR=usr/lib/${NAME}`).replace(/^IN_APPIMAGE=0$/m, 'IN_APPIMAGE=1');
  if (!result.includes(`APP_SUBDIR=usr/lib/${NAME}`) || !result.includes('IN_APPIMAGE=1')) fail('run.sh lost its APP_SUBDIR or IN_APPIMAGE line');
  return result;
}

/** The SquashFS image must follow a real type 2 runtime: an ELF file with the AppImage mark "AI\x02" at byte 8. */
function checkRuntime(file) {
  const head = Buffer.alloc(11);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, head, 0, 11, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (head.subarray(0, 4).toString('latin1') !== '\x7fELF' || head.subarray(8, 11).toString('latin1') !== 'AI\x02') {
    fail(`APPIMAGE_RUNTIME ${file} is not an AppImage type 2 runtime`);
  }
}

/** The tar.gz: the packaged folder plus the start, install and uninstall scripts, the menu entry and icons. */
function makeTarball(bundle, outDir, version) {
  const folder = `${NAME}-${version}-linux-${ARCH}`;
  const staging = path.join(outDir, folder);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.cpSync(bundle, staging, { recursive: true, verbatimSymlinks: true });
  for (const script of ['run.sh', 'install.sh', 'uninstall.sh']) {
    writeExecutable(path.join(staging, script), fs.readFileSync(path.join(root, 'resources', 'linux', 'portable', script), 'utf8'));
  }
  const share = path.join(staging, 'share');
  fs.mkdirSync(path.join(share, 'applications'), { recursive: true });
  fs.writeFileSync(path.join(share, 'applications', `${NAME}.desktop`), desktopEntry());
  copyIcons(share);
  const tarball = path.join(outDir, `${folder}.tar.gz`);
  // Owner root in the archive: unpacking as a normal user gives that user's files, never a stranger's uid.
  execFileSync('tar', ['-C', outDir, '--owner=0', '--group=0', '--numeric-owner', '--sort=name', '-czf', tarball, folder], { stdio: 'inherit' });
  fs.rmSync(staging, { recursive: true, force: true });
  console.log(`PORTABLE_TARBALL ${path.relative(root, tarball)} bytes=${fs.statSync(tarball).size}`);
  return tarball;
}

/**
 * The AppImage: an AppDir (app under usr/lib/<name>, AppRun, desktop entry, icons) packed into SquashFS and
 * appended to the runtime. Returns null when a tool or the runtime is missing and REQUIRE_APPIMAGE is not set.
 */
function makeAppImage(bundle, outDir, version) {
  const required = process.env.REQUIRE_APPIMAGE === '1';
  if (!have('mksquashfs')) {
    if (required) fail('mksquashfs is missing (apt install squashfs-tools)');
    console.log('PORTABLE_APPIMAGE_SKIPPED mksquashfs is missing (apt install squashfs-tools)');
    return null;
  }
  const appDir = path.join(outDir, 'AppDir');
  fs.rmSync(appDir, { recursive: true, force: true });
  const libDir = path.join(appDir, 'usr', 'lib', NAME);
  fs.mkdirSync(path.dirname(libDir), { recursive: true });
  fs.cpSync(bundle, libDir, { recursive: true, verbatimSymlinks: true });
  writeExecutable(path.join(appDir, 'AppRun'), appRunScript());
  const entry = desktopEntry();
  fs.writeFileSync(path.join(appDir, `${NAME}.desktop`), entry);
  fs.mkdirSync(path.join(appDir, 'usr', 'share', 'applications'), { recursive: true });
  fs.writeFileSync(path.join(appDir, 'usr', 'share', 'applications', `${NAME}.desktop`), entry);
  copyIcons(path.join(appDir, 'usr', 'share'));
  fs.copyFileSync(path.join(root, 'resources', 'icons', '256x256.png'), path.join(appDir, `${NAME}.png`));
  fs.symlinkSync(`${NAME}.png`, path.join(appDir, '.DirIcon'));

  const payload = path.join(outDir, 'appimage-payload.squashfs');
  fs.rmSync(payload, { force: true });
  // zstd: what the current type 2 runtime reads; root-owned so the mounted files do not carry the builder's uid.
  execFileSync('mksquashfs', [appDir, payload, '-root-owned', '-noappend', '-comp', 'zstd', '-quiet', '-no-progress'], { stdio: 'inherit' });
  fs.rmSync(appDir, { recursive: true, force: true });

  const runtime = process.env.APPIMAGE_RUNTIME;
  if (!runtime || !fs.existsSync(runtime)) {
    if (required) fail('APPIMAGE_RUNTIME is not set to the type 2 runtime file');
    console.log(`PORTABLE_APPIMAGE_PAYLOAD_ONLY ${path.relative(root, payload)}: set APPIMAGE_RUNTIME=<runtime-${APPIMAGE_ARCH}> for the .AppImage`);
    return null;
  }
  checkRuntime(runtime);
  const image = path.join(outDir, `${NAME}-${version}-${APPIMAGE_ARCH}.AppImage`);
  fs.writeFileSync(image, Buffer.concat([fs.readFileSync(runtime), fs.readFileSync(payload)]));
  fs.chmodSync(image, 0o755);
  fs.rmSync(payload, { force: true });
  console.log(`PORTABLE_APPIMAGE ${path.relative(root, image)} bytes=${fs.statSync(image).size}`);
  return image;
}

function main() {
  const bundle = path.join(root, 'out', `${pkg.productName || NAME}-linux-${ARCH}`);
  if (!fs.existsSync(path.join(bundle, NAME))) fail(`no packaged app at ${bundle}: run electron-forge package or make first`);
  const outDir = path.join(root, 'out', 'make', 'portable');
  fs.mkdirSync(outDir, { recursive: true });
  makeTarball(bundle, outDir, pkg.version);
  makeAppImage(bundle, outDir, pkg.version);
}

module.exports = { appRunScript, desktopEntry };

if (require.main === module) main();
