[Русский](Graph-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# Graph menu

The **Graph** menu changes and explains the graph as a whole: adding nodes, laying them out, subgraphs and groups, the check, the assistant's suggestions, the tour and the history.

## Items

| Item | Shortcut | What it does | Grey when |
|---|---|---|---|
| **Add node…** | `Ctrl+K` | Opens the node search in the middle of the canvas. See [Adding nodes](../graph/Adding-Nodes.md). | a history replay is showing |
| **Arrange the graph** | `Ctrl+Shift+L` | Lays the graph out from left to right so nothing overlaps. With two or more nodes selected, only those. One undo puts it back. See [Arranging the graph](../graph/Arranging.md). | the level on screen has no nodes, or a replay is showing |
| **Make a subgraph from selection** | `Ctrl+G` | Folds the selected nodes into one subgraph block. See [Subgraphs](../graph/Subgraphs.md). | nothing is selected, a subgraph is open, or a replay is showing |
| **Dissolve subgraph** | none | Puts the nodes of the selected subgraph block back on the canvas. | not exactly one subgraph block is selected |
| **Group selection** | none | Draws a named frame around the selected nodes. See [Groups](../graph/Groups.md). | nothing is selected, a subgraph is open, or a replay is showing |
| **Check graph** | `Ctrl+Shift+C` | Opens the **Check** tab and checks the graph against your ComfyUI. Works everywhere, even in a text field. See [Checking a graph](../graph/Checking-A-Graph.md). | never |
| **Accept all suggestions** | none | Accepts every grey draft of the assistant, one after another. See [Grey drafts](../assistant/Drafts.md). | there are no open suggestions |
| **Guided tour** | none | Starts or ends the [tour of the graph](../graph/Tour.md). A tick means a tour is running. | the graph is empty, or a replay is showing |
| **Replay history** | none | Shows the earlier versions of the graph, read-only. A tick means the replay is showing. See [History and undo](../graph/History-And-Undo.md). | never |

## Good to know

- Making a subgraph, dissolving one and grouping work only on the main canvas. Inside an open subgraph these items are grey.
- During a history replay the canvas is read-only, so every item that changes the graph is grey. Leave the replay with `Escape` or by choosing **Replay history** again.

## See also

- [The canvas toolbar](Canvas-Toolbar.md)
- [Canvas menus](Canvas-Menus.md)
- [Subgraphs](../graph/Subgraphs.md)
- [Checking a graph](../graph/Checking-A-Graph.md)
