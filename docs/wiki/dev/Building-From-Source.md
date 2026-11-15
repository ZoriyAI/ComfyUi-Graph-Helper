[Русский](Building-From-Source.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Building from source

Step by step on Linux (x64), the system the project is built and tested on. Windows and macOS have their own pages:
[Windows](Building-On-Windows.md), [macOS](Building-On-macOS.md).

## What you need

- **Git.**
- **Node.js 22** (the version in `.nvmrc`), with npm. With nvm: `nvm install && nvm use` in the project folder.
- **No compiler.** `better-sqlite3` 13 ships a ready N-API module for Linux x64, which works in both Node and
  Electron, so nothing is rebuilt.
- For the window on a server without a desktop, and for the end-to-end tests: `xvfb`.
- For the `.deb` package: `dpkg` and `fakeroot`; for its checks `desktop-file-utils` and `lintian`.

On Debian or Ubuntu, the libraries Electron needs and the package tools, as CI installs them:

```bash
sudo apt-get install -y --no-install-recommends fakeroot dpkg xvfb libnss3 libatk-bridge2.0-0 libgtk-3-0 \
  libgbm1 libasound2t64 libxss1 desktop-file-utils lintian
```

(On older releases the sound library is `libasound2`.)

## Get the source and install

```bash
git clone <project address>.git nodewise-studio
cd nodewise-studio
npm ci
```

## Build and run

```bash
npm run build      # dist/main, dist/renderer, dist/notices, dist/help
npm start          # builds, then opens the app
npm run dev        # Vite with live reload, and Electron
```

`npm start` and `npm run dev` use the same data folder as an installed app. To keep a test profile apart, pass
`--user-data-dir`: `npx electron . --user-data-dir=/tmp/nodewise-test` after `npm run build`.

## Check your change

```bash
npm test
npm run type-check
xvfb-run -a npx playwright test --trace off --grep-invert "live-local|layout-walk"
```

More: [Testing](Testing.md).

## Make the package

```bash
npm run package:linux
```

Builds `dist/`, makes the `.deb` in `out/make/deb/x64/` through Electron Forge and runs
`scripts/smoke-linux-package.js` on it. Install it with `sudo apt install ./out/make/deb/x64/<file>.deb`.
More: [Package formats](Package-Formats.md).

## Keep it up to date

```bash
git pull
npm ci
npm run build
```

## See also

- [For developers](README.md)
- [Package formats](Package-Formats.md)
- [Contributing](Contributing.md)
