[Русский](Messages-And-Dialogs.ru.md)
[Home](../Home.md) › [The window](README.md)

# Messages and dialogs

The app talks to you in two ways. A **message** (a toast) appears at the bottom right for a few seconds and says what just happened; some have a button, and **Dismiss** closes one. `F8` moves the keyboard focus to the messages. A **dialog** stops and asks before something that cannot be taken back. The full list of texts is in [Messages](../reference/Messages.md).

## Messages you will see often

| Message | After |
|---|---|
| "Project saved." / "Project opened." | File ▸ Save project / Open project |
| "Workflow opened. Missing nodes: … Missing models: …", with where it came from (a picture, a video, the API format, an example) and **Open check** | opening a workflow in any way. See [Opening a workflow](../graph/Opening-Workflows.md). |
| "Nodes moved apart so none covers another: 12" | opening a workflow whose nodes covered each other |
| "Workflow saved for ComfyUI." with **How to run it** | File ▸ Save workflow for ComfyUI…; the card **Run it in ComfyUI** opens too |
| "Node list loaded. Nodes: 812. Models: 96. Skipped: 0." | File ▸ Load node list from file… |
| "Read from ComfyUI. Nodes: 75, packs: 5, model files: 331." | a sync |
| "Added KSampler to the graph." | adding a node from the library |
| "The inputs and outputs of this node are not known yet: start ComfyUI and sync" | adding a node whose ports are not read |
| "That edit was not applied" | the graph changed first |
| "Replaced with …" | Replace with… |
| "IMAGE cannot go into an input that expects LATENT." | a link dropped on an input of another type |
| "Select one or more nodes first." | Bypass, Mute or Color with nothing selected |
| "There is no free space on the disk. The change was not saved; free some space and try again." | a full disk |

## Dialogs that ask

| Dialog | Buttons |
|---|---|
| **Start a new project?** "The graph on the canvas is not saved to a project file as it stands…" | **Cancel**, **Start new project** |
| **Open a workflow?** / **Open another project?** "The graph on the canvas is not saved to a project file as it stands…" | **Cancel**, **Open workflow** / **Open project** |
| **The assistant is still building. Stop it?** "The build stops and what it has added stays in this graph. Then what you chose opens." | **Cancel**, **Stop and go on** |
| **The workflow has 3 issues** "ComfyUI may not run it as it is. Open the check to fix them, or save anyway." | **Cancel**, **Open check**, **Save anyway** |
| **1 field looks like a key or token** "Whoever gets the file can read these values. Save without them (the fields stay empty in the file), or save as it is." | **Cancel**, **Save as it is**, **Save without these values** |
| **Close without saving?** (Settings) | **Keep editing**, **Close without saving** |
| **Forget all keys and tokens?** | **Cancel**, **Forget** |
| **Clear chat history?** | **Cancel**, **Clear** |
| **Turn on adult content?** with the rules | **Read the content rules**, **I am 18 or older**, **Leave it off** |
| **The graph did not open last time** "The last start did not finish drawing the graph. It may be too large or damaged." | **Start with an empty canvas**, **Open the graph again** |
| "Delete all 12 records? It cannot be undone." (conversation log) | **Keep**, **Delete** |

## When something breaks

| Title | What to do |
|---|---|
| **Something went wrong** "An error happened in the app. It keeps running; the details are in the log." | **OK**. |
| **The window stopped** | **Reload**; the graph is saved. |
| **The window is not responding** | **Wait** or **Reload**. |
| **The app's data file is damaged** "You can start with empty data. The damaged file is not deleted…" | **Start with empty data**, **Open folder** or **Quit**. |
| "Your data was saved by a newer version of the app. Install that version again to open it. Nothing was changed." | install the newer version |
| **NodeWise Studio could not start** "The log is in …" | open the log folder and see [Troubleshooting](../reference/Troubleshooting.md) |
| **NodeWise Studio has your work** (the first start after version 0.9) | read where your work is now; keys from the system keychain must be entered again in Settings |
| **Version 0.9 is still open** | quit version 0.9 and start again |

## See also

- [Messages](../reference/Messages.md)
- [Troubleshooting](../reference/Troubleshooting.md)
- [The window at a glance](Window.md)
