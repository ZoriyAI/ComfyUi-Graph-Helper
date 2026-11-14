[Русский](Adding-Nodes.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Adding nodes

There are seven ways to put a node on the canvas. Whichever you use, the node gets the same name, and lands on a free spot, never on top of another node. (A node added from a model card is also selected.)

## The ways

| Way | How | Where it lands |
|---|---|---|
| The node search | **Node** on the canvas toolbar, **Graph ▸ Add node…** or `Ctrl+K`. Type, move with `Up` / `Down`, press `Enter`. `Escape` closes it. | the middle of the view |
| A double click | Double-click an empty place of the canvas: the search opens there. | where you clicked |
| The canvas menu | Right-click an empty place ▸ **Add node…**. | where you clicked |
| Drag from the library | Drag a row of **Nodes** onto the canvas ("Drop to add it to the graph"). | where you drop it |
| The library, double click or Enter | Double-click a row of **Nodes**, or go to it with the keyboard and press `Enter`. | the middle of the view |
| The node card | Click a row, then **Add to canvas**. | the middle of the view |
| A model | In **Models**, drag a file onto the canvas, or open its card and press **Add to canvas**: the right loader node comes with the file already chosen. | where you drop it, or the middle |

The search shows up to 12 matches and marks the typed words in the names. It searches only your ComfyUI: "No matching nodes" when nothing fits.

The assistant can also add nodes: in Build mode, or as a grey draft you accept. See [Build](../assistant/Build.md) and [Grey drafts](../assistant/Drafts.md).

## Inside a subgraph

All of these work inside an open subgraph too: the node goes into the subgraph. See [Subgraphs](Subgraphs.md).

## What can go wrong

- "Unknown node class … Did you mean: …?" The name is not in your ComfyUI; pick one of the suggestions.
- "The inputs and outputs of this node are not known yet: start ComfyUI and sync". The node is added, but bare; sync to get its inputs, outputs and fields.
- During a history replay nothing can be added.

<!-- verify: the editing and search branch adds Note, Reroute and Primitive, inserting a node into a link, replacing a node and marks in the search -->

## See also

- [Nodes in the library](../interface/Node-Library.md)
- [The node card](../interface/Node-Card.md)
- [Connecting nodes](Connecting-Nodes.md)
- [Arranging the graph](Arranging.md)
