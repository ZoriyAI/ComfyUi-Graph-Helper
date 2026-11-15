Русская версия: [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md)

# Contributing

NodeWise Studio is an experimental desktop app that helps you learn ComfyUI and understand its graphs.
Ideas, wishes and questions are welcome in [Discussions](../../discussions); problems go to [Issues](../../issues).
Pull requests are welcome too. This page says what to do before you send one.

## Terms

By sending a contribution you agree that it is published under the same terms as the rest of the project: the
[LICENSE](LICENSE) (MIT with the Commons Clause condition). The source code is public, but the app may not be sold;
commercial use needs the written permission of the copyright holder ([COMMERCIAL.md](COMMERCIAL.md)). Everyone taking
part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- For a larger change, open a discussion or an issue first, so the idea can be agreed before the work.
- Read [Architecture](docs/wiki/dev/Architecture.md) and the page of the part you change (the
  [developer documentation](docs/wiki/dev/README.md) lists them).
- The app is developed and tested on Linux. Windows and macOS are not supported; you may try running it from source
  (untested):
  [Windows](docs/wiki/dev/Building-On-Windows.md), [macOS](docs/wiki/dev/Building-On-macOS.md).

## Set up

```bash
git clone https://github.com/ZoriyAI/nodewise-studio.git nodewise-studio && cd nodewise-studio
npm ci
npm run build
npm start
```

You need Node.js 22 (the version in `.nvmrc`) and, for the end-to-end tests, Xvfb. The full list is in
[Building from source](docs/wiki/dev/Building-From-Source.md).

`npm run dev` starts the window from the Vite dev server with DevTools. Note that a development run uses the same
profile folder as an installed app (`~/.config/nodewise-studio`), and like the installed app it takes over the folder
of version 0.9 when there is one; start it with `--user-data-dir=<a folder of your own>`
(`npx electron . --user-data-dir=/tmp/nodewise-dev` after `npm run build`) if you do not want a newer database
version in your real profile.

## Checks before a pull request

```bash
npm run type-check            # main, preload, shared and the window
npx vitest run                # unit and integration tests (about two minutes)
npm run build                 # the end-to-end tests run the built files
xvfb-run -a npx playwright test tests/e2e/<file>.test.ts --trace off   # the e2e files your change touches
node scripts/changelog.js --check
node scripts/public-tree-check.js
```

Run e2e files one at a time: each starts Electron, and a second window takes the focus from the first. The layout
walk (`tests/e2e/layout-walk.test.ts`) visits every screen at several window sizes and takes about twenty minutes a
size; run it when you change layout (see [Testing](docs/wiki/dev/Testing.md)). Every pull request runs the fast checks
(`.github/workflows/ci.yml`); the release workflow runs everything, the layout walks and the packages included.

## Texts and languages

- Every text on screen is in `src/shared/i18n/catalog.ts`, in English and Russian with the same keys. A test fails
  when a key is missing in one language or a template is not filled.
- Russian comes first in the owner's wishes: plain, short sentences, the words of the app's glossary («помощник»,
  «приложение», «версия графа»…), no service words on screen. See
  [Texts and languages](docs/wiki/dev/Texts-And-Languages.md) and [Code words](docs/wiki/dev/Code-Words.md).
- Documentation is in `docs/wiki`, every page in English (`Page.md`) and Russian (`Page.ru.md`). See
  [Writing wiki pages](docs/wiki/dev/Wiki-Style.md).

## Commits and pull requests

- One topic per commit, so a commit can be reverted alone. The first line: an area, a colon and what changed in
  plain words (`lessons: the LoRA lesson names the folder of the file`). The body says why.
- A pull request describes what changes for a person using the app and how you checked it. Fill in the template.
- Keep private things out: no personal addresses, e-mails, home folders or keys. `node scripts/public-tree-check.js`
  looks for them.

## A few things to know

- The package name `nodewise-studio` names the profile folder and the keyring entry of every installed copy. It
  changed once, for 1.0, and must not change again: each change costs people the keys they saved in the system
  password store ([Code words](docs/wiki/dev/Code-Words.md)).
- The app only reads ComfyUI. A change that would write, install, download or queue anything there will not be
  accepted ([ComfyUI is only read](docs/wiki/trust/Read-Only.md)).
- How this project is made: most of the code and texts were written by AI coding agents, directed and reviewed by
  the maintainer. Contributions from people are reviewed the same way.
