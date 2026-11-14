# Troubleshooting

## A key or a token is not kept: "The password store is not available here"

The app keeps keys in the system password store (GNOME Keyring or KWallet). When there is none, or it is locked, a key lives only until the app closes.

What to do:

1. Open "Settings ▸ Privacy ▸ Password store" and choose the one you have: GNOME Keyring (`gnome-libsecret`) or KWallet.
2. If there is no store at all, install one: `sudo apt install gnome-keyring`, then log out and log in again.
3. You can also do without a store: "Remember in the app folder" writes the key to the app's folder without encryption. Only your user can read the file. A cloud key can spend money, so do this only on your own computer.

## The library is empty after a sync

1. Look at the sync indicator at the top right. It says what happened: the server cannot be reached, the sign-in expired, ComfyUI is not running, or part of the catalog was not read.
2. Make sure both ComfyUI and the MCP server next to it are running.
3. In "Settings ▸ Connection" choose "Check" next to the address. If the server asks for a sign-in, choose "Token" or "Sign in through the browser".
4. Choose "Sync ▸ Sync now".
5. If that does not help, "Help ▸ Copy diagnostics" puts a report without keys and tokens on the clipboard. You can paste it into a message.

## Your own model answers off the point or cuts its answer short

A model on your server reads only what fits into its context window. Ollama gives a small window by default: 4 thousand tokens when the GPU has less than 24 GB of memory. The assistant's request with its tools takes 3 to 6 thousand tokens, and the server silently drops what does not fit.

The app notices this and shows a card with two numbers in the chat. "Settings ▸ Assistant ▸ Check connection" shows the window the model was loaded with right away.

What to do: make the window on the server at least 16,384. For Ollama, set `OLLAMA_CONTEXT_LENGTH=16384` and restart the server, or set `num_ctx` for the model.

## At start: "Running as root without --no-sandbox is not supported"

The app was started as root, for example with `sudo`. It cannot run like that: Chromium's protection works only for an ordinary user.

What to do: start the app from the menu or with `comfyui-graph-builder`, without `sudo`.

## ComfyUI on another computer

The app can work with ComfyUI on another computer.

- The address of an MCP server on another computer must start with `https://`. An `http://` address is fine only for a server on this computer (`localhost`, `127.0.0.1`).
- The app reads the full node descriptions (ports and fields) from ComfyUI itself when the server names its address. From another computer that address is often not reachable. Then type it into "ComfyUI address" in "Settings ▸ Connection", for example `http://192.168.1.50:8188`.
- If ComfyUI cannot be reached at all, you can load the node list from a file: "File ▸ Load node list from file…" and an `object_info` file saved from ComfyUI.

## At start: "The app's data file is damaged"

The app could not read its database. "Start with empty data" puts the damaged file aside as `comfyui-desktop.db.damaged-<date>` in `~/.config/comfyui-graph-builder` and starts with a clean database. Nothing is deleted. Saved project and workflow files are not touched: open them again with "File ▸ Open project". "Open folder" shows the data folder, "Quit" closes the app without changing anything.

If `comfyui-desktop.db.before-v16.bak` lies next to it (the number may differ), it is a copy of the database made before the last upgrade. To go back to it, close the app, move `comfyui-desktop.db`, `comfyui-desktop.db-wal` and `comfyui-desktop.db-shm` (if they exist) out of the folder, rename the copy to `comfyui-desktop.db` and start the app again. The app upgrades it to its own version again.

## At start: "Your data was saved by a newer version of the app"

You installed a version older than the one that worked with this data. The app changes nothing and closes. Install the newer version again.

## At start: the disk is full, the folder is read-only, or the file is busy

- No space for the app's data: free some space and start the app again. Your data is kept.
- The app cannot write to its data folder: check that `~/.config/comfyui-graph-builder` belongs to you and the disk is not write-protected.
- The data file is busy in another program: close it and start the app again.

If the disk fills up while you work, the app says the change was not saved. Free some space and try again.

## Where to see more

- "Help ▸ Open logs folder": the app log.
- "Help ▸ Conversation log…": what was sent to the model and what it answered.
- "Help ▸ About ▸ Copy details": the app and system versions for a bug report.
