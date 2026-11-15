[Русский](Graph-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# Graph menu

The **Graph** menu changes and explains the graph: adding nodes, laying them out, subgraphs and groups, bypass, mute and colours, a node on a link, replacing a node, notes, the check, a ComfyUI error, the assistant's suggestions, the tour and the history.

## Items

| Item | Shortcut | What it does | Grey when |
|---|---|---|---|
| **Add node…** | `Ctrl+K` | Opens the node search in the middle of the canvas. See [Adding nodes](../graph/Adding-Nodes.md). | a history replay is showing |
| **Arrange the graph** | `Ctrl+Shift+L` | Lays the graph out from left to right so nothing overlaps. With two or more nodes selected, only those. One undo puts it back. See [Arranging the graph](../graph/Arranging.md). | the level on screen has no nodes, or a replay is showing |
| **Make a subgraph from selection** | `Ctrl+G` | Folds the selected nodes into one subgraph block. See [Subgraphs](../graph/Subgraphs.md). | nothing is selected, a subgraph is open, or a replay is showing |
| **Dissolve subgraph** | none | Puts the nodes of the selected subgraph block back on the canvas. | not exactly one subgraph block is selected |
| **Make a group from selection** | `Ctrl+Shift+G` | Draws a named frame around the selected nodes. See [Groups](../graph/Groups.md). | nothing is selected, a subgraph is open, or a replay is showing |
| **Bypass** | `Ctrl+Shift+B` | ComfyUI skips the selected nodes: what comes into a node goes straight out to its output of the same type. A tick shows when all selected nodes are bypassed; choose it again to make them run. Notes are skipped. See [A node on the canvas](Node.md#bypass-and-mute). | a replay is showing |
| **Mute** | `Ctrl+M` | ComfyUI does not run the selected nodes at all; nodes that need their result get nothing. It toggles the same way. | a replay is showing |
| **Color** ▸ **Red** / **Brown** / **Green** / **Blue** / **Pale blue** / **Cyan** / **Purple** / **Yellow** / **Black** / **No color** | none | Colours the selected nodes with ComfyUI's own palette, so ComfyUI shows the colour too. | a replay is showing |
| **Insert node…** | none | Places a node on the one selected link. See [Adding nodes](../graph/Adding-Nodes.md#put-a-node-on-a-link). | a replay is showing |
| **Replace with…** | none | Puts another node in the place of the one selected node, keeping the links and values that fit. | a replay is showing |
| **Add note** | none | Puts a note on the canvas, for you and for anyone who opens the workflow in ComfyUI. | a replay is showing |
| **Check graph** | `Ctrl+Shift+C` | Opens the **Check** tab and checks the graph against your ComfyUI. Works everywhere, even in a text field. See [Checking a graph](../graph/Checking-A-Graph.md). | never |
| **Explain a ComfyUI error…** | none | Opens the card where you paste an error from ComfyUI. See [An error in ComfyUI](../graph/ComfyUI-Errors.md). The same item is in the Help menu. | never |
| **Accept all suggestions** | none | Accepts every grey draft of the assistant, one after another. See [Grey drafts](../assistant/Drafts.md). | there are no open suggestions |
| **Reject all suggestions** | none | Rejects every grey draft at once. | there are no open suggestions |
| **Guided tour** | none | Starts or ends the [tour of the graph](../graph/Tour.md). A tick means a tour is running. | the graph is empty, or a replay is showing |
| **Replay history** | none | Shows the earlier versions of the graph, read-only. A tick means the replay is showing. See [History and undo](../graph/History-And-Undo.md). | never |

## Good to know

- Making a subgraph, dissolving one and grouping work only on the main canvas. Inside an open subgraph these items are grey.
- Bypass, Mute, Color and Replace with… need at least one selected node, and Insert node… needs one selected link. Otherwise the app says "Select one or more nodes first.", "Select one link first." or "Select one node first."
- `Ctrl+B` is not Bypass: it opens and folds the library.
- During a history replay the canvas is read-only, so every item that changes the graph is grey. Leave the replay with `Escape` or by choosing **Replay history** again.

## See also

- [The canvas toolbar](Canvas-Toolbar.md)
- [Canvas menus](Canvas-Menus.md)
- [Subgraphs](../graph/Subgraphs.md)
- [Checking a graph](../graph/Checking-A-Graph.md)
