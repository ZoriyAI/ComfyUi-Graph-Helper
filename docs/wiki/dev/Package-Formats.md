[Русский](Package-Formats.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Package formats

What is built, how, and how each format is checked. All formats are Linux, 64-bit x86, unsigned; their origin is
proven by GitHub's build provenance attestation and `SHA256SUMS`.

## The four formats

| Format | Made by | Checked |
| --- | --- | --- |
| `.deb` | Electron Forge, `@electron-forge/maker-deb` | Built and started here: fuses read, window opened, installed-package check and upgrade test against the unpacked package, `desktop-file-validate`, `lintian --fail-on error`. |
| `.rpm` | `@electron-forge/maker-rpm` with `resources/linux/rpm.spec.ejs` (made only where `rpmbuild` is installed) | Built and checked here: `chrome-sandbox` SUID root, dependencies, desktop entry, installed-package check against the unpacked package. Installing it with `dnf` on Fedora runs on CI only. |
| `.tar.gz` with `run.sh`, `install.sh`, `uninstall.sh` | `scripts/make-linux-portable.js` | Built and run here: `run.sh --version` and the window, `install.sh` into a fresh home, install over a first copy, `uninstall.sh` keeps the profile, `--purge` deletes it. |
| AppImage | `scripts/make-linux-portable.js` with `APPIMAGE_RUNTIME=<runtime-x86_64>` | The image contents were built and run here; the final `.AppImage` file and its runtime download are made and checked on CI only. |

There is no ARM package and nothing for Windows or macOS.

## The sandbox

The `.deb` and `.rpm` install Chromium's `chrome-sandbox` helper SUID root and always keep the sandbox. An unpacked
app (the `.tar.gz`, the AppImage) cannot have a SUID helper, and Ubuntu 24.04 and later restrict the other way to
sandbox; there `run.sh` and the AppImage start the app with `--no-sandbox` and print why. Otherwise the app could
not start at all.

## The per-user install

`install.sh` installs to `~/.local/share/nodewise-studio`, a launcher in `~/.local/bin` and the menu entry and icons under
`~/.local/share`. It refuses to overwrite a launcher it did not make, refuses while the app is running, and replaces
an old copy in one step. A copy of version 0.9 that its `install.sh` put in the home folder under the app's old
name is removed with that copy's own `uninstall.sh` (its settings stay, for the app to take over); while that copy
runs, it stays and `install.sh` says so. `uninstall.sh` removes only what `install.sh` made and keeps the profile; `--purge` deletes
the profile too.

## What goes into a package

Only what runs: `dist/` (main, preload, the renderer bundle, the notices, the bundled Help), the runtime
`node_modules` of main, `package.json` and the window icon (`packagerConfig.ignore` in `forge.config.js`). Of
`better-sqlite3` only the Linux x64 module ships. The fuses (`@electron-forge/plugin-fuses`) switch off running as
Node, `NODE_OPTIONS`, the inspector arguments and loading the app from outside `app.asar`; `scripts/check-fuses.js`
reads them back from every built binary. The copyright file of both packages is the app's licence followed by the
notices of everything that ships.

## Commands

```bash
xvfb-run -a npm run package:linux   # build, make every format, check them
npm run make:linux                  # .deb (and .rpm where rpmbuild exists), then the tar.gz (and the AppImage)
npm run smoke:linux                 # the checks of the made packages
node scripts/check-fuses.js <exe>   # the fuses of a binary
node scripts/make-sbom.js out.cdx.json
SMOKE_PACKAGE=deb node scripts/smoke-installed-package.js check
```

The files appear in `out/make/deb/x64/`, `out/make/rpm/x64/` and `out/make/portable/`. Tools: `fakeroot` and `dpkg`
for the `.deb`, `rpm` for the `.rpm`, `squashfs-tools` and the AppImage type 2 runtime for the AppImage,
`desktop-file-utils`, `lintian` and `shellcheck` for the checks. [Building from source](Building-From-Source.md)

## See also

- [For developers](README.md)
- [Releasing](Releasing.md)
- [Installing](../start/Installing.md)
