[Русский](Node-Card.ru.md)
[Home](../Home.md) › [The window](README.md)

# The node card

The node card opens next to the library when you click a node in the **Nodes** tab. It says what the node does, where it comes from, what goes in, what you set on it and what comes out, before you put it on the canvas.

<!-- picture: the card of KSampler -->

## What the card shows

| Part | What it says |
|---|---|
| **Category** | the group of the node in ComfyUI, for example sampling |
| **Comes from** | "ComfyUI itself", or the node pack |
| **What the pack says about itself** | for a node from a pack: the pack's own description and **Repository** with **Copy the repository link** (**More** / **Less** for a long text) |
| **What it is**, **Usually used for**, **How to connect it**, **Watch out** | the app's knowledge of this node. Each part has a mark: **Fact** (read from ComfyUI or the file), **Guess** (concluded from names and context) |
| **Description from its author** | what the node's author wrote, when there is no knowledge of the app |
| **What goes in** | the inputs, each with its data type; "optional" marks the ones that may stay empty |
| **Settings on the node** | the fields: "starts at 20", "from 1 to 10000", "a list of 12", "a file from the folder loras", "text" |
| **What comes out** | the outputs with their types |

When nothing goes in, the card says "Nothing is linked into it: a branch starts here." When nothing comes out: "Nothing comes out: a branch ends here."

## Buttons

- **Add to canvas** puts the node on the canvas.
- **Ask the assistant** asks "What does the node "…" do, and when is it used?".
- The cross or `Escape` closes the card.

## When little is known

- "Neither ComfyUI nor the pack says what this node does. Ask the assistant: it reads the inputs and outputs below."
- "Its inputs and outputs are not read yet. Start ComfyUI and sync again."

## See also

- [Nodes in the library](Node-Library.md)
- [A node on the canvas](Node.md)
- [Data types](../concepts/Data-Types.md)
- [Node packs](../concepts/Node-Packs.md)
