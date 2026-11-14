[Русский](File-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# File menu

The **File** menu works with files: the project file of this app (`.graph-helper.json`, the graph with its explanations) and the workflow file of ComfyUI (`.json`, the graph only). It also opens Settings and closes the app.

<!-- verify: the canvas and files branch adds save in place, Save as and a question before replacing a file; the items and their names may change -->

## Items

| Item | Shortcut | What it does |
|---|---|---|
| **New project** | `Ctrl+N` | Starts an empty graph. If the graph on the canvas is not saved to a project file as it stands, the app asks first. See [Starting a new project](../graph/New-Project.md). |
| **Open project** | `Ctrl+O` | Opens a project file of this app. The explanations and notes come back with the graph. See [Project files](../graph/Project-Files.md). |
| **Save project** | `Ctrl+S` | Saves the graph with its explanations to a project file. The app asks where. |
| **Open workflow…** | `Ctrl+I` | Opens a workflow saved from ComfyUI (a `.json` file). See [Opening a workflow from ComfyUI](../graph/Opening-Workflows.md). |
| **Save workflow for ComfyUI…** | `Ctrl+E` | Checks the graph, then saves a clean workflow for ComfyUI. Explanations and notes stay in the project. See [Saving a workflow for ComfyUI](../graph/Saving-Workflows.md). |
| **Load node list from file…** | none | For when there is no connection: reads the nodes and models from an `object_info` file saved from ComfyUI. See [Loading a node list from a file](../connect/What-Each-Way-Shows.md). |
| **Settings…** | `Ctrl+,` | Opens [Settings](Settings.md). |
| **Exit** | `Ctrl+Q` | Closes the app. The graph on the canvas is kept and comes back at the next start. |

Every item here can always be chosen.

## What the app says

- "Project saved." / "Project opened." / "Workflow saved for ComfyUI." appear at the bottom right after a file is written or read.
- When a field looks like a key or a token, the app asks before it writes the file: "1 field looks like a key or token". See [Messages and dialogs](Messages-And-Dialogs.md).
- When a file cannot be opened, the message says why, for example "This file is not a Graph Helper for ComfyUI project." or "This is an API file, not a canvas workflow. Open a file saved from ComfyUI with Save."

## See also

- [Toolbar](Toolbar.md): **New**, **Open**, **Save**, **Import**, **Export** run the same items.
- [Project files](../graph/Project-Files.md)
- [Saving a workflow for ComfyUI](../graph/Saving-Workflows.md)
- [Settings](Settings.md)
