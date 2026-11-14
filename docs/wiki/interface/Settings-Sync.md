[Русский](Settings-Sync.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Sync

"The library comes from your ComfyUI through read-only MCP tools." This section shows how the last sync went, runs one now, sets automatic sync, and says how model files are read.

## What it shows

The state and a summary: "Up to date · 812 node classes, 41 packs, 331 models (120 with metadata). Last sync 14:05." Warnings of the last sync, a paused reading ("Metadata reading is paused at 120 / 331. It continues with the next sync, or press Sync now.") and the last error.

## Fields and buttons

| Field | Default | What it does |
|---|---|---|
| **Sync automatically** | off | Reads ComfyUI again on a timer. It can be switched on only with an MCP server address: "Automatic sync can be switched on once the MCP server address is set in Connection." |
| **Interval, minutes** | 30 | From 5 minutes to a day. A number out of range is corrected: "The interval must be from 5 minutes to a day, so it is now 5 min." |
| **Sync now** | | Reads ComfyUI now. |
| **Pause metadata reading** | | Appears while model files are read. |
| **Read model metadata from** | **Loader folders (checkpoints, LoRAs, VAE…)** | or **All model folders** |
| **Models per batch** | 50 (10 to 1000) | Metadata is read in batches of this size, one after another, until every file is read. |
| **Pause between batches, ms** | 1500 (0 to 10 000) | Gives the MCP server and ComfyUI a breather. It does not stop the reading. |

A line at the bottom says the fixed timeout: one MCP call may take up to 60 s; after 5 failed metadata reads in a row the reading waits for the next sync, and each failed file is tried again after 1 h, 6 h, then 24 h.

Automatic sync and its interval also live in the [sync indicator](Sync-Indicator.md) popover, where they apply at once. Here they apply with **Save settings**.

<!-- verify: the connection branch adds reading a plain ComfyUI without MCP; the sentence about MCP tools will change -->

## See also

- [The sync indicator](Sync-Indicator.md)
- [Sync menu](Sync-Menu.md)
- [Settings: Connection](Settings-Connection.md)
- [What each way shows](../connect/What-Each-Way-Shows.md)
