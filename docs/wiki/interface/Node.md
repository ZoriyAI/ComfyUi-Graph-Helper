[Русский](Node.ru.md)
[Home](../Home.md) › [The window](README.md)

# A node on the canvas

A node is one step of the graph, drawn as a card. From top to bottom it shows its title, the inputs that take links, the outputs that give data, and the fields you set on it. Under it may stand a description card. Colours and marks show its state.

<!-- picture: KSampler on the canvas with each part labelled -->

## The header

- **The title**: the name of the node on the canvas. You change it in [Properties](Properties.md) (**Name on the canvas**) or with **Rename…** in the node's menu.
- **The line under it**: the class of the node, for example `KSampler`. When the title already is the class, the line shows the readable name, the pack or the category instead.
- **Marks** on the right of the title:
  - a lock: **Locked**, the node cannot be moved;
  - a warning sign: **Needs attention**, the check found a problem here (the node is missing in your ComfyUI, or its model is of another family);
  - a spark: **Changed by the assistant**.
- **Badges** under the title: **Subgraph** for a subgraph block, **DEMO** for a node of a demo graph, **Bypassed** ("ComfyUI skips this node: what comes in goes straight on to the outputs.") and **Muted** ("ComfyUI does not run this node.") for nodes so marked in the workflow.

The colour of the header follows the main data type of the node.

## Inputs and outputs

Inputs are on the left edge, outputs on the right. Each has a name and a data type, for example `model MODEL` or `LATENT`. The dot on the edge is where a link starts or ends; its colour is the colour of the type.

- A filled dot is connected.
- An amber dot on an input means "This input needs a connection": the check found it empty and it is required.
- While you drag a link, the dots that fit light up and the nodes that do not fit fade.

See [Connecting nodes](../graph/Connecting-Nodes.md).

## Fields

Fields are the settings of the node: numbers, lists, switches, text and model files. You change them right on the node, or in Properties. See [Node fields](../graph/Node-Fields.md).

- A field that gets its value through a link shows "← link": "The value comes through a link from another node".
- "not set" means the field has no value.
- "not in the list" means the value is not among the options your ComfyUI offers.

## A subgraph block

A subgraph block has a layered icon, the badge **Subgraph** and a button **Open** that goes inside. See [Subgraphs](../graph/Subgraphs.md).

## The description card

Under the node a small speech-bubble mark opens the card that says what the node is and why it is here. See [Description cards](Description-Cards.md).

## States

| You see | It means |
|---|---|
| a bright outline | the node is selected |
| a red outline and a warning sign | the check found a problem in this node |
| a soft violet glow and a spark | the assistant added or changed it |
| a faded grey card with **Accept** and **Reject** | a grey draft, not in the graph yet. See [Grey drafts](../assistant/Drafts.md) |
| a node that fades in | it was just added by a build |

<!-- verify: the colours of the states and what Locked prevents; the dock look branch and the visual branch may change them -->

## See also

- [Node fields](../graph/Node-Fields.md)
- [Connecting nodes](../graph/Connecting-Nodes.md)
- [Properties](Properties.md)
- [Nodes and links](../concepts/Nodes-And-Links.md)
