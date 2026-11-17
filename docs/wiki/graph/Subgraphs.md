[Русский](Subgraphs.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Constructing subgraph nodes

A subgraph is a reusable ComfyUI node containing an inner graph. It exposes typed inputs and outputs and selected settings. Definitions are shared; values on each outer node are independent.

## Create a node

Open **Graph → Subgraph constructor…** (`Ctrl+G`), or **Library → Subgraphs → Subgraph constructor…**. This works on the main canvas and inside a subgraph.

1. **Contents.** Name the node and describe what it does. Select inner nodes, including other subgraphs, or start with an empty graph.
2. **Inputs and outputs.** Add named ports and choose their ComfyUI types. Connect each to an inner port now, or leave it to wire inside later. Existing links crossing the selection boundary are preserved automatically.
3. **Controls.** Select known settings from the inner nodes to show on the outer node. Read the ComfyUI catalog if the app does not yet know their names and widget layout. Unknown values from imported workflows remain available by their position, but positional labels cannot be exported as invented widget names.
4. **Review.** Check the outer node preview, then **Create node**. Leave **Open the inner graph after saving** checked to continue inside immediately.

An imported0.4 workflow needs an explicit upgrade to native ComfyUI format1, offered in step1. Its node values and links are retained. Cancelling the constructor changes nothing; saving is one undo step. If the graph or editing level changes during a draft, reopen the constructor instead of overwriting that newer revision.

## Build and wire the inside

Use the normal node library and canvas tools to add, connect, tune, move or delete inner nodes. **Subgraph inputs** and **Subgraph outputs** are the two boundary nodes.

- Wire a declared input from the left boundary to an inner node, or wire an inner output to the right boundary.
- Drag to the boundary's **New input** or **New output** slot, or right-click an inner port and expose it, to add an interface slot.
- Double-click a boundary name, or use Properties, to rename it. Right-click a boundary slot to remove it.
- Use the constructor inside to create another level of subgraphs, or insert an existing definition from the library. A definition cannot contain itself, directly or indirectly.

Open an existing node through its **Open** button, double-click its background, or use Properties. The breadcrumb and **Up one level** return to its parent. **Whole graph** returns to the root.

## Change the outer node

Select its instance and open **Properties → Configure subgraph node**. Change its name/purpose, add interface ports or choose the outer controls. Existing ports can be renamed or removed from the inner editor. Copies share the definition's structure and default inner settings; exposed values on each instance remain independent, including after control reordering. Editing the common inner graph affects all copies.

**Dissolve subgraph** works on the main canvas and inside another subgraph. It restores nodes, boundary links and inner groups, applies that instance's exposed values, and retargets controls exposed through parent nodes. Other instances keep their independent values. `Ctrl+Z` restores the previous revision. A shared definition is retained while another instance uses it. Unknown or ambiguous widget layouts are refused without changing the graph.

## Ask the assistant

In Build mode the assistant can create empty subgraphs or wrap its own nodes, choose typed ports and controls, and construct nested graphs through the same command engine. It can edit inside definitions created by that build; pre-existing user definitions remain protected. The lesson canvas and the assistant's initial view still start on the main graph.

## Export and execution

Use **Save workflow for ComfyUI…**. The export uses native format1 `definitions.subgraphs`, typed boundary links and promoted-widget mappings. Open it in a ComfyUI frontend that supports subgraphs; install the node packs and models it needs. NodeWise edits and exports the graph; ComfyUI executes its inner nodes.

A subgraph composes existing node operations. Implementing a new algorithm requires a Python custom-node extension; this constructor does not generate or run such a package. Full parity with every custom JavaScript widget and execution on a real ComfyUI server have not been verified for this release.

## ComfyUI references

- [Subgraphs: creation, navigation and parameters](https://docs.comfy.org/interface/features/subgraph)
- [Subgraph developer guide](https://docs.comfy.org/custom-nodes/js/subgraphs)
- [Native workflow schema](https://github.com/Comfy-Org/ComfyUI_frontend/blob/7e95d1b8503809ab39543ed06dda2780d78e053f/packages/graph-model/src/workflowSchema.ts)
- [Custom-node architecture](https://docs.comfy.org/custom-nodes/overview)
