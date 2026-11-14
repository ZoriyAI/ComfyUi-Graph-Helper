[Русский](Canvas-Menus.ru.md)
[Home](../Home.md) › [The window](README.md)

# Canvas menus

A right-click on the canvas opens a menu for what is under the pointer: a node, an input or output, a link, a group or an empty place. The upper part, under the caption **Ask the assistant**, sends a question to the assistant about that object. The lower part changes the graph. With the keyboard: `Shift+F10` or the menu key on the focused object.

## On a node

| Item | What it does |
|---|---|
| **What is this?** | Asks "What is the node "…" for?" |
| **Why is it here?** | Asks why the node is in this graph. |
| **What comes next?** | Asks what should come after it. |
| **Explain the ports** | Asks to explain its inputs and outputs. |
| **Tour from here** | Starts the tour of the graph at this node. |
| **Open subgraph** / **Dissolve subgraph** | Only on a subgraph block: go inside, or put its nodes back on the canvas. |
| **Make a subgraph from selection** (`Ctrl+G`) | Folds this node, or all selected nodes when it is one of them, into a subgraph. |
| **Group selection** | Draws a group around this node or the selection. |
| **Rename…** | Opens Properties with the field **Name on the canvas**. |
| **Note for this node…** | Opens Properties at **Purpose**, to write what the node is for. |
| **Delete node** (`Delete`) | Removes the node with its links. |

## On an input or output

| Item | What it does |
|---|---|
| **What connects here?** (input) | Lights up the outputs that fit and asks what to connect. |
| **Where does this go?** (output) | Lights up the inputs that fit and asks where it usually goes. |
| **What type is this?** | Asks about the data type, for example LATENT. |
| **Suggest a connection** | Lights up what fits, without asking. `Enter` connects to the best one: "Enter connects to KSampler. Escape cancels." |
| **Expose as subgraph input** / **output** | Inside an open subgraph: makes this port an input or output of the subgraph. |
| **Remove this subgraph input or output** | On the edge of an open subgraph. |

## On a link

**What flows here?**, **Why is it connected like this?**, and **Disconnect**.

## On a group

**What is this group for?** and **Remove group** (the nodes stay).

## On an empty place

**Add node…** (the search opens at that spot), **Insert subgraph** ▸ the subgraphs of the project ("No subgraphs yet" when there are none), **Show the assistant’s suggestions** (moves the view to the grey drafts), **Accept all suggestions** (with two or more), **Fit to view**.

## See also

- [The canvas](Canvas.md)
- [Connecting nodes](../graph/Connecting-Nodes.md)
- [Ask](../assistant/Ask.md)
- [Subgraphs](../graph/Subgraphs.md)
