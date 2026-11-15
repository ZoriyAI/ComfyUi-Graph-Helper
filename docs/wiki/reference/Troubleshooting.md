[Русский](Troubleshooting.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Troubleshooting

Problems and their way out. Problems with the connection to ComfyUI have their own page:
[Connection problems](../connect/Connection-Problems.md). What a single message means:
[Messages and what to do](Messages.md).

## A key or a token is not kept

The app keeps keys in the system password store (GNOME Keyring or KWallet). When there is none, or it is locked, a
key lives only until the app closes, and the settings say "Stored for this session only".

1. Settings ▸ Privacy ▸ Password store: choose the one you have, GNOME Keyring (`gnome-libsecret`) or KWallet. The
   choice applies after a restart.
2. If there is no store at all, install one, for example `sudo apt install gnome-keyring`, then log out and in again.
3. Or do without a store: **Remember in the app folder** writes the key unencrypted to a file only your user can
   read. A cloud key can spend money: do this only on your own computer.

## The library is empty after a sync

<!-- verify: connection chapter -->

1. Look at the sync indicator at the top right: it says what happened (the server cannot be reached, the sign-in
   expired, ComfyUI is not running, part of the catalog was not read).
2. Make sure ComfyUI is running, and the MCP server next to it if you use one.
3. Check the connection in Settings ▸ Connection, then choose Sync ▸ Sync now.
4. Still empty: Help ▸ Copy diagnostics puts a report without keys and tokens on the clipboard, for an Issue.

## Your own model answers off the point or cuts its answer short

A model on your own server reads only what fits into its context window. Ollama gives a small window by default, and
the assistant's request with its tools takes 3 to 6 thousand tokens; the server silently drops what does not fit.
The app notices and says so above the answer; Settings ▸ Assistant ▸ Check connection shows the window right away.

Make the window on the server at least 16 384 tokens. For Ollama: `OLLAMA_CONTEXT_LENGTH=16384` when the server
starts, or `num_ctx` on the model. More: [The context window](../assistant/Context-Window.md).

## The app does not start as root

Started with `sudo` or as root, the app stops with "Running as root without --no-sandbox is not supported". Chromium's
protection works only for an ordinary user. Start the app from the menu, or as `cozygraph` without `sudo`.
<!-- verify: technical rename -->

## ComfyUI is on another computer

<!-- verify: connection chapter -->

See [ComfyUI on another computer](../connect/Another-Computer.md). If ComfyUI cannot be reached at all, load the node
list from a file: File ▸ Load node list from file… with an `object_info` file saved from ComfyUI.

## At start: "The app's data file is damaged"

**Start with empty data** puts the damaged file aside as `comfyui-desktop.db.damaged-<date>` in the
[data folder](Data-Folder.md) and starts with a clean database. Nothing is deleted. Saved project and workflow files
are not touched: open them again with File ▸ Open project.

If `comfyui-desktop.db.before-v<N>.bak` lies next to it, it is a copy made before the last upgrade. To go back to it:
close the app, move `comfyui-desktop.db` and, if they exist, `comfyui-desktop.db-wal` and `comfyui-desktop.db-shm` out
of the folder, rename the copy to `comfyui-desktop.db` and start the app. It upgrades the copy again.

## At start: "Your data was saved by a newer version of the app"

You installed a version older than the one that last worked with this data. The app changes nothing and closes.
Install the newer version again.

## At start: the disk is full, the folder is read-only, or the file is busy

- No space: free some space and start again. Your data is kept.
- Cannot write: make sure the data folder belongs to you and the disk is not write-protected.
- Busy: another program holds the data file (often a second copy of the app started under another name, or a backup
  tool). Close it and start again.

If the disk fills up while you work, the app says the change was not saved. Free some space and repeat it.

## The window is blurry or the wrong size on Wayland

Start the app with `--ozone-platform-hint=auto` to run natively on Wayland. [The command line](Command-Line.md)

## The window stopped or does not respond

**Reload** in the message brings the window back; the graph is saved after every change. If it keeps happening, open
Help ▸ Open logs folder and attach `main.log` to an Issue.

## Where to see more

- Help ▸ Open logs folder: the app's log.
- Help ▸ Conversation log…: what was sent to the model and what came back.
- Help ▸ Copy diagnostics: a report without keys and tokens.
- Help ▸ About ▸ Copy details: the versions of the app and the system, for a bug report.
- Help ▸ Report a problem…: opens a new Issue with the versions filled in.

## See also

- [Reference](README.md)
- [Messages and what to do](Messages.md)
- [Connection problems](../connect/Connection-Problems.md)
- [Known limitations](Known-Limits.md)
