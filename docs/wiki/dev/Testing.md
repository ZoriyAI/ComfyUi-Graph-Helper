[Русский](Testing.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Testing

Four kinds of tests, from fast to slow. All of them run on Linux; the end-to-end tests need a display or Xvfb.

## Unit and integration tests

```bash
npm test                         # vitest: tests/unit, tests/integration, tests/corpus
npx vitest run tests/unit/wiki.test.ts   # one file
```

- `tests/unit`: one module at a time: the command engine, the workflow codec, the read-only gate, migrations,
  texts, lessons, the wiki.
- `tests/integration`: several modules together with a real SQLite database: a chat that builds a graph, a run
  that meets a person's edit, a sync against a fake MCP server (`tests/fixtures/mcp`).
- A scripted model (`src/main/testLLMTransport.ts`) answers instead of a real one; nothing goes to the network.
- A unit test counts as hung after 30 seconds (`testTimeout` in `vitest.config.ts`). Under heavy load a few slow
  tests can still hit it; run them alone or with `--testTimeout=60000`.
- Time budgets: `npm test` only records how long the large-catalog test takes, because a fixed limit on a busy machine
  fails now and then. `npm run test:perf` (`PERF_BUDGETS=1`) runs the same test with its limits.

```bash
npm run test:perf                # the time budgets of tests/unit/largeCatalog.test.ts
```

## Type check and lint

```bash
npm run type-check               # main and renderer
npm run type-check:tests         # the tests too (tsconfig.tests.json)
npm run lint                     # ESLint over src, tests, scripts and forge.config.js (eslint.config.mjs)
```

## End-to-end tests

They start the built app in Electron through Playwright. A spec starts the app through `launchApp()` of
`tests/e2e/support/app.ts`, never on its own: it gives the app a temporary profile with `--user-data-dir` (removed on
close; `NODEWISE_KEEP_PROFILES=1` keeps it for a look), so a spec never reads or writes the profile of the person
running it. `npm run build` comes first, or the specs test old code.

```bash
npm run build
xvfb-run -a npx playwright test --trace off --grep-invert "live-local|layout-walk"   # everything but the walk
xvfb-run -a npx playwright test tests/e2e/about-help.test.ts --trace off              # one file
```

`live-local` tests talk to a real model server on this computer (`127.0.0.1:18080`) and are skipped when nothing
listens there.

## The layout walk

`tests/e2e/layout-walk.test.ts` opens every screen at several window sizes and looks for anything that spills out of
its box, is cut off, leaves the window, overlaps its neighbour or is squeezed unreadable, and reads every text for an
unfilled placeholder, "undefined" or a raw key. It also checks that a description card stands at its node with its
node's width at any zoom. Run it on its own: it keeps menus open for a long time, and a second app window would close
them.

```bash
xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off
LAYOUT_FULL=1 xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off      # all sizes
LAYOUT_LANG=en …           # in English (default: Russian, the longer texts)
LAYOUT_TEXT=wide …         # text 4 % wider
LAYOUT_DPR=1.5 …           # screen scale 150 %
LAYOUT_FONTS=hinted …      # hinted fonts
LAYOUT_SIZES=800x560,1400x860 …   # only these window sizes
LAYOUT_ONLY=canvas,helper …       # only these parts
LAYOUT_OUT=<folder> …             # keep the report and the pictures
```

`tests/e2e/layout-audit.test.ts` checks the walk itself on a page broken on purpose and on a correct one.
`tests/e2e/node-size.test.ts` draws every node of the catalog and compares its height with the height the app
computed in advance (new nodes are placed by it).

## The workflow corpus

`tests/corpus/workflowRoundTrip.test.ts` opens every ComfyUI workflow in the folders you name, saves it back and
compares, then edits each one the way the canvas does and checks the saved file carries exactly that edit:

```bash
WORKFLOW_CORPUS=/path/a:/path/b npx vitest run tests/corpus
```

Without `WORKFLOW_CORPUS` it is skipped.

## The wiki

`tests/unit/wiki.test.ts` checks every page has both languages, the language link on line 1 and the breadcrumb on
line 2, that every relative link resolves, that every folder index lists its pages, and that every lesson has a page.
`WIKI_STRICT=1 npx vitest run tests/unit/wiki.test.ts` also fails while a `verify` or `skeleton` comment is left
(an HTML comment that starts with one of these words and a colon), before a release.

## What CI runs

- `.github/workflows/ci.yml`, on every pull request and every push to the default branch: the changelog check,
  `node scripts/public-tree-check.js`, `npm ci`, the type check, the unit and integration tests and the build; a
  second job builds the app and runs a short list of end-to-end journeys (editing, files, privacy, the check and the
  lesson list) under Xvfb. It has read-only rights and no secrets.
- `.github/workflows/release.yml`, for tags, by hand and weekly: the end-to-end tests, the layout walks, the four
  packages and their checks, the upgrade test, then the release. [Releasing](Releasing.md)

## See also

- [For developers](README.md)
- [Building from source](Building-From-Source.md)
- [Contributing](Contributing.md)
