# ADR-001: English and Russian localization

**Date:** 2026-11-08
**Status:** Accepted for the desktop shell on `cursor/desktop-workspace-7b50`

## Requirement

The user required two languages, English and Русский, on 2026-11-08 17:45 Asia/Yekaterinburg: «Обязательно добавить локализацию и будет 2 Английский и русский».

## Inventory

The desktop app had no i18n dependency. Visible copy lived in the renderer components. Non-secret preferences already had one SQLite row in `settings`, migrated through schema version 5. File dialogs in the main process used fixed English filter names. Node is 22.23.4. React is 18.3.1. Electron is 45.

## Library

Official packages verified from the npm registry on this machine, matching the current i18next and react-i18next releases:

- `i18next@27.0.1` (MIT). The package targets modern Node; this environment is Node 22.
- `react-i18next@18.0.0` (MIT). Its peer dependency is `i18next >= 27` and `react >= 18`.

Resources are bundled in `src/shared/i18n/catalog.ts` and passed to `i18n.init`. There is no Locize project, no `i18next-http-backend`, and no language detector. Both languages work offline. `escapeValue` stays false because React already escapes text. Plural sentences use i18next count suffixes (`_one`, `_few`, `_many`, `_other`) and the built-in `{{count, number}}` formatter, so a count is not glued on in a component. `document.documentElement.lang` is `en` or `ru`. Clock display uses `Intl.DateTimeFormat` with `en-US` or `ru-RU`. i18next 27 types no longer accept a custom `interpolation.format` function; the built-in number formatter is the one these strings use.

## Language preference

- A profile with no settings row stays unwritten and uses Russian (`nonSecretDefaults.language = 'ru'`).
- Schema version 6 adds `settings.language TEXT NOT NULL DEFAULT 'en'`. An existing row therefore stays English. Other columns are unchanged.
- A save that omits `language` is parsed by the schema default and stored as Russian. The desktop UI always sends the current value.
- An unreadable settings row displays English and does not write until Save. The previous values cannot be recovered, so the screen does not switch that profile to Russian by itself.
- The language select is in Settings, after Motion, in Appearance & Motion. Changing it calls `i18n.changeLanguage` immediately. Save writes the SQLite row. Cancel or Escape restores the stored language.
- Option labels stay `English` and `Русский` in both locales.
- File dialog titles, button labels, and filter names come from the stored language. A live switch that has not been saved does not change the next dialog.

## What is not translated

User prompts, workflow JSON, node class ids, port names, port types, provider ids, model names, command names, schema keys, and raw external diagnostics stay as received. Known app errors map to one localized sentence. Unknown errors keep a localized summary plus the diagnostic with `sk-` and `Bearer` tokens redacted. The IPC error codes themselves stay the existing English strings.

React Flow still reports a move as `up`, `down`, `left`, or `right`. `moveAnnouncement` replaces that token with `graph.directionUp`, `graph.directionDown`, `graph.directionLeft`, or `graph.directionRight` before the localized sentence is built, so a Russian announcement does not keep the English direction word. Coordinate letters `x` and `y` stay as written.

## Tests

`tests/unit/locale.test.ts` covers key parity, plural sentences, locale number grouping, Cyrillic copy, error redaction (including a full `sk-` token with hyphens and underscores), the four localized move directions, dialog copy, the Russian default, the English migration of a version 5 row, and save/reopen. Existing English end-to-end tests call `tests/e2e/locale.ts` `useEnglish`, which writes `language: 'en'` through the same settings IPC and reloads. `tests/e2e/locale.test.ts` covers the Russian default, live switch, cancel, persistence across relaunch, validation copy, accessible names, long Russian toolbars at 1024 and 1280, the settings listbox Escape path, and the canvas delete guard. It also reads the visible text, `aria-label`, `title`, `placeholder`, and `aria-description` of the workspace, both dock tabs, every Settings tab, and the secret validation state, in Russian and in English, and rejects a foreign catalog value or a raw catalog key.
