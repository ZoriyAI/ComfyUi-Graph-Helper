[Русский](Troubleshooting.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Troubleshooting

Problems and their way out. Problems with the connection to ComfyUI have their own page:
[Connection problems](../connect/Connection-Problems.md). What a single message means:
[Messages and what to do](Messages.md).

## A key or a token is not kept

The app keeps keys in the system keychain (GNOME Keyring or KWallet). When there is none, or it is locked, a
key lives only until the app closes, and the settings say "The key is kept until restart."

1. Settings ▸ Privacy ▸ Which keychain the app uses: choose the one you have, GNOME "Passwords and Keys" or
   KWallet. The
   choice applies after a restart.
2. If there is no store at all, install one, for example `sudo apt install gnome-keyring`, then log out and in again.
3. Or do without a store: **Remember in the app folder** writes the key unencrypted to a file only your user can
   read. A cloud key can spend money: do this only on your own computer.

## The library is empty after a sync

1. Look at the sync indicator at the top right: it says what happened, and its popover says where the library was
   read from.
2. Make sure ComfyUI is running and its page opens in the browser at the address you saved.
3. In Settings ▸ Connection choose **Check ComfyUI**; the message under the field names the problem
   ([Connection problems](../connect/Connection-Problems.md)). Then **Read now**.
4. Still empty: Help ▸ Copy diagnostics puts a report without keys, tokens or addresses on the clipboard, for an Issue.

## Your own model answers off the point or cuts its answer short

A model on your own server reads only what fits into its context window. Ollama gives a small window by default, and
the assistant's request with its tools takes 3 to 6 thousand tokens; the server silently drops what does not fit.
The app notices and says so above the answer; Settings ▸ Assistant ▸ Test connection shows the window right away. With Ollama it can also make a copy of
the model with a 16 384-token window, without a download.

Press **Configure automatically** in the warning, or choose a conversation mode in **Settings → Assistant** and apply it to Ollama. The app checks the real loaded window. If memory is insufficient, unload another model here or choose a smaller mode. More: [The context window](../assistant/Context-Window.md).

## The app does not start as root

Started with `sudo` or as root, the app stops with "Running as root without --no-sandbox is not supported". Chromium's
protection works only for an ordinary user. Start the app from the menu, or as `nodewise-studio` without `sudo`.

## ComfyUI is on another computer

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


## A generation stays in the queue

Open **Help → Explain a ComfyUI error… → Check ComfyUI**. The check reads the ComfyUI address saved in Settings → Connection. Paste its **prompt ID**, or select a job shown in the queue. Refresh after another application changes its state.

- **Waiting** means ComfyUI accepted the graph but its worker has not started it.
- **Running** means the worker took the job; follow its node progress.
- **Completed / error** requires the history of that exact prompt. An empty queue alone does not prove success. A Studio run can still be awaiting submission, or a prompt may belong to another server or have expired from history.

When Reference Studio is installed, the panel shows the guard's exact reason, code, observation time, available and requested GPU/RAM memory, and the protected RAM floor. A guard row naming another prompt belongs to that other job. Old or missing observations are labelled explicitly. Plain ComfyUI can still provide queue and history without this extension.

| Cause | Next action |
| --- | --- |
| `VRAM_CAPACITY_WAIT` | Compare the guard's free and requested memory; establish which completed task owns a resident model before unloading it. Keep the graph and reserve. |
| `RAM_CAPACITY_WAIT` | Wait for the known task holding RAM or finish that task normally; preserve the RAM floor. |
| `GPU_LEASE_BUSY` | Wait for the lease holder or finish that same job normally. Leave lease files to Studio. |
| `FOREIGN_GPU_COMPUTE_BUSY` | Identify the other computation and its owner. Leave the desktop and display processes running. |
| `NATIVE_RESOURCE_AUTHORITY_WAIT` | Read the exact reason. This generic code is not a diagnosis of low memory. |
| `Connection refused` in a guard's Ollama idle check | A stopped optional endpoint should not block graphics admission. Check the Reference Studio guard update or the configured service; actual Ollama generation still needs an available endpoint. Timeouts, invalid JSON and other errors do not establish that memory is free. |
| MCP `Not connected` | Recover the disconnected reader session through the configured connection/service controls. Keep the original prompt; reconnecting is not a reason to submit it again or restart ComfyUI. |

The resident list reads `/api/ps` on the configured assistant server. It is different from the disk catalog. A malformed or failed response means **unknown**, not empty. **Release the assistant’s own models** uses NodeWise's existing ownership-aware controls. Other Ollama endpoints, foreign process ownership and Studio's run journal are not inspected by this panel. Their absence from the report does not establish that they are idle.

**Copy diagnostic report** preserves the observed prompt, any guard-reported matching run/attempt IDs, stage, exact reason, time and measured budgets. Unknown IDs remain unknown. The report contains no graph payload. **Explain this observation with the assistant** passes these facts to your configured model. The check does not cancel jobs, submit prompts or change a workflow, model or resource settings.

## See also

- [Reference](README.md)
- [Messages and what to do](Messages.md)
- [Connection problems](../connect/Connection-Problems.md)
- [Known limitations](Known-Limits.md)
