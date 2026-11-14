[Русский](Messages-And-Dialogs.ru.md)
[Home](../Home.md) › [The window](README.md)

# Messages and dialogs

The app talks to you in two ways. A **message** (a toast) appears at the bottom right for a few seconds and says what just happened; some have a button, and **Dismiss** closes one. A **dialog** stops and asks before something that cannot be taken back. The full list of texts is in [Messages](../reference/Messages.md).

## Messages you will see often

| Message | After |
|---|---|
| "Project saved." / "Project opened." | File ▸ Save project / Open project |
| "Workflow opened. Missing nodes: … Missing models: …" | File ▸ Open workflow… See [Opening a workflow](../graph/Opening-Workflows.md). |
| "Workflow saved for ComfyUI." | File ▸ Save workflow for ComfyUI… |
| "Node list loaded. Nodes: 812. Models: 96. Skipped: 0." | File ▸ Load node list from file… |
| "Read 75 nodes, 5 packs and 331 model files." | a sync |
| "Added KSampler to the graph." | adding a node from the library |
| "The inputs and outputs of this node are not known yet: start ComfyUI and sync" | adding a node whose ports are not read |
| "That edit was not applied" | the graph changed first |
| "There is no free space on the disk. The change was not saved; free some space and try again." | a full disk |

## Dialogs that ask

| Dialog | Buttons |
|---|---|
| **Start a new project?** "The graph on the canvas is not saved to a project file as it stands…" | **Cancel**, **Start new project** |
| **The workflow has 3 issues** "ComfyUI may not run it as it is. Open the check to fix them, or export anyway." | **Cancel**, **Open check**, **Export anyway** |
| **1 field looks like a key or token** "Whoever gets the file can read these values. Save without them (the fields stay empty in the file), or save as it is." | **Cancel**, **Save as it is**, **Save without these values** |
| **Close without saving?** (Settings) | **Keep editing**, **Close without saving** |
| **Forget all keys and tokens?** | **Cancel**, **Forget** |
| **Clear chat history?** | **Cancel**, **Clear** |
| "Delete all 12 records? It cannot be undone." (conversation log) | **Keep**, **Delete** |

## When something breaks

| Title | What to do |
|---|---|
| **Something went wrong** "An error happened in the app. It keeps running; the details are in the log." | **OK**. |
| **The window stopped** | **Reload**; the graph is saved. |
| **The window is not responding** | **Wait** or **Reload**. |
| **The app's data file is damaged** "You can start with empty data. The damaged file is not deleted…" | **Start with empty data**, **Open folder** or **Quit**. |
| "Your data was saved by a newer version of the app. Install that version again to open it. Nothing was changed." | install the newer version |
| **Graph Helper for ComfyUI could not start** "The log is in …" | open the log folder and see [Troubleshooting](../reference/Troubleshooting.md) |

## See also

- [Messages](../reference/Messages.md)
- [Troubleshooting](../reference/Troubleshooting.md)
- [The window at a glance](Window.md)
