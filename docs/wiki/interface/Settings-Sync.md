[Русский](Settings-Sync.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Sync

"The library comes from ComfyUI directly or through optional read-only MCP tools. Auto-sync and the interval apply at once; the rest saves with Save settings." This section shows how the last sync went, runs one now, sets automatic sync, and says how model files are read.

## What it shows

The state and a summary: "Up to date · Node types: 812, packs: 41, models: 331 (120 with metadata). Last sync: 14:05." Warnings of the last sync, a paused reading ("Metadata reading is paused at 120 / 331. It continues with the next sync, or press Sync now.") and the last error.

## Fields and buttons

| Field | Default | What it does |
|---|---|---|
| **Sync automatically** | off | Reads ComfyUI again on a timer. It works with the ComfyUI address or with an MCP server. Without an address: "Automatic sync can be switched on once the ComfyUI address is set in Connection." If the last sync did not finish, automatic sync waits until you press **Sync now**. |
| **Interval, minutes** | 30 | From 5 minutes to a day. A number out of range is corrected: "The interval must be from 5 minutes to a day, so it is now 5 min." |
| **Sync now** | | Reads ComfyUI now. |
| **Pause metadata reading** | | Appears while model files are read. |
| **Read model metadata from** | **Loader folders (checkpoints, LoRAs, VAE…)** | or **All model folders** |
| **Models per batch** | 50 (10 to 1000) | Metadata is read in batches of this size, one after another, until every file is read. |
| **Pause between batches, ms** | 1500 (0 to 10 000) | Gives the MCP server and ComfyUI a breather. It does not stop the reading. |

Read straight from ComfyUI, the app gets the header metadata of model files (title, trigger phrase, base model) but no description files next to them and no fingerprints; an MCP server that reads files adds those.

A line at the bottom says the fixed timeout: one MCP call may take up to 60 s. A file that could not be read does not stop the sync: it is listed under **Could not be read** and tried again by itself after 1 h, 6 h, then 24 h.

## Could not be read

When something could not be read, the section shows a report under the buttons. It starts with one line: "Model files read: 360 of 372; could not be read: 2; skipped: 1." Then one row per thing, each saying what it is, why and what to do:

- a model file with its folder, for example "“style.safetensors” in the folder “loras”";
- a model folder, for example "Model folder “upscale_models”";
- a part of the catalog, for example "Catalog: the list of packs".

| Why (on screen) | What to do (on screen) |
|---|---|
| "The server dropped the connection while reading this file, also on a new connection." | The file may be damaged, or its header is one the server cannot read: load it in ComfyUI once to check. The other files were read. |
| "The server had lost its connection for reading files." | Restart the MCP server. |
| "The server answered with an error: …" (the server's short text, without addresses) | Nothing to do: it is tried again at the time shown. |
| "The answer was too large.", "The server did not answer in time.", "The read did not come through." | Nothing to do: it is tried again at the time shown. |
| "ComfyUI was not running when the list was asked for." | Start ComfyUI and sync again. |
| "The server did not give this list." | Sync again. If it stays, check the MCP server. |

Each model file row has **Try again now** (reads just that file at once, past its wait) and the switch **Skip this file** (the file is not read again, and not counted as a failure, until you turn the switch off). Under the list: **Try all again** (clears every wait and syncs) and **Copy report** (plain text, one line per row, without the server address). A long list shows its first five rows and **Show all**.

A sync you start by hand ends with a toast when something could not be read: "Sync done. Could not be read: 2. See the list." Its button **Show the list** opens this section. A sync on the timer shows no toast; the [sync indicator](Sync-Indicator.md) carries the warning mark instead. The card of such a model in the library says "No description: the file could not be read during sync." with the reason.

Automatic sync and its interval also live in the [sync indicator](Sync-Indicator.md) popover, where they apply at once. Here they apply with **Save settings**.

## See also

- [The sync indicator](Sync-Indicator.md)
- [Sync menu](Sync-Menu.md)
- [Settings: Connection](Settings-Connection.md)
- [What each way shows](../connect/What-Each-Way-Shows.md)
