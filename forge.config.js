/**
 * Packaging for the already-built Electron app. Linux x64 gets its distributables here (the makers below). Windows
 * x64 and macOS (Apple silicon and Intel) get only `electron-forge package`: an unpacked app folder or an unsigned
 * .app, which scripts/install/install-windows.ps1 and install-macos.sh build on the person's own computer and install
 * for that person (there are no signed packages for those systems). Electron Forge is the packager Electron
 * documents for this step:
 * https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
 * The deb maker requires dpkg and fakeroot (https://www.electronforge.io/config/makers/deb); the rpm maker requires
 * rpmbuild (https://www.electronforge.io/config/makers/rpm). The AppImage and the tar.gz with install.sh are made
 * from the same packaged folder by scripts/make-linux-portable.js.
 * asar: true keeps @electron/packager's default unpack of native .node files.
 */
const fs = require('fs');
const path = require('path');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const { addControlFields } = require('./scripts/lib/deb-control-fields');
const { APP_ID, DISPLAY_NAME, LEGACY_APP_ID } = require('./scripts/lib/product-names');
const { packageTarget, prebuildIgnore } = require('./scripts/lib/forge-target');

const pkg = require('./package.json');
/** The project address (src/main/identity.ts PROJECT_URL, mirrored in package.json); none while it is a placeholder. */
const HOMEPAGE = typeof pkg.homepage === 'string' && !pkg.homepage.includes('PLACEHOLDER') && !pkg.homepage.endsWith('/OWNER/REPOSITORY') ? pkg.homepage : '';

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const ICONS = Object.fromEntries(ICON_SIZES.map((size) => [`${size}x${size}`, `resources/icons/${size}x${size}.png`]));
// The names come from src/shared/productNames.ts (scripts/lib/product-names.js); package.json repeats them.
const PRODUCT_NAME = DISPLAY_NAME;
const GENERIC_NAME = 'ComfyUI creative assistant';
// The line under the name, the same words as package.json description and the About window.
const SUMMARY = pkg.description;
const LONG_DESCRIPTION = [
  `${DISPLAY_NAME} is an experimental desktop app for people new to ComfyUI.`,
  'It reads the nodes and models from your ComfyUI directly, with optional MCP',
  'for extra metadata, never changes anything there, and helps you understand a',
  'graph: a canvas, built-in lessons and an assistant that explains every step.',
  'What you save for ComfyUI is a plain workflow JSON file.',
].join('\n');
const DESKTOP_TEMPLATE = path.join(__dirname, 'resources', 'linux', 'desktop.ejs');
// The system this run builds for (linux-x64 for the Linux packages), from --platform and --arch.
const TARGET = packageTarget();
const HAS_RPMBUILD = (process.env.PATH || '').split(path.delimiter).some((dir) => dir && fs.existsSync(path.join(dir, 'rpmbuild')));

module.exports = {
  packagerConfig: {
    asar: true,
    // productName names the bundle folder; the binary keeps the package name the deb maker links to.
    executableName: APP_ID,
    // Extension added per platform by the packager: icon.ico for Windows, icon.icns for macOS (both made from the
    // PNGs by scripts/make-icon-containers.js). Linux takes the window icon from resources/icon.png.
    icon: 'resources/icon',
    // Windows: the names Task Manager and the file's properties show (the .exe is otherwise "Electron").
    win32metadata: { ProductName: PRODUCT_NAME, FileDescription: PRODUCT_NAME },
    // macOS: where Finder and Launchpad file the app. Unsigned here; install-macos.sh signs it ad hoc after copying.
    appCategoryType: 'public.app-category.education',
    /**
     * Ship only what runs. The app is dist/ (main, preload, renderer bundle, notices, help), the runtime
     * node_modules of main (the renderer's libraries are inside its bundle and are devDependencies), package.json
     * and the window icon. Everything else at the root (docs, tests, scripts, configs) stays out.
     */
    ignore: [
      /^\/(?!(dist|node_modules|resources|package\.json)(\/|$))[^/]+/,
      /^\/resources\/(?!icon\.png$)/,
      // better-sqlite3 loads prebuilds/<platform>-<arch>.node (N-API); its C sources and other systems' binaries
      // never run here. Only the target's own module ships (scripts/lib/forge-target.js). When no prebuild fits, the
      // install scripts compile one and put it at that same prebuilds/<target>.node.
      /^\/node_modules\/better-sqlite3\/(deps|src|build)(\/|$)/,
      prebuildIgnore(TARGET),
      // Type declarations, source maps and readmes of dependencies.
      /\.(map|d\.ts|d\.mts|d\.cts)$/i,
      /^\/node_modules\/.*\.(md|markdown)$/i,
    ],
  },
  // better-sqlite3 13 ships N-API prebuilds that load in Node and Electron alike: nothing to compile.
  rebuildConfig: {
    onlyModules: [],
  },
  hooks: {
    /**
     * The deb maker turns the bundle's LICENSE (Electron's) into /usr/share/doc/<package>/copyright. Make it the
     * app's COPYRIGHT (the holder; it starts with the product name), its licence, then the notices of everything
     * that ships with it, Electron included.
     */
    postPackage: async (_config, result) => {
      const root = __dirname;
      const copyright = fs.readFileSync(path.join(root, 'COPYRIGHT'), 'utf8').trim();
      const head = copyright.startsWith(PRODUCT_NAME) ? copyright : `${PRODUCT_NAME}\n\n${copyright}`;
      const licence = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').trim();
      const notices = fs.readFileSync(path.join(root, 'dist', 'notices', 'THIRD_PARTY_NOTICES.txt'), 'utf8');
      for (const output of result.outputPaths) {
        fs.writeFileSync(path.join(output, 'LICENSE'), `${head}\n\n${licence}\n\n\n${notices}`);
        // Electron's shared libraries are loaded, never run: plain 0644, as Debian policy asks of a library.
        for (const name of fs.readdirSync(output)) {
          if (/\.so(\.\d+)*$/.test(name)) fs.chmodSync(path.join(output, name), 0o644);
        }
      }
    },
    /**
     * Until 1.0 the app was packaged as LEGACY_APP_ID. The .deb says it replaces that package (Replaces and
     * Conflicts), so dpkg and apt remove the old package when this one is installed over it; the maker's control
     * template has no such fields, so they are added to the finished file. The .rpm says the same with Obsoletes
     * and Provides in resources/linux/rpm.spec.ejs.
     */
    postMake: async (_config, makeResults) => {
      for (const result of makeResults) {
        for (const artifact of result.artifacts) {
          if (artifact.endsWith('.deb')) addControlFields(artifact, { Replaces: LEGACY_APP_ID, Conflicts: LEGACY_APP_ID });
        }
      }
      return makeResults;
    },
  },
  plugins: [
    {
      // Electron fuses: switches baked into the binary that turn off ways to run other code with the app's rights.
      // https://www.electronjs.org/docs/latest/tutorial/fuses
      name: '@electron-forge/plugin-fuses',
      config: {
        version: FuseVersion.V1,
        // ELECTRON_RUN_AS_NODE would turn the app into a plain Node interpreter.
        [FuseV1Options.RunAsNode]: false,
        // NODE_OPTIONS could preload any script into the main process.
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        // --inspect would let any program start the app and run code in its main process, with its access to the
        // saved keys. Off: the package checks drive the shipped binary through the page instead
        // (scripts/lib/cdp-launch.js), and the e2e suite runs the unpackaged build, which has no fuses.
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        // The app runs only from app.asar, never from a loose app folder dropped next to it.
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        // The page is served as app://bundle (appProtocol.ts); file:// needs no extra rights.
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      },
    },
  ],
  makers: [
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          productName: PRODUCT_NAME,
          genericName: GENERIC_NAME,
          description: SUMMARY,
          productDescription: LONG_DESCRIPTION,
          section: 'graphics',
          // Added to the maker's list: the bundled binaries link against glibc.
          depends: ['libc6'],
          categories: ['Graphics', 'Education'],
          maintainer: 'ZoriyAI <229329866+ZoriyAI@users.noreply.github.com>',
          // Homepage from package.json; left out (empty) while the project address is still a placeholder.
          homepage: HOMEPAGE,
          icon: ICONS,
          desktopTemplate: DESKTOP_TEMPLATE,
          scripts: {
            postinst: 'resources/linux/postinst',
            postrm: 'resources/linux/postrm',
          },
          // Expected of every Electron bundle; each line says why it is fine here.
          lintianOverrides: [
            // Chromium's sandbox helper must be SUID root to sandbox the renderer (installed 4755 on purpose).
            // (tag name in older and in current lintian).
            'setuid-binary',
            'elevated-privileges',
            // Electron ships prebuilt, stripped Chromium libraries and the app's prebuilt SQLite module.
            'embedded-library',
            'unstripped-binary-or-object',
            'shared-library-lacks-prerequisites',
            'hardening-no-fortify-functions',
            'binary-or-shlib-defines-rpath',
            // Electron loads its own libffmpeg.so and libvulkan.so.1 from the app folder, not from the system.
            'shlib-without-versioned-soname',
            'shared-library-is-multi-arch-foreign',
            // The app has no man page; --help prints its options.
            'no-manual-page',
            // Release notes live in the app (Help ▸ What is new) and on the release page.
            'no-changelog',
            // The copyright file carries every licence in full, the Apache 2.0 text included, as the notices of
            // what ships must (scripts/build-assets.js); it is not a Debian source package.
            'copyright-file-contains-full-apache-2-license',
            'copyright-not-using-common-license-for-apache2',
          ],
        },
      },
    },
    {
      // Fedora, openSUSE and other rpm systems. Same files and scripts as the deb (electron-installer-redhat).
      // Made where rpmbuild exists (CI installs it); elsewhere skipped, so a .deb can still be made without it.
      name: '@electron-forge/maker-rpm',
      enabled: HAS_RPMBUILD,
      config: {
        options: {
          productName: PRODUCT_NAME,
          genericName: GENERIC_NAME,
          description: SUMMARY,
          productDescription: LONG_DESCRIPTION,
          license: 'MIT AND LicenseRef-Commons-Clause',
          // The 0.x package this one replaces (Obsoletes and Provides in rpm.spec.ejs).
          legacyPackages: [LEGACY_APP_ID],
          categories: ['Graphics', 'Education'],
          // The maker's spec with chrome-sandbox SUID root and copyright retained as a license.
          specTemplate: path.join(__dirname, 'resources', 'linux', 'rpm.spec.ejs'),
          icon: ICONS,
          desktopTemplate: DESKTOP_TEMPLATE,
          scripts: {
            post: 'resources/linux/postinst',
            postun: 'resources/linux/postrm',
          },
        },
      },
    },
  ],
};
