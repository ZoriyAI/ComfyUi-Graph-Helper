[Русский](Properties.ru.md)
[Home](../Home.md) › [The window](README.md)

# Properties (the Inspector tab)

The **Inspector** tab of the right panel shows what is selected on the canvas: one node, one link, a subgraph block, several nodes, or, with nothing selected, the graph as a whole. Here you rename, set fields, describe and ask about it. (In Russian the tab is called «Свойства».)

<!-- picture: the Inspector with KSampler selected -->

## With nothing selected

"Nothing selected. Click a node and its inputs, outputs and settings appear here." Below:

- **Subgraphs**: the subgraphs of this graph, each with its numbers of nodes, inputs and outputs. "No subgraphs in this graph yet. A subgraph is a few nodes folded into one block you can use again." when there are none.
- **This graph**: **Title** and **Notes** of the whole graph, and **Save title and notes**. The title is the project name in the toolbar.

## With one node selected

| Part | What it is for |
|---|---|
| **Name on the canvas** and **Save name** | rename the node; the class stays the same |
| **Category** | its group in ComfyUI |
| **Explain this** | asks the assistant "Explain what "…" does in this graph." |
| **Ports** | the inputs (**In**) and outputs (**Out**), each "connected" or "free" |
| **Properties** | every field with its control; "From 1 to 10000" under a number; the question mark asks "What does the field "…" of "…" do, and what value should I pick?" |
| **Component**: **Purpose**, **How to use**, **Save documentation** | what this node is for and how to work with it, in your words. The text stays in the language you write. |
| **Explanations** | what the assistant and you saved about this node, with its badge. "No explanations yet. Use Explain this to ask." |

A node without fields says "This node has no fields to set." A node whose class is not read yet says "This node has saved values, but the app does not know its fields yet: your ComfyUI has not been read, or this node is not installed there. Run a sync and the fields appear here."

## With a subgraph block selected

**Subgraph instance**: **Subgraph name** with **Save name**, **Inputs and outputs** (the names of its inputs and outputs, "Input 1", "Output 1", each renamable), **Open subgraph** and **Dissolve**. "This node is an instance of a subgraph; it is marked in the subgraph list below."

## With a link selected

**Connection**: **From**, **To**, **Type**, and a sentence such as "LATENT flows from the output LATENT to the input samples." **Explain this** asks what flows there.

## With several nodes selected

"3 nodes selected. Shared edits are not available. Select one node to see its ports."

## See also

- [The right panel](Dock.md)
- [Node fields](../graph/Node-Fields.md)
- [Notes and descriptions](../graph/Notes-And-Descriptions.md)
- [Subgraphs](../graph/Subgraphs.md)
