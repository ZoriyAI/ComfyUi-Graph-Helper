[Русский](Arranging.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Arranging the graph

**Arrange the graph** lays the nodes out from left to right, in the order the data flows, so nothing overlaps. It is one step of the history: one undo puts every node back where it was.

## How to arrange

1. Press **Arrange** on the canvas toolbar, choose **Graph ▸ Arrange the graph**, or press `Ctrl+Shift+L`.
2. With two or more nodes selected, only those are arranged; the rest stay.
3. The view then fits what was arranged. When the graph almost fits, the canvas keeps the cards readable.
4. Not what you wanted: `Ctrl+Z`.

It works on the level on screen: the main graph, or the inside of an open subgraph.

## Where new nodes land

A new node goes where you asked (the drop point or the double click) or to the middle of the view, then moves to the nearest free spot so it covers no node. After a build of the assistant the canvas tidies the new nodes and fits the view.

## Moving by hand

Drag a node by its header. With the keyboard, select it and use the arrow keys. Each finished move is one step of the history. See [Selecting and moving](Select-And-Move.md).

## Groups

A group's frame is drawn around its nodes, so it follows them when they are arranged. Arranging keeps nodes clear of the frames and title bands of groups they do not belong to. Drag a group by its title to move it with its nodes, in one step. See [Groups](Groups.md).

## Limits

- **Arrange** is grey during a history replay and on an empty level.

## See also

- [Selecting and moving](Select-And-Move.md)
- [Groups](Groups.md)
- [The canvas toolbar](../interface/Canvas-Toolbar.md)
- [History and undo](History-And-Undo.md)
