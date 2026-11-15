[Русский](Canvas-Toolbar.ru.md)
[Home](../Home.md) › [The window](README.md)

# The canvas toolbar

The canvas toolbar floats at the top of the canvas. It holds what you do on the canvas itself: add a node, lay the graph out, zoom, the description cards, the tour, the history and following the assistant. Each action lives only here and in the menus, not on the top toolbar.

<!-- picture: the canvas toolbar with each group outlined -->

## Buttons, from left to right

| Button | What it does |
|---|---|
| **Node** | Opens the node search (**Add node**, `Ctrl+K`). See [Adding nodes](../graph/Adding-Nodes.md). |
| **Arrange** | **Arrange the graph** (`Ctrl+Shift+L`): lays the graph out from left to right; with two or more nodes selected, only those. |
| magnifier with a minus | **Zoom out** (`Ctrl+-`). |
| the percent number | **Actual size**: back to 100 % (`Ctrl+0`). |
| magnifier with a plus | **Zoom in** (`Ctrl+=`). |
| four corners | **Fit to view**: the whole graph in view (`Shift+1`). |
| **Descriptions** | Switches the description cards: own notes only, then all nodes, then off. The tooltip says the mode now, for example "Descriptions: own notes only. Click for all nodes". See [Description cards](Description-Cards.md). |
| **Tour** | Starts the [tour of the graph](../graph/Tour.md); pressed again, ends it. |
| clock with an arrow | **Replay history**: a slider over the earlier versions of the graph. See [History and undo](../graph/History-And-Undo.md). |
| paper plane | **Follow the assistant**: while the assistant builds, the view goes to each new node. Lit means on. |
| **Accept all (3)** and **Reject all** | Appear when the assistant left two or more grey drafts. Accept or reject them all. See [Grey drafts](../assistant/Drafts.md). |

## The tour bar

While a tour runs, a second bar appears under the toolbar: **Previous step**, **Play** / **Pause**, **Next step**, "Step 2 of 7" and **End tour**.

## The replay bar

While a replay shows, the history button turns into a bar: **Play** / **Pause**, a slider (**Version**), **Return to this version** and **Exit replay**. The canvas shows "Version 12 of 40: add KSampler. Read-only." With no history yet it says "No history yet." **Node**, **Arrange** and **Tour** are hidden while a version is shown.

## The live build strip

While the assistant builds, a strip under the canvas toolbar says "The assistant is building: step 3 of 8" and, after a colon, the reason for that step. It has **Pause the build**, **Resume the build**, **Stop the build** and **Show all now**. While the build is paused, it says "The assistant is paused at step 3 of 8. Press Continue to go on or Stop to end the build; what is built stays." See [Build](../assistant/Build.md).

## See also

- [The canvas](Canvas.md)
- [Graph menu](Graph-Menu.md)
- [View menu](View-Menu.md)
- [Arranging the graph](../graph/Arranging.md)
