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

## The node search

- While nothing is typed, the nodes you added last come first.
- The search shows up to 30 matches and marks the typed words in the names. Under each result is one line on what the node does.
- It finds a node by what it does, not only by its name: "remove background" or "картинка из текста" finds nodes whose description or built-in explanation says so. Matches in a name come first. Small words such as "to" or "из" do not count, and in a query of several words one word may miss.
- `in:IMAGE` keeps only nodes with an input of that type, `out:LATENT` only nodes with an output of that type (also `вход:` and `выход:`).
- It searches only your ComfyUI: "No matching nodes" when nothing fits.

Marks beside a name:

| Mark | Meaning |
|---|---|
| **Paid** | Runs on an outside service: ComfyUI asks you to sign in to your Comfy account and charges for each run. |
| **Outdated** | Its pack marks it as outdated: a newer node does this job. |
| **Experimental** | Its pack marks it as experimental: it may change or go away. |
| **Result** | Saves or shows a result. ComfyUI runs a graph only when it has such a node. |

A paid node shows **Paid** on the canvas too.

## Notes, Reroute and Primitive

Four nodes belong to the editor of ComfyUI, not to a pack, and are always in the search and the library: **Note**, **Markdown Note**, **Reroute** and **Primitive**. ComfyUI does not run them.

- **Note**: **Graph ▸ Add note** or right-click an empty place ▸ **Add note**. Double-click the note or press `Enter` to write. `Ctrl+Enter` or a click elsewhere saves, `Escape` cancels. An empty note says "Write a note…". See [Notes and descriptions](Notes-And-Descriptions.md).
- **Reroute**: carries a link to another place on the canvas, to keep long links tidy. Right-click a link ▸ **Add legacy Reroute node** puts one on it. For native link points, use **Add routing point** instead.
- **Primitive**: holds one value and gives it to the field it is linked to. It connects only to a field, not to a link input: "A Primitive feeds a field only, not a link input."

## Put a node on a link

Select one link, then **Graph ▸ Insert node…**, or right-click the link ▸ **Insert node…**. The search opens with the heading "Node to place on the link (TYPE)" and only nodes that fit. The node goes between the two ends: what the link carries goes into it and its result goes on. It is one step of the history.

If the node does not fit: "This node has no input for what the link carries. Choose another node." or "This node has no output that fits where the link goes. Choose another node."

## Drop a link on an empty place

Drag a link from a port and let go on an empty place of the canvas. The search opens with only the nodes that fit. The node you pick is added already linked, in one step. See [Connecting nodes](Connecting-Nodes.md).

## Replace a node

Select one node, then **Graph ▸ Replace with…**, or right-click it ▸ **Replace with…**. The search opens with the heading "Node to put in place of “name”". The new node takes the place of the old one and keeps the links and values that fit. The app says "Replaced with …", and "Links that did not fit the new node were removed: N." when some were dropped. It is one step of the history.

- "Subgraphs, notes, reroutes and primitives cannot be replaced by another node."
- "The node already is of that kind."

The assistant can also add nodes: in Build mode, or as a grey draft you accept. See [Build](../assistant/Build.md) and [Grey drafts](../assistant/Drafts.md).

## Inside a subgraph

All of these work inside an open subgraph too: the node goes into the subgraph. See [Subgraphs](Subgraphs.md).

## What can go wrong

- "Unknown node class … Did you mean: …?" The name is not in your ComfyUI; pick one of the suggestions.
- "The inputs and outputs of this node are not known yet: start ComfyUI and sync". The node is added, but bare; sync to get its inputs, outputs and fields.
- "This node is not in your ComfyUI, so it cannot be placed here." Insert and Replace take only nodes your ComfyUI has.
- During a history replay nothing can be added.

## See also

- [Nodes in the library](../interface/Node-Library.md)
- [The node card](../interface/Node-Card.md)
- [Connecting nodes](Connecting-Nodes.md)
- [Arranging the graph](Arranging.md)
- [Notes and descriptions](Notes-And-Descriptions.md)
