[Русский](Properties.ru.md)
[Home](../Home.md) › [The window](README.md)

# Properties

The **Properties** tab of the right panel shows what is selected on the canvas: one node, one link, a subgraph block, several nodes, or, with nothing selected, the graph as a whole. Here you rename, set fields, describe and ask about it.

<!-- picture: Properties with KSampler selected -->

## With nothing selected

"Nothing selected. Click a node and its inputs, outputs and fields appear here." Below:

- **Subgraphs**, when the graph has any: the subgraphs of this graph, each with its numbers of nodes, inputs and outputs.
- **This graph**: **Title** and **Notes** of the whole graph, and **Save title and notes**. The title is the project name in the toolbar.

## With one node selected

| Part | What it is for |
|---|---|
| **Name on the canvas** and **Save name** | rename the node; the class stays the same. **Save name** sits on the same row as the name and is pale until the name changes. |
| **Category** | its group in ComfyUI |
| **Explain this** | asks the assistant "Explain what “…” does in this graph." |
| **Inputs and outputs** | the inputs (**In**) and outputs (**Out**), each "connected" or "free" |
| **Properties** | every field with its control; "From 1 to 10000" under a number; the **after run** row under a seed. See below. |
| **Component**: **Purpose**, **How to use**, **Save documentation** | what this node is for and how to work with it, in your words. The text stays in the language you write. |
| **Explanations** | what the assistant and you saved about this node, with its badge (**You**, **From the file**, or **Assistant** for the assistant's words). "No explanations yet. Use “Explain this” to ask." |

A node without fields says "This node has no fields to set." A node whose class is not read yet says "This node has saved values, but the app does not know its fields yet: your ComfyUI has not been read, or this node is not installed there. Run a sync and the fields appear here."

## Field notes

A field that has a built-in note shows a small **i** beside its name. Its tooltip is "What this field does". A press opens the note under the name; a second press hides it ("Hide what this field does"). A field without a note has no **i**.

The question mark at the end of the row still asks the assistant: "What does the field “…” of “…” do, and what value should I pick?"

## Special nodes

- A node your ComfyUI does not have: "This node is not installed in your ComfyUI (…). The values the file saved are shown below as they are and go back to ComfyUI unchanged. To run the graph, install the pack with this node in ComfyUI." The values follow, read-only.
- A Note, Reroute or Primitive gets one sentence on what it is, for example "A Reroute only carries a link to another place on the canvas. It has no settings of its own."
- A Set or Get node: one sentence on its pair, and **Go to its Set** or **Go to its Get**.

## With a subgraph block selected

**Subgraph instance**: **Subgraph name** with **Save name**, **Inputs and outputs** (the names of its inputs and outputs, "Input 1", "Output 1", each renamable), **Open subgraph** and **Dissolve**. "This node is an instance of a subgraph; it is marked in the subgraph list below." A subgraph from a workflow may also show **Fields of the subgraph**: the fields its author put on every copy. See [Subgraphs](../graph/Subgraphs.md#fields-of-a-subgraph-from-a-workflow).

## With a link selected

**Link**: **From**, **To**, **Type**, and a sentence such as "LATENT flows from the output LATENT to the input samples." **Explain this** asks what flows there.

## With several nodes selected

"3 nodes selected. Shared edits are not available. Select one node to see its inputs and outputs."

## See also

- [The right panel](Dock.md)
- [Node fields](../graph/Node-Fields.md)
- [Notes and descriptions](../graph/Notes-And-Descriptions.md)
- [Subgraphs](../graph/Subgraphs.md)
