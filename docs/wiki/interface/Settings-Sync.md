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

## Problems and repairs

The report has its own menu: **Sync → Sync problems and repairs**. The end-of-sync **Show the list** button opens it too. It collects connection warnings, unread and excluded files, reasons and recovery actions.

- **Try again now** reads one file through the server, including excluded files. Success removes the exclusion.
- **Read file from this device** opens the file picker on the device displaying the interface. Select the same `.safetensors` or `.sft` file: its name, size and catalog revision are checked. Only the eight-byte prefix and header (up to 64 MiB) are read; weights are not loaded or transferred. A phone browser selects a phone file; a desktop selects a desktop file.
- A valid header without embedded metadata is recorded as successfully read with no embedded description. This does not indicate corruption. An existing sidecar description is preserved.
- **Skip this file** disables automatic attempts but keeps manual repair available.
- **Retry non-excluded files** clears retry waits. **Copy report** includes reasons and exclusions.

History lists headers read from this device. A large header can explain why ComfyUI's native route refused it. Another source's history is hidden when the connection changes. Pause reading or open connection settings from the dialog.

## See also

- [The sync indicator](Sync-Indicator.md)
- [Sync menu](Sync-Menu.md)
- [Settings: Connection](Settings-Connection.md)
- [What each way shows](../connect/What-Each-Way-Shows.md)
