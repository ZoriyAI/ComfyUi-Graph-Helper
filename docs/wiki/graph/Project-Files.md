[Русский](Project-Files.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Project files

A project file (`.graph-helper.json`) keeps the graph together with everything the app knows about it: the explanations of nodes and links, your notes and descriptions, the purpose of each node, the title and notes of the graph. Open it later and all of it comes back. ComfyUI cannot open a project file; for ComfyUI save a [workflow](Saving-Workflows.md).

## How to save a project

1. **File ▸ Save project** (`Ctrl+S`) or **Save** on the toolbar.
2. If a field looks like a key or a token, the app asks first, as it does for a workflow: **Save without these values** or **Save as it is**.
3. Choose the place and the name in **Save the project**, then **Save**. "Project saved."

The dot after the project name in the toolbar disappears: there are no unsaved changes.

## How to open a project

1. **File ▸ Open project** (`Ctrl+O`) or **Open** on the toolbar.
2. Choose a file of the type **Graph Helper for ComfyUI project**. "Project opened."

The graph replaces the canvas; it is one step of the history.

## What is in the file

The graph in ComfyUI's own form, plus the explanations, the component records (purpose, how to use) and the title and notes. The chat and the settings are not in it. Keys never are.

## What can go wrong

- "This file is not a Graph Helper for ComfyUI project."
- "This project file version is not supported (3). Update the app to open it."
- "The project file is damaged. Open another copy of the project."
- "The project file has the same description twice. Open another copy of the project."
- "The project file could not be written." The file is written whole or not at all.

## Do I need a project file?

The app keeps the graph on the canvas by itself: close and open the app, and it is there. A project file is for a copy you keep or share, and for working on more than one graph.

<!-- verify: the canvas and files branch adds save in place, Save as and a truthful unsaved mark -->

## See also

- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [Starting a new project](New-Project.md)
- [Notes and descriptions](Notes-And-Descriptions.md)
- [File formats](../reference/File-Formats.md)
