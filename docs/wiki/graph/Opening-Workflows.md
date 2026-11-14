[Русский](Opening-Workflows.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Opening a workflow

A workflow is the `.json` file ComfyUI saves: the graph without explanations. Open one here to understand it, change it, or learn from it. The app shows it on the canvas and tells you at once what your ComfyUI is missing to run it. File formats: [Workflow formats](../concepts/Workflow-Formats.md).

## How to open one

1. **File ▸ Open workflow…** (`Ctrl+I`), **Import** on the toolbar, or **Open a ComfyUI workflow** on the welcome card.
2. Choose the `.json` file in the dialog **Open a workflow**.
3. The graph replaces the canvas. A message says what is missing, for example:
   "Workflow opened. Missing nodes: WanVideoSampler, WanVideoDecode. Missing models: loras/detail.safetensors."
   or "Workflow opened. No missing nodes. No missing models."
4. Read it: press **Tour**, or select a node and look at its card.

Opening is one step of the history: `Ctrl+Z` brings the earlier graph back.

## What the notice means

- **Missing nodes**: node classes your ComfyUI does not have. They stay in the graph, marked; the check calls them "Nodes that are not installed". Install the pack in ComfyUI yourself and sync.
- **Missing models**: model files named in the workflow that are not in your folders.
- "Saved for ComfyUI as they are, but shown differently here: group nodes show as one unknown node: 2." The app cannot draw some things the way ComfyUI does, but it keeps them and writes them back unchanged.

## Saving it again

When you save it with **File ▸ Save workflow for ComfyUI…**, it goes back to ComfyUI exactly as it was, except for what you changed: positions, colours, groups, links and values you did not touch stay as they were.

## What can go wrong

- "This is an API file, not a canvas workflow. Open a file saved from ComfyUI with Save." The file was saved with ComfyUI's API export; open the normal workflow instead.
- "This file does not look like a ComfyUI workflow (format 1 or the older 0.4 is expected). Open a workflow saved from ComfyUI."
- "Workflow JSON could not be parsed." The file is damaged or not JSON.
- "This file is too large to open."
- A file of this app's own project is opened with **File ▸ Open project**, not here.

<!-- verify: the files and start branch adds opening a workflow from a picture or a video, dropping a file on the window, a file on the command line, the API format, recent files, examples, a summary after the import and a cap on graph size; the notice will change -->

## See also

- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [Checking a graph](Checking-A-Graph.md)
- [The tour of a graph](Tour.md)
- [File formats](../reference/File-Formats.md)
