[Русский](Check-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The check tab

The **Check** tab shows the result of the check: what in the graph your ComfyUI will refuse or run badly. "Compares the graph with your installed nodes and models. Nothing runs and nothing changes in ComfyUI." What each kind of finding means and how to fix it is on [Checking a graph](../graph/Checking-A-Graph.md).

<!-- picture: the Check tab with three findings and the description advice -->

## How to use it

1. Press **Check the graph** in the tab, **Check** on the toolbar, or `Ctrl+Shift+C`. While it runs: "Checking…".
2. The result: "No problems found." or "3 findings", grouped by kind (**Nodes that are not installed**, **Models that are not on disk**, **Links with the wrong type**, **Models from different families**, **Required inputs left empty**, **Unknown node types**, **Fields with no value**, **Nothing saves or shows the result**, **Cycles in the graph**, **Values outside the allowed range**, **Values your ComfyUI does not offer**).
3. Each finding is one line with an icon for how serious it is and the node names in bold ("Node number 7"). A click on the line shows the place on the canvas and selects the node. The **?** button (**Ask why**) asks the assistant "Why is this a problem, and how do I fix it?".
4. The nodes with findings also get a ring and a number on the canvas. See [Checking a graph](../graph/Checking-A-Graph.md#marks-on-the-canvas).
5. Fix the graph and check again. The number on the **Check** button of the toolbar follows the last check. The **Check the graph** button in the tab is the main button only before the first check.

The check also runs by itself after a workflow is opened, once the node list of your ComfyUI has been read. Bypassed and muted nodes are left out.

Under the findings, **Prompts: worth changing** gives advice on prompts: "These are not errors: the graph will run. But with them the result usually comes out worse than you expect."

Findings are searchable by node name, problem text or node ID. Each group shows 50 at a time; **Previous** and **Next** reach the rest. Searching includes every finding, including those on other pages. A result brings its node into view with readable controls. The hardware processing-stage list opens only when you expand it.

## What can go wrong

- "The graph has not been checked yet." before the first check.
- "The check did not finish: …" with the reason.

## See also

- [Checking a graph](../graph/Checking-A-Graph.md)
- [Saving a workflow for ComfyUI](../graph/Saving-Workflows.md)
- [The right panel](Dock.md)
