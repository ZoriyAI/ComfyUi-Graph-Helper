[Русский](Project-Files.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Project files

A project file (`.nodewise.json`) keeps the graph together with everything the app knows about it: the explanations of nodes and links, your notes and descriptions, the purpose of each node, the title and notes of the graph. Open it later and all of it comes back. ComfyUI cannot open a project file; for ComfyUI save a [workflow](Saving-Workflows.md).

## How to save a project

1. **File ▸ Save project** (`Ctrl+S`) or **Save** on the toolbar.
2. If a field looks like a key or a token, the app asks first, as it does for a workflow: **Save without these values** or **Save as it is**.
3. The first time, choose the place and the name in **Save the project**, then **Save**. The app suggests the title of the graph with `.nodewise.json`, and adds the ending if the name you type has none. "Project saved."

After that, **Save project** (`Ctrl+S`) writes to the same file without asking. **File ▸ Save project as…** (`Ctrl+Shift+S`) always asks for a place and a name. If a field looks like a key, the question about it comes even for a save to the same file.

## The unsaved mark

A dot after the project name in the top bar means the graph on the canvas is not in a project file as it stands. Its tooltip: "Not in a project file as it stands. The app keeps the graph between runs anyway; Save project writes it to a file you can keep or pass on."

- The dot goes away after a save, and also when you undo back to what the file holds.
- It survives a restart.
- The app does not ask anything when you close the window: the graph comes back at the next start.
- **New project**, **Open project** and **Open workflow** ask first while the dot is there.

## How to open a project

1. **File ▸ Open project** (`Ctrl+O`) or **Open** on the toolbar.
2. Choose a file of the type **NodeWise Studio project**. "Project opened."

You can also drop a project file on the window, use **File ▸ Open recent**, or name it on the command line. The graph replaces the canvas; it is one step of the history. Explanations and notes that came with a file you opened carry the badge **From the file**.

A project file from version 0.9 opens too; **Save project** writes it back under its own name.

## What is in the file

The graph in ComfyUI's own form, plus the explanations, the component records (purpose, how to use) and the title and notes. The chat and the settings are not in it. Keys never are.

## What can go wrong

- "This file is not a NodeWise Studio project."
- "This project file version is not supported (3). Update the app to open it."
- "The project file is damaged. Open another copy of the project."
- "The project file has the same description twice. Open another copy of the project."
- "The project file could not be written." The file is written whole or not at all.
- "This file is protected from writing. Choose another name, or allow writing to it in its properties."

## Do I need a project file?

The app keeps the graph on the canvas by itself: close and open the app, and it is there. A project file is for a copy you keep or share, and for working on more than one graph.

## See also

- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [Starting a new project](New-Project.md)
- [Notes and descriptions](Notes-And-Descriptions.md)
- [File formats](../reference/File-Formats.md)
