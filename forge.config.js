/**
 * Linux distributables for the already-built Electron app. The app is built and tested for Linux x64 only.
 * Electron Forge is the packager Electron documents for this step:
 * https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
 * The deb maker requires dpkg and fakeroot (https://www.electronforge.io/config/makers/deb); the rpm maker requires
 * rpmbuild (https://www.electronforge.io/config/makers/rpm). The AppImage and the tar.gz with install.sh are made
 * from the same packaged folder by scripts/make-linux-portable.js.
 * asar: true keeps @electron/packager's default unpack of native .node files.
 */
const fs = require('fs');
const path = require('path');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const ICONS = Object.fromEntries(ICON_SIZES.map((size) => [`${size}x${size}`, `resources/icons/${size}x${size}.png`]));
const PRODUCT_NAME = 'Graph Helper for ComfyUI';
const GENERIC_NAME = 'ComfyUI graph tutor';
const SUMMARY = 'learn to build ComfyUI graphs with a read-only helper';
const LONG_DESCRIPTION = [
  'Graph Helper for ComfyUI is a desktop helper for people new to ComfyUI.',
  'It reads the nodes and models you have through the MCP server next to your',
  'ComfyUI, never changes anything there, and helps you build and understand a',
  'graph: a canvas, built-in lessons and an assistant that explains every step.',
  'What you save for ComfyUI is a plain workflow JSON file.',
].join('\n');
const DESKTOP_TEMPLATE = path.join(__dirname, 'resources', 'linux', 'desktop.ejs');
const HAS_RPMBUILD = (process.env.PATH || '').split(path.delimiter).some((dir) => dir && fs.existsSync(path.join(dir, 'rpmbuild')));

module.exports = {
  packagerConfig: {
    asar: true,
    // productName names the bundle folder; the binary keeps the package name the deb maker links to.
    executableName: 'comfyui-graph-builder',
    // Extension added per platform by the packager; Linux takes the window icon from resources/icon.png.
    icon: 'resources/icon',
    /**
     * Ship only what runs. The app is dist/ (main, preload, renderer bundle, notices, help), the runtime
     * node_modules of main (the renderer's libraries are inside its bundle and are devDependencies), package.json
     * and the window icon. Everything else at the root (docs, tests, scripts, configs) stays out.
     */
    ignore: [
      /^\/(?!(dist|node_modules|resources|package\.json)(\/|$))[^/]+/,
      /^\/resources\/(?!icon\.png$)/,
      // better-sqlite3 loads prebuilds/<platform>-<arch>.node (N-API); its C sources and other platforms' binaries
      // never run here. Only x64 is built today.
      /^\/node_modules\/better-sqlite3\/(deps|src|build)(\/|$)/,
      /^\/node_modules\/better-sqlite3\/prebuilds\/(?!linux-x64\.node$)/,
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
     * app's licence followed by the notices of everything that ships with it, Electron included.
     */
    postPackage: async (_config, result) => {
      const root = __dirname;
      const licence = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8').trim();
      const notices = fs.readFileSync(path.join(root, 'dist', 'notices', 'THIRD_PARTY_NOTICES.txt'), 'utf8');
      for (const output of result.outputPaths) {
        fs.writeFileSync(path.join(output, 'LICENSE'), `Graph Helper for ComfyUI\n\n${licence}\n\n\n${notices}`);
        // Electron's shared libraries are loaded, never run: plain 0644, as Debian policy asks of a library.
        for (const name of fs.readdirSync(output)) {
          if (/\.so(\.\d+)*$/.test(name)) fs.chmodSync(path.join(output, name), 0o644);
        }
      }
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
          // No Homepage while the repository is private: the link would show a 404 to everyone else.
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
          license: 'MIT',
          categories: ['Graphics', 'Education'],
          // The maker's own spec plus one line: chrome-sandbox SUID root, as in the .deb.
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
