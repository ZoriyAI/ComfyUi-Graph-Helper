[Русский](Edit-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# Edit menu

The **Edit** menu undoes and redoes changes of the graph and works on what is selected on the canvas.

## Items

| Item | Shortcut | What it does | Grey when |
|---|---|---|---|
| **Undo** | `Ctrl+Z` | Takes back the last change of the graph. The tooltip of the toolbar button names it, for example "Undo: add KSampler". | there is nothing to undo, or the assistant is still building |
| **Redo** | `Ctrl+Shift+Z` or `Ctrl+Y` | Puts back what Undo took. | there is nothing to redo |
| **Cut** | `Ctrl+X` | Removes the selected nodes and keeps them in the app's clipboard. | nothing is selected, or a history replay is showing |
| **Copy** | `Ctrl+C` | Keeps the selected nodes in the app's clipboard. | nothing is selected |
| **Paste** | `Ctrl+V` | Puts the copied nodes on the canvas, selected. | the clipboard is empty, or a history replay is showing |
| **Duplicate** | `Ctrl+D` | Copies the selected nodes and pastes them at once, 40 pixels further. | nothing is selected, or a history replay is showing |
| **Select all** | `Ctrl+A` | Selects every node on the level that is on screen (the main graph, or the open subgraph). | a history replay is showing, or the level has no nodes |
| **Delete selection** | `Delete` (on the canvas) | Removes the selected nodes and links. `Backspace` works too. | nothing is selected, or a history replay is showing |

## How to undo a change

1. Choose **Edit ▸ Undo** or press `Ctrl+Z` while the cursor is not in a text field.
2. The canvas goes back one step. Press again to go further back.
3. Changed your mind: **Edit ▸ Redo** (`Ctrl+Shift+Z`).

The steps the assistant made one after another are undone in one step. Deleting, pasting, cutting or duplicating several nodes, and moving several nodes, are one step each too. See [History, undo and replay](../graph/History-And-Undo.md) and [Copy and paste](../graph/Copy-And-Paste.md).

On a Mac, `Ctrl` is `Cmd`.

## What the app says

- "Nothing to undo" / "Nothing to redo" in the tooltip of a grey button.
- "The assistant is still building. Stop it to undo."
- "This build is too old to undo in one step: the version of the graph before it is no longer kept."

## Limits

- The `Delete` key acts only on the canvas: in a text field it deletes letters.
- On a graph of many hundreds of nodes an undo can take a second or more.

## See also

- [History, undo and replay](../graph/History-And-Undo.md)
- [Selecting and moving](../graph/Select-And-Move.md)
- [Copy and paste](../graph/Copy-And-Paste.md)
- [Toolbar](Toolbar.md)
