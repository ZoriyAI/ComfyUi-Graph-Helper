[Русский](File-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# File menu

The **File** menu works with files: the project file of this app (`.nodewise.json`, the graph with its explanations) and the workflow file of ComfyUI (`.json`, the graph only). It also opens pictures and videos that ComfyUI saved, recent files and examples, works with lesson files, opens Settings and closes the app. A file dropped on the window opens the same way as **Open workflow…**.

## Items

| Item | Shortcut | What it does |
|---|---|---|
| **New project** | `Ctrl+N` | Starts an empty graph. If the graph on the canvas is not saved to a project file as it stands, the app asks first. See [Starting a new project](../graph/New-Project.md). |
| **Open project** | `Ctrl+O` | Opens a project file of this app. The explanations and notes come back with the graph. See [Project files](../graph/Project-Files.md). |
| **Open recent** | none | The last 10 files you opened or saved. Hover over one to see its path. "Nothing opened yet" while the list is empty. |
| **Examples** | none | The finished graph of every lesson your ComfyUI can build, named after the lesson. Empty until ComfyUI is read. See [Opening a workflow](../graph/Opening-Workflows.md#examples). |
| **Save project** | `Ctrl+S` | Saves the graph with its explanations. The first time the app asks where; after that it writes to the same file without asking. |
| **Save project as…** | `Ctrl+Shift+S` | Always asks for a place and a name. |
| **Open workflow…** | `Ctrl+I` | Opens a workflow saved from ComfyUI (a `.json` file), a workflow in the API format, or a picture or video ComfyUI saved. See [Opening a workflow](../graph/Opening-Workflows.md). |
| **Save workflow for ComfyUI…** | `Ctrl+E` | Checks the graph, then saves a clean workflow for ComfyUI and shows the card **Run it in ComfyUI**. Explanations and notes stay in the project. See [Saving a workflow for ComfyUI](../graph/Saving-Workflows.md). |
| **Load node list from file…** | none | For when there is no connection: reads the nodes and models from an `object_info` file saved from ComfyUI. See [Loading a node list from a file](../connect/What-Each-Way-Shows.md). |
| **Import lessons…** | none | Adds lessons from a `.lesson.json` file to **My lessons**. See [The lessons tab](Lessons-Panel.md). |
| **Make a lesson from this graph** | none | Opens the lesson editor with a step for each node of the graph. See [The lessons tab](Lessons-Panel.md). |
| **Settings…** | `Ctrl+,` | Opens [Settings](Settings.md). |
| **Quit** | `Ctrl+Q` | Closes the app. The graph on the canvas is kept and comes back at the next start. |

On a Mac, `Ctrl` is `Cmd`. New project, Open project and Open workflow ask first while the assistant is building: "The assistant is still building. Stop it?"

## What the app says

- "Project saved." / "Project opened." / "Workflow saved for ComfyUI." appear at the bottom right after a file is written or read.
- When a field looks like a key or a token, the app asks before it writes the file: "1 field looks like a key or token". See [Messages and dialogs](Messages-And-Dialogs.md).
- When a file cannot be opened, the message says why, for example "This file is not a NodeWise Studio project." or "There is no workflow in this file. ComfyUI writes one into the pictures and videos it saves itself; a picture from elsewhere, or one sent through a chat app, usually has none."

## See also

- [Toolbar](Toolbar.md): **New**, **Open**, **Save**, **Import**, **Export** run the same items.
- [Opening a workflow](../graph/Opening-Workflows.md)
- [Project files](../graph/Project-Files.md)
- [Saving a workflow for ComfyUI](../graph/Saving-Workflows.md)
- [Settings](Settings.md)
