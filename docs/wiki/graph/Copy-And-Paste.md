[Русский](Copy-And-Paste.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Copy and paste

You can copy, cut, paste and duplicate nodes on the canvas. Copied nodes keep their values and the links between them.

## Where to find it

| Command | Keys | Where else |
|---|---|---|
| **Edit ▸ Copy** | `Ctrl+C` | right-click a node ▸ **Copy** |
| **Edit ▸ Cut** | `Ctrl+X` | right-click a node ▸ **Cut** |
| **Edit ▸ Paste** | `Ctrl+V` | right-click an empty place ▸ **Paste** |
| **Edit ▸ Duplicate** | `Ctrl+D` | right-click a node ▸ **Duplicate** |

On a Mac, `Ctrl` is `Cmd`. Copy, Cut and Duplicate need at least one selected node. A right-click on a node that is not selected selects that node first.

## How it works

1. Select the nodes (a click, `Shift`+click or `Ctrl`+click to add more, or a box).
2. Copy or cut them.
3. Paste. After Copy, the pasted nodes appear 40 pixels further down and to the right. After Cut, the first paste puts them back where they were. Each further paste moves another 40 pixels on, so the copies do not land on top of each other. Duplicate puts the copy 40 pixels on at once.
4. The pasted nodes are selected, so you can move them at once.

- Pasted nodes get new numbers. They keep their field values and the links between them. Links to nodes that were not copied are not pasted.
- Paste works inside a subgraph too.
- A paste, a cut or a duplicate is one step of the history: one `Ctrl+Z` undoes it. The undo list names it, for example "pasting 3 nodes".

## What the clipboard keeps

The app keeps copied nodes in its own clipboard, not in the system clipboard. You cannot paste them into ComfyUI or another program.

- The clipboard survives **File ▸ New project** and opening another workflow. Use that to move a part of one graph into another.
- It is empty after the app is closed and started again.
- In a text field, `Ctrl+C` and `Ctrl+V` copy and paste text, as usual.

## Moving nodes out of an old workflow

A workflow in the old ComfyUI format (0.4) cannot hold subgraphs. To make subgraphs from its nodes, select them, copy them, start a new project and paste them there. See [Subgraphs](Subgraphs.md).

## See also

- [Selecting and moving](Select-And-Move.md)
- [History and undo](History-And-Undo.md)
- [Subgraphs](Subgraphs.md)
- [Edit menu](../interface/Edit-Menu.md)
