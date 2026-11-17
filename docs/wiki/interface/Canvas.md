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
- **Keys**: with nothing selected, the arrow keys move the view by 80 pixels, or 400 with `Shift`.
- The status bar shows the zoom: "Zoom 60%".

When the graph first appears, or when you enter a subgraph, the canvas fits the graph by itself, never above 100 %. After **Fit to view**, after opening a workflow and after a build, the canvas keeps the cards readable when the graph almost fits; a large graph opens at no less than 30 %. The view glides to where it goes: a short hop takes about a quarter of a second, a long trip about two thirds. With motion reduced or off it jumps. See [Settings ▸ Appearance & Motion](Settings-Appearance.md#motion).

## Zoomed-out graphs

Nodes become smaller with the graph, but keep their inputs, outputs and settings visible. Zooming does not collapse them to titles. Explicitly collapsing a node remains a separate action. Group names retain a readable size, and missing nodes keep their dashed frame.

## How to select

- Click a node or a link. The [Properties](Properties.md) tab shows what you selected.
- `Shift`+click or `Ctrl`+click adds a node to the selection or takes it out.
- `Shift`+drag on an empty place draws a box: every node inside is selected.
- **Edit ▸ Select all** (`Ctrl+A`) selects every node on the level that is on screen.
- A click on an empty place clears the selection.

With the keyboard: `Tab` reaches the nodes, `Enter` or `Space` selects one, the arrow keys move it, `Delete` or `Backspace` removes it and the focus goes to the nearest node, `Ctrl+Z` undoes. A link can be reached with `Tab` once one of its nodes is selected. To link by keyboard, `Tab` to an input or output of a selected node, press `Shift+F10`, choose **Suggest a link**, then `Enter`. `F6` moves between the canvas and the other parts of the window.

## The minimap

The small picture in the bottom right corner shows the whole graph; the frame is what you see now. Each node is drawn in the colour of its main data type. Turn it off in **View ▸ Minimap** or Settings ▸ Canvas. It appears only when the graph has nodes.

- A click on the minimap centres the view there.
- Drag on it to move the view, and turn the wheel over it to zoom.

## A double click

A double click on an empty place opens the node search at that spot. See [Adding nodes](../graph/Adding-Nodes.md).

## Pinned nodes

**View ▸ Pin nodes** keeps every node where it is: nodes cannot be dragged, but fields, links and the view still work. A chip **Nodes pinned** with **Unpin** shows on the canvas while it is on.

## What moves on the canvas

How much moves depends on **Motion** in [Settings ▸ Appearance & Motion](Settings-Appearance.md#motion). With motion on:

- In a lesson, the place the current step is about stands out and the rest of the graph dims. When a step is passed, what passed it flashes and the view goes to the next place.
- During a tour of the graph, the node of the step and the nodes feeding it stand out; the rest dims.
- After a check, a wave runs from left to right over the nodes the check marked.
- A grey draft that lands off screen is brought into view. Accepted, it turns into the node; rejected, it dissolves.
- While a link is dragged, a dashed line shows the best input for it.
- **Show me where** and **Show** ring the node the view arrives at.
- A deleted node fades where it stood.

## The dots

The dots in the background are a grid. Their spacing is set in [Settings ▸ Canvas](Settings-Canvas.md) (**Grid spacing, px**, 18 by default). Nodes do not snap to it.

## What can go wrong

- "That edit was not applied. The graph changed first; the canvas shows the current graph." The assistant or another step changed the graph a moment earlier; do the edit again.
- During a history replay nothing can be changed. See [History and undo](../graph/History-And-Undo.md).
- A number typed into a field outside its range is changed, and the app says why, for example "The smallest allowed is 1; set to 1.". Text that is not a number is refused.
- A node your ComfyUI does not have shows "Not installed" and its saved values, once a node list has been read. See [A node on the canvas](Node.md).
- On a graph of about 1000 nodes, dragging and zooming are slow (about 5 frames a second). The app opens graphs of up to 1500 nodes and 3000 links.

## See also

- [The canvas toolbar](Canvas-Toolbar.md)
- [Canvas menus](Canvas-Menus.md)
- [A node on the canvas](Node.md)
- [Selecting and moving](../graph/Select-And-Move.md)
- [Settings: Canvas](Settings-Canvas.md)

For graphs above 200 nodes, off-screen cards are rendered when you reach them. All nodes remain in the document and export. A typed field is committed before moving the camera. [Measured large-graph behavior](https://github.com/ZoriyAI/nodewise-studio/blob/main/docs/research/2026-11-17-large-canvas.md).
