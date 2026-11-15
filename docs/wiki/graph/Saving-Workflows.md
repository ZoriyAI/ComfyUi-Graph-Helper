[Русский](Saving-Workflows.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Saving a workflow for ComfyUI

**File ▸ Save workflow for ComfyUI…** writes the graph as an ordinary ComfyUI workflow, a `.json` file that ComfyUI opens. It is clean: explanations, notes and descriptions stay in the project, not in this file. To keep them, also save a [project file](Project-Files.md).

## How to save

1. **File ▸ Save workflow for ComfyUI…** (`Ctrl+E`), **Export** on the toolbar, or **Save workflow…** after a build.
2. The app checks the graph first. If it finds problems, it asks: "The workflow has 3 issues. ComfyUI may not run it as it is. Open the check to fix them, or save anyway." It lists them. Choose **Open check** (fix first), **Save anyway** or **Cancel**.
3. If a field looks like a key or a token, it asks: "1 field looks like a key or token. Whoever gets the file can read these values. Save without them (the fields stay empty in the file), or save as it is." Choose **Save without these values** or **Save as it is**.
4. In the dialog **Save the workflow for ComfyUI**, choose the place and the name, then **Save**. The app suggests the title of the graph with `.json`, and adds `.json` if the name you type has none.
5. "Workflow saved for ComfyUI." The card **Run it in ComfyUI** opens and says how to run the file. See [Running the result in ComfyUI](Running-In-ComfyUI.md).

Every save of a workflow asks where to write it: the app does not write over the workflow you opened by itself. Whether the dialog asks before it replaces a file that already exists depends on the file dialog of your system.

## What goes into the file

- Every node with its fields, every link, the groups, the subgraphs, the node names and positions.
- A workflow you opened goes back exactly as it was, except for what you changed.
- Notes on the canvas, colours, bypassed and muted nodes are kept, so ComfyUI shows them too.
- A workflow opened from the API format is saved as an ordinary canvas workflow, with the positions the app gave it. The app does not save in the API format.
- The format is the one the graph came in (1, or the older 0.4); a new graph is written so ComfyUI can open it.

## What the app warns about after saving

- "These fields have no value and no default, so ComfyUI will ask for them: …" Set them in ComfyUI or here and save again.
- "The app does not know the exact order of this node's fields, so these values are not written to the saved workflow." Set those values in ComfyUI.

## What can go wrong

- "The workflow file could not be written." / "This folder cannot be written to. Pick another folder." / "There is no free space on the disk. Free some space or pick another disk." / "This file is protected from writing. Choose another name, or allow writing to it in its properties."
- The file is written whole or not at all: if writing stops halfway, the old file stays as it was.

## See also

- [Checking a graph](Checking-A-Graph.md)
- [Project files](Project-Files.md)
- [Running the result in ComfyUI](Running-In-ComfyUI.md)
- [File formats](../reference/File-Formats.md)
