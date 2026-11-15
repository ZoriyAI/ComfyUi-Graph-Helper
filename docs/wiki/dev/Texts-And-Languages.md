[Русский](Texts-And-Languages.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Texts and languages

The app speaks English and Russian. Every word on screen comes from one catalog; nothing is fetched from the
internet.

## Where the words are

| What | Where |
| --- | --- |
| Interface texts | `src/shared/i18n/catalog.ts`: two objects, `en` and `ru`, with the same keys. Read with i18next and react-i18next (`src/renderer/i18n.ts`); main uses `createTranslator` from `src/shared/i18n/index.ts` for dialogs it shows itself. |
| Lesson texts | `src/shared/lessons/texts.en.ts`, `texts.ru.ts`. |
| Built-in knowledge | `src/shared/knowledge/coreKnowledge.en.ts`, `coreKnowledge.ru.ts`. |
| Errors from main | Main sends fixed English sentences; `ERROR_KEYS` in `src/shared/i18n/index.ts` maps each to a catalog key. |
| Help | `docs/wiki/`: `Page.md` in English, `Page.ru.md` in Russian. [Writing wiki pages](Wiki-Style.md) |
| Release notes | `docs/releases/vX.Y.Z.md` and `vX.Y.Z.ru.md`. |

## Rules for a text

- Write the sentence a person needs, in plain words, with the action named as the menu names it.
- A value goes in through `{{name}}`, never glued on in a component. Numbers through `{{count, number}}`.
- Plurals use the i18next suffixes `_one`, `_few`, `_many` and `_other`; both languages carry all four keys.
- A key, a password or a token never goes into a text.
- What the person wrote, workflow JSON, node class names, port types, model names and file names stay as they are,
  in any language.

## The language setting

- A new profile starts in Russian (`nonSecretDefaults.language = 'ru'` in `src/shared/config/schema.ts`). The person
  switches in Settings ▸ Appearance & Motion ▸ Language; the window changes at once, Save keeps it.
- The assistant answers in the interface language unless Settings ▸ Assistant ▸ Answer language says otherwise.
- File dialogs use the saved language.

## The checks

- `tests/unit/locale.test.ts`: both languages have the same keys; plurals and number grouping work; errors are
  redacted.
- `tests/unit/i18nUsage.test.ts`: every place that fills a template gives it all its values, so `{{done}}` never
  reaches the screen.
- `tests/e2e/locale.test.ts`: the window in both languages, with no foreign word or raw key on any tab.
- The layout walk ([Testing](Testing.md)) goes through every screen in both languages.

## Adding a language

1. Add the language code to `AppLanguage` and to the `language` enum in `src/shared/config/schema.ts`, with a
   migration if the stored value needs one ([The database and migrations](Database.md)).
2. Add a third object to `catalog.ts` with every key; `locale.test.ts` lists what is missing.
3. Add lesson texts and built-in knowledge in that language (`LessonLanguage`, `KNOWLEDGE_LANGUAGES`).
4. Add the option to the Language setting, and the language to the Help reader (`HelpLanguage` in
   `src/shared/contracts/about.ts`, `scripts/build-assets.js`).
5. Add `Page.<code>.md` for every wiki page and extend `tests/unit/wiki.test.ts`.
6. Run the layout walk in the new language: longer words find every place where a text does not fit.

## See also

- [For developers](README.md)
- [Writing wiki pages](Wiki-Style.md)
- [Code words and screen words](Code-Words.md)
