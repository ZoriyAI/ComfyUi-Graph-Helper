[Русский](Nodes-And-Links.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Nodes, inputs, outputs, links and types

How a graph is made of nodes joined by links, and why a link joins only matching types.

## In plain words
A **node** is a box that does one job: load a file, encode a prompt, remove noise, save a picture. Its **inputs** are dots on the left edge: what it needs from other nodes. Its **outputs** are dots on the right edge: what it gives. Its **fields** (ComfyUI calls them widgets) are the settings written on the node itself: a file name, a number, a piece of text.

A **link** is a line from an output of one node to an input of another. It carries data, never settings. One output may feed many inputs; an input takes exactly one link.

Every input and output has a **type**, written in capitals: `MODEL`, `CLIP`, `VAE`, `CONDITIONING`, `LATENT`, `IMAGE`, `MASK` and many more. A link joins only an output and an input of the same type. Links also have colours by type in ComfyUI, so a purple `MODEL` line and a pink `CLIP` line are easy to tell apart.

<!-- diagram: one node drawn large; inputs on the left labelled "model", "positive", "negative", "latent_image"; fields in the middle "seed", "steps", "cfg"; output on the right "LATENT"; a link coming in from the left and going out to the right -->

## Where you meet it in a graph
- **Class and title.** Each node has a class (its programmatic name, such as `KSampler`) and a title shown on screen (such as "KSampler" or "Load Checkpoint"). People rename titles; the class stays.
- **Optional inputs.** Some inputs may stay empty (for example `end_image` of a video start node). Required inputs must be connected or ComfyUI refuses to run.
- **A field turned into an input.** Any number, text or choice field can take a link instead of a typed value. This lets one value (a seed, a size) drive several nodes. In current ComfyUI every field already has a small input dot you can drag a link to.
- **Types that are not data.** `INT`, `FLOAT`, `STRING`, `BOOLEAN` and `COMBO` (a choice from a list) are the types of field values.

The full list of common types with what each carries is on [Link types](Data-Types.md).

## Typical mistakes
- **A link will not attach**: the types differ. A `LATENT` does not go into an `IMAGE` input; you need VAE Decode between them.
- **Two links into one input**: impossible; the new link replaces the old one.
- **An input left empty**: "Required input is missing" in ComfyUI.
- **Nodes from a pack meet built-in nodes**: some packs have their own types (for example WanVideoWrapper's `WANVIDEOMODEL`), and those do not connect to built-in inputs even when the names look alike.

## How the app helps
- Select a node, an input or a link and the **Explain** tab says what it is, why it is used and what goes in and out, from built-in knowledge written for newcomers.
- **Check** lists links of the wrong type and required inputs left empty.

## See also
- [Link types](Data-Types.md)
- [What ComfyUI is](What-Is-ComfyUI.md)
- [Notes, reroutes and primitives](Notes-Reroutes-Primitives.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
- [The canvas](../interface/Canvas.md)
- [The Explain tab](../interface/Explain-Panel.md)
- [Check before export](../graph/Checking-A-Graph.md)
