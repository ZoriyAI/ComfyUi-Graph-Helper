[Русский](Canvas-Menus.ru.md)
[Home](../Home.md) › [The window](README.md)

# Canvas menus

A right-click on the canvas opens a menu for what is under the pointer: a node, an input or output, a link, a group or an empty place. A right-click on a node that is not selected selects it first. The upper part, under the caption **Ask the assistant**, sends a question to the assistant about that object. The lower part changes the graph. With the keyboard: `Shift+F10` or the menu key on the focused object.

## On a node

| Item | What it does |
|---|---|
| **What is this?** | Asks "What is the node "…" for?" |
| **Why is it here?** | Asks why the node is in this graph. |
| **What comes next?** | Asks what should come after it. |
| **Explain the inputs and outputs** | Asks to explain its inputs and outputs. |
| **Tour from here** | Starts the tour of the graph at this node. |
| **Open subgraph** / **Dissolve subgraph** | Only on a subgraph block: go inside, or put its nodes back on the canvas. |
| **Copy** (`Ctrl+C`), **Cut** (`Ctrl+X`), **Duplicate** (`Ctrl+D`) | Copy, cut or duplicate this node, or the selection when it is one of them. See [Copy and paste](../graph/Copy-And-Paste.md). |
| **Make a subgraph from selection** (`Ctrl+G`) | Folds this node, or all selected nodes when it is one of them, into a subgraph. |
| **Make a group from selection** (`Ctrl+Shift+G`) | Draws a group around this node or the selection. |
| **Rename…** | Opens Properties with the field **Name on the canvas**. |
| **Note for this node…** | Opens Properties at **Purpose**, to write what the node is for. |
| **Collapse** / **Expand** (`Alt+C`) | Folds the node to its title row, or opens it again. |
| **Go to its Set** / **Go to its Get** | On a Get or Set node: shows its partner. |
| **Bypass** (`Ctrl+Shift+B`), **Mute** (`Ctrl+M`) | ComfyUI skips the node, or does not run it at all. A tick shows the current state. See [Bypass and mute](Node.md#bypass-and-mute). |
| **Color** ▸ | One of ComfyUI's colours, or **No color**. |
| **Replace with…** | Puts another node in its place. Not on a subgraph, a note, a reroute or a primitive. |
| **Add to group** ▸ / **Take out of group** | Puts the node into a group or takes it out (on the displayed level). See [Groups](../graph/Groups.md). |
| **Delete node** (`Delete`) | Removes the node with its links. |

## On an input or output

| Item | What it does |
|---|---|
| **What connects here?** (input) | Lights up the outputs that fit and asks what to connect. |
| **Where does this go?** (output) | Lights up the inputs that fit and asks where it usually goes. |
| **What type is this?** | Asks about the data type, for example LATENT. |
| **Suggest a link** | Lights up what fits, without asking. `Enter` connects to the best one: "Enter links to KSampler. Esc cancels." |
| **Expose as subgraph input** / **output** | Inside an open subgraph: makes this port an input or output of the subgraph. |
| **Remove this subgraph input or output** | On the edge of an open subgraph. |

## On a link

**What flows here?**, **Why is it connected like this?**, **Insert node…** (puts a node on the link), **Add routing point**, **Add legacy Reroute node** and **Disconnect**. On touch screens, tap the link to open this menu. Tap a routing point for its own menu; removing it keeps the links. Arrow keys move a focused point; Shift uses a larger step.

## On a group

**What is this group for?**, **Color** ▸ and **Remove group** (the nodes stay).

## On an empty place

**Add node…** (the search opens at that spot), **Paste** (`Ctrl+V`), **Add note**, **Insert subgraph** ▸ the subgraphs of the project ("No subgraphs yet" when there are none), **Show the assistant’s suggestions** (moves the view to the grey drafts), **Accept all suggestions** and **Reject all suggestions** (with two or more), **Fit to view**.

## See also

- [The canvas](Canvas.md)
- [Connecting nodes](../graph/Connecting-Nodes.md)
- [Ask](../assistant/Ask.md)
- [Subgraphs](../graph/Subgraphs.md)
