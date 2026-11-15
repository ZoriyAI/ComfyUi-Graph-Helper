[Русский](Database.ru.md)
[Home](../Home.md) › [For developers](README.md)

# The database and migrations

All state lives in one SQLite file, `comfyui-desktop.db` in the [data folder](../reference/Data-Folder.md), opened
by main with `better-sqlite3` (`src/main/database.ts`). The window never opens it.

## Tables

| Table | Holds |
| --- | --- |
| `settings` | One row: the non-secret settings (provider, model, addresses, language, motion) and `preferences_json`, the validated preferences. |
| `secret_records` | Saved keys and tokens, encrypted by the system password store. |
| `projects` | Projects and the version each one shows (`current_revision_id`). |
| `graph_revisions` | Every version of every graph: nodes, links, the ComfyUI document, components, title and notes, and who made it. |
| `applied_commands` | Every command applied: its `actionId`, actor, run, payload and result. |
| `runs` | The assistant's runs and their state. |
| `proposals` | The assistant's drafts. |
| `explanations` | Explanations of node types, models, links and objects of a graph, with their source. |
| `chat_messages` | The chat, while Keep chat history in the project is on. |
| `node_catalog`, `node_packs`, `model_catalog` | What was read from ComfyUI, with model metadata and web lookups. |
| `sync_state` | The state of the sync as keys and values: the last sync, auto-sync and its interval. |
| `schema_migrations` | Which schema versions were applied, and when. |

## Opening

`openDatabase` in `src/main/database.ts`:

1. A file whose schema version is newer than this app knows is refused **before anything is written** ("Your data was
   saved by a newer version…").
2. The journal is WAL; `secure_delete` is on, so a forgotten key is overwritten, not left in free pages.
3. Before an upgrade, the file is copied to `comfyui-desktop.db.before-v<N>.bak` (only the newest copy is kept)
   (`src/main/settings/databaseSafety.ts`).
4. `migrate` brings the schema to `SCHEMA_VERSION` (`src/main/settings/migrate.ts`).
5. A failure is classified (damaged, newer, read-only, full, busy) and shown in words; a damaged file can be renamed
   to `comfyui-desktop.db.damaged-<date>` and the app starts with empty data.

## Adding a migration

1. Raise `SCHEMA_VERSION` in `src/main/settings/migrate.ts` and describe the new version in the comment above it, in
   one sentence: what it adds and why.
2. Write `applyVersionN(db)`. Make it safe to run on any database of the previous version: check with
   `columnNames` / `tableNames` before `ALTER TABLE`, use `CREATE … IF NOT EXISTS`, give new columns a default.
3. Add the step to `migrate`, in its own transaction that also writes the `schema_migrations` row, like the steps
   before it.
4. Never change an older `applyVersion…`: databases out there already went through it.
5. Test it in `tests/unit/settingsMigration.test.ts`: a database at the previous version with real rows upgrades,
   keeps its rows, and a failure before the version stamp leaves it as it was.

A newer database is never opened by an older app, so plan a change that people can live with when they go back:
the app refuses and says so; their data stays untouched.

## See also

- [For developers](README.md)
- [The command engine and history](Command-Engine.md)
- [The data folder](../reference/Data-Folder.md)
