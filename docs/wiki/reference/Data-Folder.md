[Русский](Data-Folder.ru.md)
[Home](../Home.md) › [Reference](README.md)

# The data folder

Every file the app keeps, where it lies and why. Project files and workflows are not here: they are wherever you
saved them.

## Where it is

- Linux: `~/.config/cozygraph` <!-- verify: technical rename -->
- Another folder, if you start the app with `--user-data-dir=<folder>` ([The command line](Command-Line.md)).
- Windows and macOS (builds from source): see [Windows](../dev/Building-On-Windows.md) and
  [macOS](../dev/Building-On-macOS.md).

Help ▸ About ▸ Open data folder opens it. On Linux the folder is made readable by your user only.

## What is inside

| File or folder | What it holds | Size |
| --- | --- | --- |
| `comfyui-desktop.db` (with `-wal` and `-shm` next to it) | The database: settings, the catalog read from ComfyUI, the graph and its history, the chats, saved keys encrypted by the system password store. | Grows with history; the oldest versions are pruned. |
| `comfyui-desktop.db.before-v<N>.bak` | A copy of the database made before its schema was upgraded to version N. Only the newest is kept. | As big as the database. |
| `comfyui-desktop.db.damaged-<date>` | A damaged database the app put aside when you chose Start with empty data. Never deleted by the app. | |
| `logs/main.log`, `main.log.1`, `main.log.2` | The log: what the app did and the errors it met. Keys and tokens are hidden, the home folder is written as `~`. | 5 MB per file, three files. |
| `logs/model/` | The conversation log with the model, one file per answer, while Settings ▸ Privacy ▸ Keep a log of the conversation with the model is on. | At most 300 files and 150 MB; the oldest go first. |
| `model-previews/` | Pictures of models fetched for model cards. | At most 3000 files and 512 MB; the oldest go first. |
| `window-state.json` | The window's size and place. | Tiny. |
| `password-store.json` | Which password store to use, if you chose one in Settings ▸ Privacy. Not a secret. | Tiny. |
| `model-key.json` | A model key kept unencrypted, only if you chose that place for it. Readable by your user only. | Tiny. |
| `mcp-token.json` | A server access token kept unencrypted, only if you chose that place for it. Readable by your user only. | Tiny. |

Chromium, which draws the window, keeps a few folders of its own here too (caches, local storage). They hold nothing
the app needs; they are safe to delete while the app is closed.

## Clearing it

- Forget keys only: Settings ▸ Privacy ▸ Forget all keys and tokens.
- Start over: close the app and delete the whole folder. Saved keys in the system password store stay until you
  forget them first: see [Removing](../start/Removing.md).
- Move it: close the app and copy the folder; start the app with `--user-data-dir` pointing at the copy.

## See also

- [Reference](README.md)
- [Privacy](../trust/Privacy.md)
- [File formats](File-Formats.md)
- [Troubleshooting](Troubleshooting.md)
