[Русский](Library.ru.md)
[Home](../Home.md) › [The window](README.md)

# The library

The library is the panel on the left. It shows what your ComfyUI has and what this project holds, in three tabs: **Nodes**, **Models** and **Subgraphs**. Everything in it comes from reading your ComfyUI; reading changes nothing there.

## The tabs

| Tab | What it lists | Page |
|---|---|---|
| **Nodes** | every node class of your ComfyUI, grouped by category, and the four editor nodes Note, Markdown Note, Reroute and Primitive | [Nodes in the library](Node-Library.md) |
| **Models** | your model files, with their kind and family | [Models in the library](Model-Library.md) |
| **Subgraphs** | the subgraphs of this project | [Subgraphs in the library](Subgraph-Library.md) |

## How to open and fold it

- **Collapse library** (the icon at the top right of the panel), **View ▸ Library** or `Ctrl+B` folds it to a strip of icons.
- In the strip, **Expand library** opens it again; the icons of the three tabs open it on that tab.
- In a window narrower than 1180 pixels the library starts folded.

## When it is empty

- Before your ComfyUI is read: "Your ComfyUI is not read yet. The nodes of your ComfyUI appear here once the app reads it. Reading changes nothing in ComfyUI." with a button to read it.
- Without an address: "The nodes of your ComfyUI appear here. Tell the app the address of your ComfyUI first; then it reads which nodes you have." with **Open connection settings**. The address is the one you open ComfyUI at in the browser; an MCP server is optional. See [Connecting](../connect/Connecting.md).
- "The library could not be read." if the app's own data could not be read.

## See also

- [The node card](Node-Card.md)
- [The model card](Model-Card.md)
- [The sync indicator](Sync-Indicator.md)
- [Connecting](../connect/Connecting.md)
