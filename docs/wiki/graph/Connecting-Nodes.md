[Русский](Connecting-Nodes.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Connecting nodes

A link carries data from an output of one node (on its right edge) to an input of another (on its left edge). Every input and output has a data type, for example MODEL, CLIP, CONDITIONING, LATENT, IMAGE. A link joins only an output and an input of the same type, as in ComfyUI. What each type is: [Data types](../concepts/Data-Types.md).

## How to connect two nodes

1. Press the mouse on the dot of an output, for example `LATENT` of KSampler.
2. Drag to the dot of an input of the same type, for example `samples` of VAE Decode. The inputs that fit light up; nodes with nothing that fits fade. A dashed line shows the best input for the link.
3. Let go. The link is drawn in the colour of its type.

If you let go on an input of another type, the link is refused with a message, for example "IMAGE cannot go into an input that expects LATENT." and the hint "Inputs and outputs of the same color fit together; the matching ones light up while you drag."

## Let go on an empty place

Drag a link and let go on an empty place of the canvas. The node search opens with only the nodes that fit the link. The node you pick is added at that place, already linked. Adding the node and its link is one step of the history: "adding a node with its link".

You can also start from an input and drag back to an output.

An input takes one link. Drawing a second link to it moves the input over to the new source. One output can feed many inputs.

## How to let the app find the other end

- Right-click a port ▸ **Suggest a link**. What fits lights up; the best one is marked. Press `Enter` to connect: "Enter links to KSampler. Esc cancels." When nothing fits: "Nothing on the canvas fits this input or output."
- Right-click an input ▸ **What connects here?** or an output ▸ **Where does this go?** lights up the same and also asks the assistant.
- With the keyboard: select the node, `Tab` to an input or output, press `Shift+F10` ▸ **Suggest a link**, then `Enter`.
- Hold `Alt` and hover over a port for the same lighting.

## How to remove a link

- Click it and press `Delete` (or `Backspace`).
- Right-click it ▸ **Disconnect**.
- Removing a node removes its links.

## A field that takes a link

Many fields (a seed, a number, a text) can also get their value from a link. Drag a link to the small dot on the left of the field. The field then shows "← link" and its own value is not used.

## What can go wrong

- The link will not attach: the types differ. Ask **What type is this?** on the port, or **What connects here?**.
- "This input needs a link" (an amber dot): a required input is empty.
- "Links with the wrong type" in the check: a link from a file that ComfyUI would refuse. See [Checking a graph](Checking-A-Graph.md).

To put a node between two linked nodes, see [Put a node on a link](Adding-Nodes.md#put-a-node-on-a-link).

## See also

- [Data types](../concepts/Data-Types.md)
- [A node on the canvas](../interface/Node.md)
- [Canvas menus](../interface/Canvas-Menus.md)
- [Node fields](Node-Fields.md)
