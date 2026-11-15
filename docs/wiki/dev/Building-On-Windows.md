[Русский](Building-On-Windows.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Building and running on Windows

These steps follow from how the project is built, but nobody has tried them on Windows yet: if something does not
work, please say what happened in the project's Issues.

## What to install

- **Git for Windows** (git-scm.com).
- **Node.js 22**, the version in `.nvmrc` (from nodejs.org, or with nvm-windows: `nvm install 22` and `nvm use 22`).
- **No compiler or Visual Studio build tools.** The database module, `better-sqlite3` 13, ships ready N-API files for
  Windows x64 and ARM64 (`win32-x64.node`, `win32-arm64.node`), so nothing is compiled.

## Get the source

In PowerShell or the Git Bash window:

```powershell
git clone <project address>.git cozygraph
cd cozygraph
npm ci
```
<!-- verify: technical rename; the project address is set in src/main/identity.ts -->

`npm ci` also downloads Electron for Windows.

## Build and start

```powershell
npm run build
npm start
```

`npm start` builds and opens the app. Use it rather than `npm run dev`: that script sets a variable the Unix way
(`NODE_ENV=development electron .`), which the Windows command shell does not understand.

## Where your data ends up

`C:\Users\you\AppData\Roaming\cozygraph` (`%APPDATA%\cozygraph`). <!-- verify: technical rename --> To keep a test
profile apart: `npx electron . --user-data-dir=C:\Users\you\cozygraph-test` after `npm run build`.

Keys are encrypted by Windows (DPAPI) through Electron.

## An app folder you can start without npm

Electron Forge, the packaging tool the project uses, can make a folder with `cozygraph.exe` and everything it needs:

```powershell
npm run build
npx electron-forge package
```

The folder appears under `out\`. Before you run this, open `forge.config.js`: one `ignore` rule keeps only the Linux
database file (`prebuilds/(?!linux-x64\.node$)`). Let the Windows file through as well (for example
`(?!(linux-x64|win32-x64)\.node$)`), or the packaged app cannot open its database. There is no Windows installer.
<!-- verify: technical rename (the executable name); the folder name on Windows; the missing .ico icon -->

## Update the source

```powershell
git pull
npm ci
npm run build
```

## Remove everything

1. In the app: Settings ▸ Privacy ▸ Forget all keys and tokens.
2. Delete the project folder (`cozygraph`) and, if you made one, the packaged folder under `out\`.
3. Delete `%APPDATA%\cozygraph`.

## Known limits on this system

- **Texts written for Linux.** The password store setting, its hints and Troubleshooting speak of GNOME Keyring and
  KWallet; on Windows, Electron uses DPAPI instead.
- **File permissions.** The app makes its files readable "by your user only" with Unix permissions. On Windows that
  does nothing, so the hints that promise it (for a key or token kept in the app folder) are not true there; the
  files get the usual permissions of your profile folder.
- **No taskbar identity and no installer.** The app sets no AppUserModelId and has no Squirrel or other installer
  handling, so pinning to the taskbar and notifications may behave oddly.
- **`--version` and `--help` print nothing**: a window app on Windows has no console attached.
- **The package checks are Linux-only**: `scripts/smoke-linux-package.js`, `scripts/smoke-installed-deb.js` and
  `xvfb-run` in the test commands. Run the end-to-end tests with `npx playwright test` without `xvfb-run`.
- Running as administrator is the Windows counterpart of running as root: do not.

## See also

- [For developers](README.md)
- [Building from source](Building-From-Source.md)
- [Building and running on macOS](Building-On-macOS.md)
