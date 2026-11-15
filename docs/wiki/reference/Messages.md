[Русский](Messages.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Messages and what to do

The messages the app shows when something does not go as planned, grouped by where they appear, each with what to do.
How messages and dialogs look: [Messages and dialogs](../interface/Messages-And-Dialogs.md). When the assistant cannot
answer: [Failed answers](../assistant/Failed-Answers.md).

## When the app starts

| Message | What to do |
| --- | --- |
| "Your data was saved by a newer version of the app. Install that version again to open it. Nothing was changed." | Install the newer version again, or start with another data folder (`--user-data-dir`). |
| **The app's data file is damaged** | **Start with empty data** puts the damaged file aside under a new name; **Open folder** shows it. Project and workflow files are not affected. |
| "The app's data file in … is damaged and could not be put aside. Move the file comfyui-desktop.db out of that folder, then start the app again." | Move the file by hand, then start again. |
| "The app cannot write to its data folder …" | Make sure the folder belongs to you and the disk is not read-only. |
| "There is no free space on the disk for the app's data." | Free some space; your data is kept. |
| "The app's data file is in use by another program." | Close the other program (a second copy of the app, a backup tool, a database viewer). |
| **… could not start** "The app could not start. The log is in …" | Open the log; see [Troubleshooting](Troubleshooting.md). |

## Opening and saving files

| Message | What to do |
| --- | --- |
| "This file was in the API format, which has no positions: the app laid the nodes out from left to right." | Nothing: the API file opened. Arrange it if you like (`Ctrl+Shift+L`). |
| "This file is not a workflow: its text could not be read." | The file is not JSON or is cut off. Save it again from ComfyUI. |
| "There is no workflow in this file…" | The picture or video was not saved by ComfyUI, or a chat app removed the workflow. Open the original file or the `.json`. |
| "This kind of file cannot be opened here…" | Open a workflow (`.json`), a project, or a picture or video saved by ComfyUI. |
| "This file is no longer there: it was moved or deleted." | A file of File ▸ Open recent moved; open it from its new place. |
| "This file is too large to open." | The file is larger than 64 MB. |
| "This graph is too large to open (… nodes, … links)…" | The app opens graphs of up to 1500 nodes and 3000 links. Nothing was changed. [Known limitations](Known-Limits.md) |
| "This file is protected from writing…" | Choose another name, or allow writing to the file in its properties. |
| "This file is not a … project." | Open it with File ▸ Open workflow… if it is a workflow. |
| "This project file version is not supported (N). Update the app to open it." | The file was saved by a newer version. |
| "The project file is damaged. Open another copy of the project." | Use another copy. |
| "This folder cannot be written to. Pick another folder." | Save to a folder of yours. |
| "There is no free space on the disk. Free some space or pick another disk." | Free some space. |
| "This file is not a node list saved from ComfyUI." | File ▸ Load node list from file… needs the answer of ComfyUI's `/object_info`. |
| **N fields look like a key or token** | **Save without these values** keeps the key out of the file. |

## While you edit the graph

| Message | What to do |
| --- | --- |
| "The change could not be saved. The graph is as it was before it." | Usually a full disk; free some space and repeat the change. |
| "That edit was not applied" | The graph changed in between (for example the assistant built a step). Repeat the edit. |
| "The inputs and outputs of this node are not known yet: start ComfyUI and sync" | Read ComfyUI again with Sync ▸ Sync now. |
| "A subgraph cannot go inside itself, directly or through another subgraph." | Choose other nodes for the subgraph. |

## The assistant

| Message | What to do |
| --- | --- |
| "The cloud assistant has no key. Add it in Settings ▸ Assistant." | Paste the key: [Keys](../assistant/Keys.md). |
| "No model is chosen for the cloud assistant." / "No model is chosen on your own server." | Choose a model in Settings ▸ Assistant. |
| "A cloud key is never sent to an http address. Use an address that starts with https." | Correct the address. |
| "The address of your own server is not set." | Enter it in Settings ▸ Assistant, for example `http://127.0.0.1:11434/v1`. |
| "The provider refused the key." | The key is wrong, revoked or for another provider. |
| "The server did not answer." / "The server did not send the model list in time." | Start the server; check the address. |
| "This model cannot call tools, and without them the assistant cannot read the graph…" | Choose a model marked "tools" in the model list. |

More, including the messages inside an answer: [Failed answers](../assistant/Failed-Answers.md).

## Connection and sync

Every message about the ComfyUI address and the MCP server, with its cause and what to do, is on one page:
[Connection problems](../connect/Connection-Problems.md).

## Keys and settings

| Message | What to do |
| --- | --- |
| "Settings cannot hold a key or a password. Remove it from the field." | A key goes into its own key field, never into an address or a name. |
| "An explanation cannot hold a key or a password. Remove it from the text." | Remove the key from the note. |
| "Kept for this session only: the system keychain did not confirm encryption." | The keychain did not open; see [Troubleshooting](Troubleshooting.md). |
| "Stored settings could not be read; default settings are shown." | Check and save the settings again. |

## See also

- [Reference](README.md)
- [Troubleshooting](Troubleshooting.md)
- [Messages and dialogs](../interface/Messages-And-Dialogs.md)
- [Failed answers](../assistant/Failed-Answers.md)
