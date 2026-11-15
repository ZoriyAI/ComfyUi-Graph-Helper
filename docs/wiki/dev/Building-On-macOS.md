[Русский](Building-On-macOS.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Building and running on macOS

The manual way behind `install-macos.sh`: what the script does, step by step, for a developer who wants to build, run
and change the app on a Mac. To just install the app, use the script:
[Installing on macOS](../start/Installing-On-macOS.md). The script is new in 1.0.0 and not tested yet on real Macs;
when it fails, these steps are the fallback.

## What to install

- **Node.js 22**, the version in `.nvmrc` (from nodejs.org, Homebrew, or nvm: `nvm install && nvm use`).
- **Git**, only to clone the repository: it comes with the Xcode Command Line Tools (`xcode-select --install`) or from
  Homebrew. `npm ci` needs no Git: every package comes from the npm registry.
- **No compiler for the app itself.** The database module, `better-sqlite3` 13, ships ready N-API files for Apple
  silicon and Intel (`darwin-arm64.node`, `darwin-x64.node`), so nothing is compiled.

## Get the source

```bash
git clone https://github.com/ZoriyAI/nodewise-studio.git nodewise-studio
cd nodewise-studio
npm ci
```

## Build and start

```bash
npm run build
npm start          # builds, then opens the app
npm run dev        # Vite with live reload, and Electron
```

## The .app, as the script makes it

```bash
npm run build
npx electron-forge package --platform darwin --arch arm64   # x64 on an Intel Mac
```

The bundle is `out/NodeWise Studio-darwin-arm64/NodeWise Studio.app`; its program is `Contents/MacOS/nodewise-studio`,
its bundle id `com.electron.nodewise-studio`. `forge.config.js` keeps only the database module of the system it builds
for (`scripts/lib/forge-target.js`), gives the bundle its icon (`resources/icon.icns`, made from the icon PNGs by
`scripts/make-icon-containers.js`), files it under Education, and switches off the same Electron fuses as on Linux.
Setting the fuses breaks Electron's signature; on Apple silicon the fuses plugin signs the binary ad hoc again.
A package made for Intel on a Linux machine has the right name, icon, database module and fuses; this was checked
here. There is no `.dmg`, no Developer ID signature and no notarization.

The script then copies the bundle with `ditto` beside `~/Applications/NodeWise Studio.app`, signs the copy ad hoc
(`codesign --force --deep --sign -`), clears the quarantine mark, verifies the signature, swaps the copy in and runs
`node scripts/smoke-installed-app.js --app <bundle>/Contents/MacOS/nodewise-studio`: `--version`, the window with a
throw-away profile and `--use-mock-keychain`, one instance.

To try the script on your own change without a release: `bash scripts/install/install-macos.sh --source .`.

## Where your data ends up

`~/Library/Application Support/nodewise-studio`. To keep a test profile apart:
`npx electron . --user-data-dir=/Users/you/nodewise-test` after `npm run build`. Keys are encrypted with a key Electron
keeps in your login Keychain, under "nodewise-studio Safe Storage".

## Update the source

```bash
git pull
npm ci
npm run build
```

## Remove everything

1. In the app: Settings ▸ Privacy ▸ Forget all keys and tokens.
2. Delete the project folder and, if you made one, the bundle under `out/`.
3. Delete `~/Library/Application Support/nodewise-studio`.
4. In Keychain Access, delete "nodewise-studio Safe Storage" (`install-macos.sh --uninstall --purge-data` does this
   with `security delete-generic-password`; not tried on a Mac yet).

## Known limits on this system

- **The menu bar.** The app's own menus (File, Edit, View and the rest) are drawn inside the window. The menu bar at
  the top of the screen has the standard app, Edit and Window menus (`src/main/platformMenu.ts`), so `Cmd+C`,
  `Cmd+V`, `Cmd+X`, `Cmd+A` work in text fields and `Cmd+Q` quits. That the canvas keeps its own `Cmd+C` and `Cmd+Z`
  next to that Edit menu is not tried on a Mac.
- **Closing the window** leaves the app running, as Mac apps do; clicking its Dock icon opens the window again. Not
  tried on a Mac.
- **Opening a file** by dropping it on the Dock icon or with "Open With" is not handled (macOS sends such files as an
  event the app does not listen to); open files from inside the app. The app registers no file types on any system.
- **Not signed by a publisher and not notarized.** The ad hoc signature names no publisher. After each upgrade the
  Keychain sees a new program and may ask once for access to "nodewise-studio Safe Storage"; not watched on a Mac yet.
- **Texts written for Linux.** The keychain setting, its hints and Troubleshooting speak of GNOME Keyring and KWallet;
  on macOS, Electron uses the Keychain. The app adds no `--password-store` switch on macOS.
- **The package checks** for Linux are Linux-only; the portable check is `scripts/smoke-installed-app.js`. Run the
  end-to-end tests with `npx playwright test`, without `xvfb-run`; that is not tried on a Mac.

## See also

- [For developers](README.md)
- [Installing on macOS](../start/Installing-On-macOS.md)
- [Building from source](Building-From-Source.md)
- [Building and running on Windows](Building-On-Windows.md)
