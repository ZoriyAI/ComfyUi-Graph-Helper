[Русский](New-Project.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Starting a new project

**File ▸ New project** (`Ctrl+N`, or **New** on the toolbar) clears the canvas and starts an empty graph. The graph you had is not lost: it stays in the history of versions, and you can save it to a file first.

## How to start

1. Choose **File ▸ New project**.
2. If the canvas holds a graph that is not saved to a project file as it stands, the app asks: "Start a new project? The graph on the canvas is not saved to a project file as it stands. A new project clears the canvas; the current graph stays in the revision history, and Save project keeps it as a file."
3. **Cancel** to go back and save first (**File ▸ Save project**), or **Start new project**.

An empty canvas, or a project you just saved or opened and did not change since, is cleared without asking.

## What a new project keeps

- The canvas is empty, a tour or a replay ends, an open subgraph is left.
- The library, the settings, the assistant and the chat stay.
- The old graph is one step back in the history: `Ctrl+Z` brings it back, and **Graph ▸ Replay history** shows it.

## What happens when you close the app

The graph on the canvas is kept by the app and comes back at the next start, saved or not. A project file is only needed to keep a copy elsewhere, to share it, or to have several projects.

## Limits

Today the empty graph of a new project is in the older workflow format (0.4), so a subgraph cannot be made in it ("Subgraphs need workflow format 1."). See [Subgraphs](Subgraphs.md). <!-- verify: reported to the engineers; remove when fixed -->

## See also

- [Project files](Project-Files.md)
- [History and undo](History-And-Undo.md)
- [File menu](../interface/File-Menu.md)
