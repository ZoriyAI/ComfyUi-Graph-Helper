[Русский](Select-And-Move.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Selecting and moving

Most edits act on what is selected: delete, make a subgraph, group, arrange, ask about the selection. This page says how to select nodes and links and how to move nodes.

## How to select

| You want | Do this |
|---|---|
| one node or one link | click it |
| add a node to the selection, or take it out | `Ctrl`+click |
| several nodes in an area | hold `Shift` and drag a box over an empty place |
| every node on the level on screen | **Edit ▸ Select all**, `Ctrl+A` |
| nothing | click an empty place |

The status bar says how many are selected ("2 selected"). With one node selected, [Properties](../interface/Properties.md) shows it; with several, "Shared edits are not available. Select one node to see its ports."

## How to move

- Drag a node by its header. Selected nodes move together.
- With the keyboard: `Tab` to the node, `Enter` or `Space` to select it, then the arrow keys. The app says the new position for a screen reader.
- **Arrange** lays the selection out for you. See [Arranging the graph](Arranging.md).

Each finished move is a step of the history and can be undone.

## How to delete

Select and press `Delete` or `Backspace` while the cursor is on the canvas, or **Edit ▸ Delete selection**, or right-click a node ▸ **Delete node**. A node goes with its links.

## Limits

- Moving several nodes makes one step per node in the history, so undo takes them back one by one.
- Deleting several nodes is undone one node at a time too.

<!-- verify: the canvas and files branch makes a multi-move and a multi-delete one step each and adds Shift+click selection -->

## See also

- [The canvas](../interface/Canvas.md)
- [Edit menu](../interface/Edit-Menu.md)
- [History and undo](History-And-Undo.md)
- [Copy and paste](Copy-And-Paste.md)
