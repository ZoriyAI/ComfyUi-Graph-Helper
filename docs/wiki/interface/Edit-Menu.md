[Русский](Edit-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# Edit menu

The **Edit** menu undoes and redoes changes of the graph and works on what is selected on the canvas.

## Items

| Item | Shortcut | What it does | Grey when |
|---|---|---|---|
| **Undo** | `Ctrl+Z` | Takes back the last change of the graph. The tooltip of the toolbar button names it, for example "Undo: add KSampler". | there is nothing to undo, or the assistant is still building |
| **Redo** | `Ctrl+Shift+Z` | Puts back what Undo took. | there is nothing to redo |
| **Select all** | `Ctrl+A` | Selects every node on the level that is on screen (the main graph, or the open subgraph). | a history replay is showing, or the level has no nodes |
| **Delete selection** | `Delete` (on the canvas) | Removes the selected nodes and links. `Backspace` works too. | nothing is selected, or a history replay is showing |

## How to undo a change

1. Choose **Edit ▸ Undo** or press `Ctrl+Z` while the cursor is not in a text field.
2. The canvas goes back one step. Press again to go further back.
3. Changed your mind: **Edit ▸ Redo** (`Ctrl+Shift+Z`).

A whole build of the assistant is undone in one step. See [History, undo and replay](../graph/History-And-Undo.md).

## What the app says

- "Nothing to undo" / "Nothing to redo" in the tooltip of a grey button.
- "The assistant is still building. Stop it to undo."
- "This build is too old to undo in one step: the version of the graph before it is no longer kept."

## Limits

- The `Delete` key acts only on the canvas: in a text field it deletes letters.
- On a graph of many hundreds of nodes an undo can take a second or more.

<!-- verify: the canvas and files branch makes a multi-node move and a multi-delete one step each and adds copy, cut, paste and duplicate to this menu -->

## See also

- [History, undo and replay](../graph/History-And-Undo.md)
- [Selecting and moving](../graph/Select-And-Move.md)
- [Copy and paste](../graph/Copy-And-Paste.md)
- [Toolbar](Toolbar.md)
