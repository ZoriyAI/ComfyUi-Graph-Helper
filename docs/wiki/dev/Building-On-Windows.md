[Русский](Building-On-Windows.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Building and running on Windows

The manual way behind `install-windows.ps1`: what the script does, step by step, for a developer who wants to build,
run and change the app on Windows. To just install the app, use the script:
[Installing on Windows](../start/Installing-On-Windows.md). The script is checked on GitHub's Windows machines on
every change, not yet on a range of real computers; when it fails, these steps are the fallback.

## What to install

- **Node.js 22**, the version in `.nvmrc` (from nodejs.org, or with nvm-windows: `nvm install 22` and `nvm use 22`).
- **Git for Windows** (git-scm.com), only to clone the repository. `npm ci` needs no Git: every package comes from
  the npm registry (`tests/unit/installScripts.test.ts` keeps it so).
- **No compiler or Visual Studio build tools.** The database module, `better-sqlite3` 13, ships ready N-API files for
  Windows x64 and ARM64 (`win32-x64.node`, `win32-arm64.node`), so nothing is compiled.

## Get the source

In PowerShell or the Git Bash window:

```powershell
git clone https://github.com/ZoriyAI/nodewise-studio.git nodewise-studio
cd nodewise-studio
npm ci
```

## Build and start

```powershell
npm run build
npm start
```

`npm start` builds and opens the app. Use it rather than `npm run dev`: that script sets a variable the Unix way
(`NODE_ENV=development electron .`), which the Windows command shell does not understand.

## The app folder, as the script makes it

```powershell
npm run build
npx electron-forge package --platform win32 --arch x64
```

The folder is `out\NodeWise Studio-win32-x64`, with `nodewise-studio.exe`. `forge.config.js` keeps only the database
module of the system it builds for (`scripts/lib/forge-target.js`), gives the program its icon
(`resources/icon.ico`, made from the icon PNGs by `scripts/make-icon-containers.js`) and its name in Task Manager,
and switches off the same Electron fuses as on Linux. There is no installer package and no code signing.

The script then copies that folder to `%LOCALAPPDATA%\Programs\NodeWise Studio`, adds a Start menu shortcut and an
entry under `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\nodewise-studio`, and runs
`node scripts\smoke-installed-app.js --app <exe>`: `--version`, the window with a throw-away profile, one instance.

To try the script on your own change without a release: `install-windows.ps1 -Source .` builds from your folder.

## Where your data ends up

`%APPDATA%\nodewise-studio`. To keep a test profile apart: `npx electron . --user-data-dir=C:\Users\you\nodewise-test`
after `npm run build`. Keys are encrypted by Windows (DPAPI) through Electron.

## Update the source

```powershell
git pull
npm ci
npm run build
```

## Remove everything

1. In the app: Settings ▸ Privacy ▸ Forget all keys and tokens.
2. Delete the project folder and, if you made one, the packaged folder under `out\`.
3. Delete `%APPDATA%\nodewise-studio`.

An app installed by the script is removed with `install-windows.ps1 -Uninstall` or from Installed apps.

## Known limits on this system

- **Texts written for Linux.** The keychain setting, its hints and Troubleshooting speak of GNOME Keyring and
  KWallet; on Windows, Electron uses DPAPI instead. The app adds no `--password-store` switch on Windows.
- **File permissions.** The app makes its files readable "by your user only" with Unix permissions. On Windows that
  does nothing, so the hints that promise it (for a key or token kept in the app folder) are not true there; the
  files get the usual permissions of your profile folder.
- **No taskbar identity.** The app sets no AppUserModelId, so pinning to the taskbar and notifications may behave
  oddly. Not tried.
- **`--version` and `--help`** are written in one direct write to the program's output. Read through a pipe (as the
  script and `smoke-installed-app.js` do) they arrive; typed in a console window, whether they appear is not tried.
- **The package checks** for Linux (`smoke-linux-package.js`, `smoke-installed-package.js`) are Linux-only; the
  portable check is `scripts/smoke-installed-app.js`. Run the end-to-end tests with `npx playwright test`, without
  `xvfb-run`; that is not tried on Windows.

## See also

- [For developers](README.md)
- [Installing on Windows](../start/Installing-On-Windows.md)
- [Building from source](Building-From-Source.md)
- [Building and running on macOS](Building-On-macOS.md)
