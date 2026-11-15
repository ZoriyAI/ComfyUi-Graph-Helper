[Русский](Adding-A-Setting.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Adding a setting

Settings are of two kinds. Almost every new one is a **preference**: one field in a validated JSON object stored in
`settings.preferences_json`. No migration is needed for it.

## A preference

1. **The schema.** Add the field to its section in `preferencesSchema`, `src/shared/config/preferences.ts`, with a
   default: `z.boolean().default(false)`, an enum, or `int(RANGE)` with a `{ min, max, default }` constant next to the
   others. A stored row without the field reads the default, so older profiles keep working.
2. **The control.** Add it to the section component in `src/renderer/components/settings/sections/`, for example a
   `Switch` with `patchSection(setPrefs, 'assistant', { yourField: next })`. Use the design system's controls
   (`Switch`, `NumberField`, `SelectField`, `RadioCards`).
3. **The texts.** The label and, if needed, a hint under `preferences.*` in `src/shared/i18n/catalog.ts`, in both
   languages. Say what changes for the person, not how the code works.
4. **The use.** Read it where it matters: in main through `readPreferences(getDatabase())`, in the renderer through
   `src/renderer/state/preferencesState.ts`.
5. **When it applies.** Most settings apply on Save; if it must apply at once, say so in the hint.
6. **Tests.** `tests/unit/preferences.test.ts` (default, range, a stored row without the field) and
   `tests/unit/preferencesRenderer.test.ts` if the window reads it. `tests/e2e/preferences.test.ts` covers the window.
7. **The wiki.** The setting's line in [Every setting](../reference/Settings-Reference.md) and on the page of its
   section under `docs/wiki/interface/Settings-*.md`, both languages. If it sends anything off the computer, also
   [Privacy](../trust/Privacy.md).

## A column on the settings row

Only for a value that must be read before the preferences (for example the language or an address checked with a
special rule). It needs a migration ([The database and migrations](Database.md)), a field in
`nonSecretSettingsSchema` (`src/shared/config/schema.ts`) and its default in `nonSecretDefaults`.

## Never a secret

A key, a password or a token is never a setting. The settings schema refuses values that look like one ("Settings
cannot hold a key or a password"). Secrets go through the key and token stores in `src/main/settings/`.

## See also

- [For developers](README.md)
- [Every setting](../reference/Settings-Reference.md)
- [Texts and languages](Texts-And-Languages.md)
