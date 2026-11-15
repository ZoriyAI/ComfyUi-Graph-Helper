[Русский](Workflow-Formats.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Workflows and their file formats

The workflow file, the API format and pictures with a workflow inside.

## In plain words
A **workflow** is a graph saved to a file. It holds the nodes, their fields, the links, the positions on the canvas, groups and notes. Share a workflow and another person gets your whole graph, but not your model files: those they must have themselves.

## The formats you meet
- **Workflow (UI format), `.json`.** What ComfyUI saves with "Save" and "Export". It describes the canvas: nodes with positions and sizes, links as a separate table, groups, notes, subgraph definitions. This is the format people share, and the one the app opens and saves.
- **API format, `.json`.** What the editor actually sends to the server when you press Run: just the nodes that run, each with its class and its inputs, keyed by node number. No positions, no notes, no Primitive nodes (their values are written straight into the nodes they feed). ComfyUI saves it with "Export (API)". Scripts and services use it.
- **A picture or a clip that carries its workflow.** Save Image writes the workflow and the API prompt into the PNG file's metadata. Drag such a PNG onto ComfyUI and the graph that made it opens. Some other formats saved by ComfyUI (animated WebP, video) can carry it too. Many sites strip metadata, so a picture downloaded from the web often carries nothing.
- **The app's project file.** NodeWise also keeps a project file of its own, next to the plain workflow, with the explanations and notes made in the app. ComfyUI does not need it.

How to tell UI format from API format: a UI file has `"nodes": [...]` and `"links": [...]` at the top; an API file is a list of numbered entries with `"class_type"` and `"inputs"`.

## Typical mistakes
- **Opening an API file and seeing no layout**: the API format has no positions, so a program has to lay the nodes out itself.
- **"Missing models" after opening a shared workflow**: the file names models by file name. You need files with the same names in the right folders, or you pick your own files in the loaders.
- **Missing nodes**: the workflow uses packs you do not have.
- **Expecting a JPEG to hold a workflow**: ComfyUI's Save Image writes PNG; a picture converted to JPEG loses it.

## How the app helps
- **File ▸ Open workflow…** reads UI files; after import the app tells what it found and what is missing in your ComfyUI.
- **File ▸ Save workflow for ComfyUI…** writes a plain workflow ComfyUI opens, without anything only the app understands.
- **Check** runs before export and lists missing nodes and model files.

## See also
- [What ComfyUI is](What-Is-ComfyUI.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
- [Notes, reroutes and primitives](Notes-Reroutes-Primitives.md)
- [Subgraphs](Subgraphs.md)
- [Open a workflow](../graph/Opening-Workflows.md)
- [Save a workflow for ComfyUI](../graph/Saving-Workflows.md)
