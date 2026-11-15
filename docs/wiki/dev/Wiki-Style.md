[Русский](Wiki-Style.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Writing wiki pages

This wiki is the documentation of NodeWise Studio: for people who use the app and for people who change
its code. The app shows the same pages in Help, in the language of the interface.

## Where a page goes

| Folder | What it holds |
|---|---|
| `start/` | What the app is, getting ComfyUI and the app, the first hour, updating, removing. |
| `connect/` | Connecting the app to ComfyUI. |
| `interface/` | One page per part of the window. |
| `graph/` | Working with a graph: building, checking, saving, running in ComfyUI. |
| `assistant/` | Ask, Build, Learn, who answers, what is sent. |
| `lessons/` | One page per built-in lesson. |
| `concepts/` | ComfyUI ideas for a newcomer, one idea per page. |
| `reference/` | Formats, settings, shortcuts, messages, glossary, limits. |
| `trust/` | Privacy, content rules, security, licences, accessibility. |
| `dev/` | Code, tests, builds, releases. |

## The shape of a page

1. First line: a link to the same page in the other language: `[Русский](Page-Name.ru.md)` on an English page,
   `[English](Page-Name.md)` on a Russian page.
2. Second line: a breadcrumb: `[Home](../Home.md) › [Folder title](README.md)`.
3. One `#` title, then a short paragraph that says what the page is about.
4. The body: `##` sections. One topic per page. If a section grows into its own topic, give it its own page and link
   to it.
5. Last section: `## See also` (`## См. также` on Russian pages) with links to related pages.

File names: `Page-Name.md` for English, `Page-Name.ru.md` for Russian, words joined by hyphens, each starting with
a capital letter. Every folder has `README.md` and `README.ru.md` that list every page with one line each.

## Language

- Plain words and short sentences. Write for a person who has never used ComfyUI.
- Use the words the app shows, exactly as it shows them: «помощник», «приложение», «версия графа», «Сочетания
  клавиш», «вход» and «выход»; in English "assistant", "version of the graph". Name a menu item as a path:
  «Файл ▸ Сохранить проект», "File ▸ Save project".
- No long dashes as a stylistic device. No private facts: no personal servers, addresses, e-mails or names.
- The Russian page says the same as the English page. Neither is a summary of the other.

## Links

- Only relative links between pages: `../graph/Subgraphs.md`, never an address of the repository.
- A Russian page links to Russian pages (`.ru.md`), an English page to English pages.
- Links to the app's code from `dev/` pages are relative too: `../../../src/main/commands/commit.ts`.

## Truth

Every sentence must be true on the current build. Check it against the code or the running app; when they disagree
with a report or an older page, the code wins.

- **While you work**, a sentence you cannot confirm yet gets an HTML comment right after it: the opening `<!--`, then
  `verify:` and what to check, then `-->`. A skeleton page that nobody has written yet carries the same kind of
  comment with `skeleton:`.
- **Before a release** no such comment may stay. A sentence that cannot be checked here (a real ComfyUI install,
  Windows, macOS, a keychain such as KWallet, a real screen reader) stays, says plainly in the text itself that it
  is not tried yet, and goes on the list of things not yet tried in [Releasing](Releasing.md).

## The test

`tests/unit/wiki.test.ts` runs with the other unit tests (`npx vitest run tests/unit/wiki.test.ts`). It checks that:

- every page exists in both languages and the first lines link to each other;
- the second line leads back to Home;
- every relative link resolves to a file;
- every folder index lists every page of the folder.

Before a release, run it with `WIKI_STRICT=1 npx vitest run tests/unit/wiki.test.ts`: then it also fails while any
`verify` or `skeleton` comment is left.

## In the app

The app bundles `docs/wiki` and opens it in Help. A message or a hint in the app can link to a page by a stable id:
see [Context help ids](Context-Help.md).

## See also

- [For developers](README.md)
- [Context help ids](Context-Help.md)
- [Texts and languages](Texts-And-Languages.md)
- [Contributing](Contributing.md)
