[Русский](Context-Help.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Context help ids

A message, a hint or a menu item in the app can open a page of this wiki in the Help reader. It does so by a stable
**id**, never by a file name: when a page moves, only one map changes.

## The map

`HELP_IDS` in `src/shared/help/contextHelp.ts` maps each id to a page, written as `folder/Page-Name` (no language,
no extension). The reader opens `docs/wiki/<page>.md`, or `<page>.ru.md` when the interface is in Russian.

| Id | Page |
| --- | --- |
| `home` | `Home` |
| `quick-start` | `start/Quick-Start` |
| `installing` | `start/Installing` |
| `faq` | `start/FAQ` |
| `connecting` | `connect/Connecting` |
| `connection-problems` | `connect/Connection-Problems` |
| `running-in-comfyui` | `graph/Running-In-ComfyUI` |
| `comfyui-errors` | `graph/ComfyUI-Errors` |
| `history-and-undo` | `graph/History-And-Undo` |
| `checking-a-graph` | `graph/Checking-A-Graph` |
| `choosing-who-answers` | `assistant/Choosing-Who-Answers` |
| `context-window` | `assistant/Context-Window` |
| `what-is-sent` | `assistant/What-Is-Sent` |
| `lessons` | `lessons/README` |
| `glossary` | `reference/Glossary` |
| `troubleshooting` | `reference/Troubleshooting` |
| `messages` | `reference/Messages` |
| `shortcuts` | `reference/Shortcuts` |
| `data-folder` | `reference/Data-Folder` |
| `known-limits` | `reference/Known-Limits` |
| `privacy` | `trust/Privacy` |
| `security` | `trust/Security` |
| `licence` | `trust/Licence` |

Help ▸ What is new is not a wiki page: it opens `@whats-new`, the notes of the running version from
`docs/releases/`.

## Linking a new place of the app

1. Add an id to `HELP_IDS`: lower-case words joined by hyphens, pointing at an existing page.
2. In the renderer, call `openHelp('<id>')` from `src/renderer/services/help.ts`, for example from a button in a
   message or a menu command.
3. Run `npx vitest run tests/unit/aboutHelp.test.ts`: it fails when an id points at a page that does not exist in
   both languages.

## Moving or renaming a page

1. Move both language files and fix the links to them (`tests/unit/wiki.test.ts` lists broken ones).
2. Change the page in `HELP_IDS` for every id that pointed at it. The app's code does not change.

## How the reader finds pages

`npm run build` copies `docs/wiki` into `dist/help/wiki` and writes two files next to it
(`scripts/build-assets.js`): `wiki-index.json` (the folders and their pages in the order of the indexes, with titles
in both languages) and `wiki-search.json` (the plain text of every page, for search). Main serves them on
`help:tree`, `help:page` and `help:search` (`src/main/ipc/aboutIpc.ts`). Relative links between pages work in the
reader; a link that leaves the wiki (to a file of the repository, such as `LICENSE`) is not followed there.

## See also

- [For developers](README.md)
- [Writing wiki pages](Wiki-Style.md)
- [IPC between window and main](IPC.md)
