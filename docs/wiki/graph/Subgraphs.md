[Русский](Subgraphs.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Subgraphs

A subgraph is a few nodes folded into one block. On the canvas it looks like one node with its own inputs and outputs; inside it is an ordinary graph. Use it to hide a part you understand, or to use the same part several times. ComfyUI reads subgraphs from workflow format 1. Background: [Nodes and links](../concepts/Nodes-And-Links.md).

<!-- picture: a subgraph block on the main canvas and, beside it, its inside with the input and output edges -->

## How to make one

1. Select the nodes (`Ctrl`+click, or a `Shift` box).
2. **Graph ▸ Make a subgraph from selection** (`Ctrl+G`), or right-click one of them ▸ **Make a subgraph from selection**.
3. A block named "Subgraph" takes their place. Links that crossed the edge of the selection become the inputs and outputs of the block.
4. Rename it in [Properties](../interface/Properties.md): **Subgraph name**, **Save name**.

Only on the main canvas, not inside another subgraph.

## How to go inside and back

- Press **Open** on the block, or right-click it ▸ **Open subgraph**, or select it and press **Open subgraph** in Properties.
- A path appears at the top: **Whole graph** › the subgraph name. Click **Whole graph**, use **Up one level**, or press `Escape` to go back out.
- Inside, a line says: "Inside a subgraph: changes apply to every copy of it. Drag a link to the empty place on the edge to add an input or output of the subgraph."

## How to edit the inside

Inside a subgraph you add, connect, change and delete nodes as on the main canvas. Two extra nodes stand at the edges: **Subgraph inputs** on the left and **Subgraph outputs** on the right.

- **Add an input**: drag a link from an inner input to the empty slot **New input** of **Subgraph inputs**. **Add an output**: drag from an inner output to **New output**.
- Or right-click an inner port ▸ **Expose as subgraph input** / **Expose as subgraph output**.
- **Rename** an input or output: double-click its name on the edge node ("Enter saves, Esc cancels"), or rename it in Properties (**Inputs and outputs**).
- **Remove** one: right-click it on the edge ▸ **Remove this subgraph input or output**.

## Copies

Insert more copies from the **Subgraphs** tab of the library (**Insert**) or right-click an empty place ▸ **Insert subgraph**. All copies share one inside: a change inside one changes all. A subgraph may hold another subgraph, but never itself: "A subgraph cannot go inside itself, directly or through another subgraph."

## How to undo a subgraph

Select the block ▸ **Graph ▸ Dissolve subgraph** (or **Dissolve** in Properties, or right-click ▸ **Dissolve subgraph**). Its nodes come back onto the main canvas. Or simply `Ctrl+Z` after making it.

## Limits

- The assistant builds only on the main canvas. If you are inside a subgraph when it starts, the canvas goes back: "The assistant builds on the main canvas, so the canvas went back to it."
- Lessons follow the main canvas too.
- In a graph of the older workflow format (0.4) a subgraph cannot be made: "Subgraphs need workflow format 1." Workflows saved by a recent ComfyUI are format 1. Today **File ▸ New project** also starts the empty graph in format 0.4, so after a new project a subgraph cannot be made either; a graph from the first start, or one opened from a recent ComfyUI, does not have this problem. <!-- verify: reported to the engineers (EMPTY_WORKFLOW in src/renderer/commands/actions.ts is format 0.4); remove the sentence about New project when it is fixed -->

<!-- verify: the import branch shows promoted fields of a subgraph from a workflow; check what the block shows then -->

## See also

- [Subgraphs in the library](../interface/Subgraph-Library.md)
- [Canvas menus](../interface/Canvas-Menus.md)
- [Workflow formats](../concepts/Workflow-Formats.md)
- [Groups](Groups.md)
