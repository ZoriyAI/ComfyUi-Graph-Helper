[Русский](Check-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The check tab

The **Check** tab shows the result of the check: what in the graph your ComfyUI will refuse or run badly. "Compares the graph with your installed nodes and models. Nothing runs and nothing changes in ComfyUI." What each kind of finding means and how to fix it is on [Checking a graph](../graph/Checking-A-Graph.md).

<!-- picture: the Check tab with three findings and the description advice -->

## How to use it

1. Press **Check the graph** in the tab, **Check** on the toolbar, or `Ctrl+Shift+C`. While it runs: "Checking…".
2. The result: "No problems found." or "3 findings", grouped by kind (**Nodes that are not installed**, **Models that are not on disk**, **Connections with the wrong type**, **Models from different families**, **Required inputs left empty**, **Unknown node types**, **Fields with no value**).
3. Each finding names the node ("Node number 7") and has two buttons: **Show** moves the canvas to it and selects it; **Ask why** asks the assistant "Why is this a problem, and how do I fix it?".
4. Fix the graph and check again. The number on the **Check** button of the toolbar follows the last check.

Under the findings, **Descriptions: worth changing** gives advice on prompts: "These are not errors: the graph will run. But with them the result usually comes out worse than you expect."

## What can go wrong

- "The graph has not been checked yet." before the first check.
- "The check did not finish: …" with the reason.

<!-- verify: the canvas and files branch adds a check that finds what ComfyUI refuses to run; the dock look branch changes the rows -->

## See also

- [Checking a graph](../graph/Checking-A-Graph.md)
- [Saving a workflow for ComfyUI](../graph/Saving-Workflows.md)
- [The right panel](Dock.md)
