[Русский](Node.ru.md)
[Home](../Home.md) › [The window](README.md)

# A node on the canvas

A node is one step of the graph, drawn as a card. From top to bottom it shows its title, the inputs that take links, the outputs that give data, and the fields you set on it. Under it may stand a description card. Colours and marks show its state.

<!-- picture: KSampler on the canvas with each part labelled -->

## The header

- **The title**: the name of the node on the canvas. You change it in [Properties](Properties.md) (**Name on the canvas**) or with **Rename…** in the node's menu.
- **The line under it**: the class of the node, for example `KSampler`. When the title already is the class, the line shows the readable name, the pack or the category instead.
- **Marks** on the right of the title:
  - a lock: **Locked**, the fields of this node cannot be changed on the canvas;
  - a warning sign: **Needs attention**, the check found a problem here (the node is missing in your ComfyUI, or its model is of another family);
  - a spark: **Changed by the assistant**.
- **Badges** under the title: **Subgraph** for a subgraph block, **DEMO** for a node of a demo graph, **Paid** for a node that runs on an outside service ("Runs on an outside service: ComfyUI asks you to sign in to your Comfy account and charges for each run."), **Bypassed** and **Muted** (see below), and **Not installed** for a node your ComfyUI does not have.

The colour of the header follows the main data type of the node. A node with a colour of its own (from the workflow, or chosen with **Color**) is tinted with it, in the title bar and the body, and ComfyUI shows the same colour.

## Bypass and mute

- **Graph ▸ Bypass** (`Ctrl+Shift+B`): ComfyUI skips the node: what comes in goes straight out to the output of the same type. The node shows **Bypassed** ("ComfyUI skips this node: what comes in goes straight on to the outputs.").
- **Graph ▸ Mute** (`Ctrl+M`): ComfyUI does not run the node at all; nodes that need its result get nothing. The node shows **Muted** ("ComfyUI does not run this node.").
- Choose the same item again to make the node run. Both are saved in the workflow, and the check leaves out bypassed and muted nodes.

## A node your ComfyUI does not have

Once the app has read your ComfyUI, a node whose class is missing gets a dashed frame and **Not installed**. It lists the values the file saved, read-only; they go back to ComfyUI unchanged. Install its pack in ComfyUI to run it.

## Collapsed nodes

A collapsed node is one title row with an arrow. `Alt+C` or **Collapse** / **Expand** in the node menu folds or opens the selected nodes, as one step of the history. A workflow keeps this state.

## Inputs and outputs

Inputs are on the left edge, outputs on the right. Each has a name and a data type, for example `model MODEL` or `LATENT`. The dot on the edge is where a link starts or ends; its colour is the colour of the type.

- A filled dot is connected.
- An amber dot on an input means "This input needs a link": it is required and empty. A screen reader hears "required, empty".
- A long type name is shortened (for example "…CLIPEMBEDS"); the tooltip shows it whole.
- While you drag a link, the dots that fit light up and the nodes that do not fit fade.

See [Connecting nodes](../graph/Connecting-Nodes.md).

## Fields

Fields are the settings of the node: numbers, lists, switches, text and model files. You change them right on the node, or in Properties. See [Node fields](../graph/Node-Fields.md).

- A field that gets its value through a link shows "← link": "The value comes through a link from another node".
- "not set" means the field has no value.
- "not in the list" means the value is not among the options your ComfyUI offers.
- Under a seed, the row **after run** says what ComfyUI does with the value after each run: **fixed**, **increment**, **decrement** or **randomize**.
- "service data": the node keeps this for itself; it goes back to ComfyUI unchanged.

## Notes, Reroute, Primitive, Set and Get

- A **Note** or **Markdown Note** is a warm card with text. Write in it right on the canvas: double-click or `Enter`; `Ctrl+Enter` or a click elsewhere saves, `Escape` cancels. An empty note says "Write a note…". Links in a note are shown as text.
- A **Reroute** is a small dot coloured by the link that comes in. Reroute points that ComfyUI draws on links are shown too, but cannot be added or moved here.
- A **Primitive** shows its value with the same control as the field it feeds.
- A **Set** or **Get** node: select one, and a dashed line and frame lead to its partner. The node menu and Properties have **Go to its Set** / **Go to its Get**.

## A subgraph block

A subgraph block has a layered icon, the badge **Subgraph** and a button **Open** that goes inside. See [Subgraphs](../graph/Subgraphs.md).

## The description card

Under the node a small speech-bubble mark opens the card that says what the node is and why it is here. See [Description cards](Description-Cards.md).

## States

| You see | It means |
|---|---|
| a bright outline | the node is selected |
| a red outline and a warning sign | the check found a problem in this node |
| a ring with a number at a corner | after a check: how many findings this node has. Raspberry: the graph will not run; amber: the rest. The marks go away after any change |
| a dashed frame and **Not installed** | your ComfyUI does not have this node |
| a soft violet glow and a spark | the assistant added or changed it |
| a faded grey card with **Accept** and **Reject** | a grey draft, not in the graph yet. See [Grey drafts](../assistant/Drafts.md) |
| a node that fades in | it was just added by a build |

## See also

- [Node fields](../graph/Node-Fields.md)
- [Connecting nodes](../graph/Connecting-Nodes.md)
- [Properties](Properties.md)
- [Nodes and links](../concepts/Nodes-And-Links.md)
