[Русский](Subgraphs.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Subgraphs

A group of nodes packed into one node that has its own inputs and outputs.

## In plain words
A **subgraph** hides part of a graph inside a single node. From outside it looks like one node with a few inputs, outputs and fields; inside it is an ordinary graph. Large workflows use subgraphs to stay readable ("Upscale", "Face fix", "Wan sampler"), and the same subgraph can be reused.

Subgraphs replaced the older "group nodes" of ComfyUI. They need a recent ComfyUI frontend (1.24 or newer); publishing them to the node library needs 1.27.7 or newer.

## In ComfyUI
- **Create**: select nodes and press the subgraph button in the selection toolbox. Links that cross the border become the subgraph's inputs and outputs.
- **Open**: double-click an empty spot of the subgraph node, or use its edit button; leave with the navigation bar or Esc. Subgraphs can be nested.
- **Inputs and outputs**: inside, a special input and output bar; drag a link to its empty slot to add one; right-click to rename or remove.
- **Promoted fields**: fields of inner nodes can be shown on the outer node ("Edit Subgraph Widgets").
- **Unpack**: "Unpack subgraph" puts the nodes back.
- **Blueprints**: "Add Subgraph to Library" saves it as a reusable node in your node library; each copy you add is independent.

In the workflow file, subgraph definitions are stored once in a `definitions` section, and each use refers to them.

## Typical mistakes
- Editing one copy and expecting the others to change: copies placed from a blueprint are independent.
- A workflow with subgraphs opened in an older ComfyUI: the subgraph nodes are unknown there.

## How the app helps
The app opens and saves workflows with subgraphs, shows them in the **Subgraphs** section of the library, and lets you edit a subgraph from the inside. Lessons follow the main canvas only. See [Subgraphs in the app](../graph/Subgraphs.md).

## See also
- [Workflow formats](Workflow-Formats.md)
- [Notes, reroutes and primitives](Notes-Reroutes-Primitives.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
- [Subgraph library](../interface/Subgraph-Library.md)
