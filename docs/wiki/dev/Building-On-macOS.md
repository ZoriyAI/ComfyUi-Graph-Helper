[Русский](Building-On-macOS.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Building and running on macOS

These steps follow from how the project is built, but nobody has tried them on macOS yet: if something does not work,
please say what happened in the project's Issues.

## What to install

- **Git**: comes with the Xcode Command Line Tools (`xcode-select --install`), or from Homebrew (`brew install git`).
- **Node.js 22**, the version in `.nvmrc` (from nodejs.org, Homebrew, or nvm: `nvm install && nvm use`).
- **No compiler for the app itself.** The database module, `better-sqlite3` 13, ships ready N-API files for Apple
  Silicon and Intel (`darwin-arm64.node`, `darwin-x64.node`), so nothing is compiled.

## Get the source

```bash
git clone <project address>.git nodewise-studio
cd nodewise-studio
npm ci
```

`npm ci` also downloads Electron for your Mac.

## Build and start

```bash
npm run build
npm start          # builds, then opens the app
npm run dev        # Vite with live reload, and Electron
```

## Where your data ends up

`~/Library/Application Support/nodewise-studio` (for example `/Users/you/Library/Application Support/nodewise-studio`).
To keep a test profile apart: `npx electron . --user-data-dir=/Users/you/nodewise-test`
after `npm run build`.

Keys are encrypted with a key Electron keeps in your login Keychain.

## An app you can start without npm

Electron Forge, the packaging tool the project uses, can make an `.app` bundle:

```bash
npm run build
npx electron-forge package
```

The bundle appears under `out/`. Before you run this, open `forge.config.js`: one `ignore` rule keeps only the Linux
database file (`prebuilds/(?!linux-x64\.node$)`). Let your Mac's file through as well (for example
`(?!(linux-x64|darwin-arm64)\.node$)` on Apple Silicon), or the packaged app cannot open its database. The bundle is
not signed: macOS asks before opening it the first time (Control-click ▸ Open).
<!-- verify: the bundle name; the missing .icns icon -->

## Update the source

```bash
git pull
npm ci
npm run build
```

## Remove everything

1. In the app: Settings ▸ Privacy ▸ Forget all keys and tokens.
2. Delete the project folder (`nodewise-studio`) and, if you made one, the bundle under `out/`.
3. Delete `~/Library/Application Support/nodewise-studio`.
4. In Keychain Access, delete the item that ends with "Safe Storage" and carries the app's name.
   <!-- verify: the Keychain item name on macOS -->

## Known limits on this system

- **No macOS app menu.** The app draws its menu bar inside the window and sets no native menu. Without a native Edit
  menu, `Cmd+C`, `Cmd+V`, `Cmd+X` and `Cmd+A` may not work in text fields, and there is no `Cmd+Q`, `Cmd+H`, `Cmd+M` or
  `Cmd+W`. Use File ▸ Exit to quit.
- **Not signed and not notarized.** There is no code signing, no notarization and no `.dmg`.
- **Texts written for Linux.** The password store setting, its hints and Troubleshooting speak of GNOME Keyring and
  KWallet; on macOS, Electron uses the Keychain.
- **The package checks are Linux-only**: `scripts/smoke-linux-package.js`, `scripts/smoke-installed-deb.js` and
  `xvfb-run` in the test commands. Run the end-to-end tests with `npx playwright test` without `xvfb-run`.

## See also

- [For developers](README.md)
- [Building from source](Building-From-Source.md)
- [Building and running on Windows](Building-On-Windows.md)
