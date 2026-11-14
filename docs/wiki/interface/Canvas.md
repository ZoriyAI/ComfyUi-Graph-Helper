[Русский](Canvas.ru.md)
[Home](../Home.md) › [The window](README.md)

# The canvas

The canvas is the middle of the window, where the graph lives: nodes, the links between them, groups, description cards and the assistant's grey drafts. This page is about moving around on it, zoom, selection and the minimap. What you can do with the graph itself is in [Working with a graph](../graph/Working-With-A-Graph.md).

<!-- picture: a seven-node graph on the canvas with the toolbar above and the minimap in the corner -->

## How to move around

- **Pan**: drag an empty place of the canvas with the mouse.
- **Zoom**: turn the mouse wheel, or pinch on a touchpad. The zoom goes from 10 % to 200 %.
- **Fit**: **View ▸ Fit to view** (`Shift+1`) or the four-corner button on the [canvas toolbar](Canvas-Toolbar.md) shows the whole graph.
- **100 %**: **View ▸ Actual size** (`Ctrl+0`) or a click on the percent number on the canvas toolbar.
- The status bar shows the zoom: "Zoom 60%".

When the graph first appears, or when you enter a subgraph, the canvas fits the graph by itself, never above 100 %.

## The overview

Below 50 % the nodes shrink to their titles and their colour, so a large graph reads like a map. Zoom in past the threshold again and the fields come back.

## How to select

- Click a node or a link. The [Properties](Properties.md) tab shows what you selected.
- `Ctrl`+click adds a node to the selection or takes it out.
- `Shift`+drag on an empty place draws a box: every node inside is selected.
- **Edit ▸ Select all** (`Ctrl+A`) selects every node on the level that is on screen.
- A click on an empty place clears the selection.

With the keyboard: `Tab` reaches the nodes, `Enter` or `Space` selects one, the arrow keys move it, `Delete` removes it, `Escape` cancels.

## The minimap

The small picture in the bottom right corner shows the whole graph; the frame is what you see now. Each node is drawn in the colour of its main data type. Turn it off in **View ▸ Minimap** or Settings ▸ Canvas. It appears only when the graph has nodes.

<!-- verify: the canvas and files branch makes a click on the minimap move the view there, and adds Shift+click selection -->

## A double click

A double click on an empty place opens the node search at that spot. See [Adding nodes](../graph/Adding-Nodes.md).

## The dots

The dots in the background are a grid. Their spacing is set in [Settings ▸ Canvas](Settings-Canvas.md) (**Grid spacing, px**, 18 by default). Nodes do not snap to it.

## What can go wrong

- "That edit was not applied. The graph changed first; the canvas shows the current graph." The assistant or another step changed the graph a moment earlier; do the edit again.
- During a history replay nothing can be changed. See [History and undo](../graph/History-And-Undo.md).

## See also

- [The canvas toolbar](Canvas-Toolbar.md)
- [Canvas menus](Canvas-Menus.md)
- [A node on the canvas](Node.md)
- [Selecting and moving](../graph/Select-And-Move.md)
- [Settings: Canvas](Settings-Canvas.md)
