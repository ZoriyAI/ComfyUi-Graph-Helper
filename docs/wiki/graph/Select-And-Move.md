[Русский](Select-And-Move.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Selecting and moving

Most edits act on what is selected: delete, make a subgraph, group, arrange, ask about the selection. This page says how to select nodes and links and how to move nodes.

## How to select

| You want | Do this |
|---|---|
| one node or one link | click it |
| add a node to the selection, or take it out | `Shift`+click or `Ctrl`+click |
| several nodes in an area | hold `Shift` and drag a box over an empty place |
| every node on the level on screen | **Edit ▸ Select all**, `Ctrl+A` |
| nothing | click an empty place |

The status bar says how many are selected ("2 selected"). With one node selected, [Properties](../interface/Properties.md) shows it; with several, "Shared edits are not available. Select one node to see its inputs and outputs."

## How to move

- Drag a node by its header. Selected nodes move together.
- With the keyboard: the arrow keys move the selected nodes; with `Shift` they move farther. To reach a node, `Tab` to it and press `Enter` or `Space` to select it. The app says the new position for a screen reader.
- With nothing selected, the arrow keys move the view instead: 80 pixels, or 400 with `Shift`.
- **Arrange** lays the selection out for you. See [Arranging the graph](Arranging.md).
- Drag a group by its title and its nodes move with it. See [Groups](Groups.md).

Each finished move is one step of the history, however many nodes moved. A burst of arrow presses is one step once the keys rest for about half a second ("moving 3 nodes").

When **View ▸ Pin nodes** is on, nodes cannot be dragged. A chip "Nodes pinned" with **Unpin** shows on the canvas.

## How to delete

Select and press `Delete` or `Backspace` while the cursor is on the canvas, or **Edit ▸ Delete selection**, or right-click a node ▸ **Delete node**. A node goes with its links. Deleting several nodes is one step of the history ("removing 3 items"). With the keyboard, focus then moves to the nearest node.

## See also

- [The canvas](../interface/Canvas.md)
- [Edit menu](../interface/Edit-Menu.md)
- [History and undo](History-And-Undo.md)
- [Copy and paste](Copy-And-Paste.md)
