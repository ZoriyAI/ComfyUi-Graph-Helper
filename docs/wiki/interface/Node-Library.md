[Русский](Node-Library.ru.md)
[Home](../Home.md) › [The window](README.md)

# Nodes in the library

The **Nodes** tab of the library lists every node class your ComfyUI has, grouped by category (for example SAMPLING, LOADERS, or the name of a node pack). From here you read what a node does and put it on the canvas.

<!-- picture: the Nodes tab with a search and one category open -->

## How to find a node

1. Type in **Search nodes**. The list narrows as you type and says how many results there are ("3 results").
2. Node names are in English, for example sampler, load or save. Russian words such as «сэмплер» work too.
3. **Clear search** (the cross in the field) shows everything again.
4. A category header folds and opens its group. With the keyboard: `Left` folds, `Right` opens.

Each row shows the readable name, then the class name and the pack it comes from. The dot on the left is bright when the node's inputs and outputs are known; a dim dot means "Only the name is known; sync reads the ports".

## How to add a node from here

- Drag the row onto the canvas. While you drag, the canvas says "Drop to add it to the graph".
- Double-click the row: the node goes to the middle of the view.
- With the keyboard: move to the row and press `Enter`.
- Or open the card (one click, or `Space`) and press **Add to canvas**.

After adding, a message says "Added KSampler to the graph."

## What can go wrong

- "No node found. No node matches “…”." Try the English word or a part of the name.
- "The node was not added." The canvas refused the change; the message under it says why.
- A node with a dim dot is added without its inputs and outputs: "The inputs and outputs of this node are not known yet: start ComfyUI and sync". They appear after a sync.

## See also

- [The node card](Node-Card.md)
- [Adding nodes](../graph/Adding-Nodes.md)
- [Node packs](../concepts/Node-Packs.md)
- [The library](Library.md)
