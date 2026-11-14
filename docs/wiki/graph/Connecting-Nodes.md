[Русский](Connecting-Nodes.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Connecting nodes

A link carries data from an output of one node (on its right edge) to an input of another (on its left edge). Every input and output has a data type, for example MODEL, CLIP, CONDITIONING, LATENT, IMAGE. A link joins only an output and an input of the same type, as in ComfyUI. What each type is: [Data types](../concepts/Data-Types.md).

## How to connect two nodes

1. Press the mouse on the dot of an output, for example `LATENT` of KSampler.
2. Drag to the dot of an input of the same type, for example `samples` of VAE Decode. The inputs that fit light up; nodes with nothing that fits fade.
3. Let go. The link is drawn in the colour of its type.

You can also start from an input and drag back to an output.

An input takes one link. Drawing a second link to it moves the input over to the new source. One output can feed many inputs.

## How to let the app find the other end

- Right-click a port ▸ **Suggest a connection**. What fits lights up; the best one is marked. Press `Enter` to connect: "Enter connects to KSampler. Escape cancels." When nothing fits: "Nothing on the canvas fits this port."
- Right-click an input ▸ **What connects here?** or an output ▸ **Where does this go?** lights up the same and also asks the assistant.
- With the keyboard: select the node, `Tab` to a port; the same lighting starts, and `Enter` connects.
- Hold `Alt` and hover over a port for the same lighting.

## How to remove a link

- Click it and press `Delete` (or `Backspace`).
- Right-click it ▸ **Disconnect**.
- Removing a node removes its links.

## A field that takes a link

Many fields (a seed, a number, a text) can also get their value from a link. Drag a link to the small dot on the left of the field. The field then shows "← link" and its own value is not used.

## What can go wrong

- The link will not attach: the types differ. Ask **What type is this?** on the port, or **What connects here?**.
- "This input needs a connection" (an amber dot): the check found a required input empty.
- "Connections with the wrong type" in the check: a link from a file that ComfyUI would refuse. See [Checking a graph](Checking-A-Graph.md).

<!-- verify: the canvas and files branch adds guidance while linking and a search when a link is dropped on empty canvas -->

## See also

- [Data types](../concepts/Data-Types.md)
- [A node on the canvas](../interface/Node.md)
- [Canvas menus](../interface/Canvas-Menus.md)
- [Node fields](Node-Fields.md)
