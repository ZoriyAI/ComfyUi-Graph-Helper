[Русский](Reading-A-Workflow.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Reading someone else's workflow

<!-- lesson: read-workflow -->
Lesson "read-workflow", in the group **ComfyUI basics** of the lesson list. Steps: 11.

## What you will be able to do
You learn to read groups, notes, reroutes, primitives, Set and Get, bypassed nodes and subgraphs, and give two fields one value.

## What you need
- It goes on from [How ComfyUI works](How-ComfyUI-Works.md), [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Empty Latent Image, Int.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Where to start** (reading)

   A workflow from a template or from the internet can have fifty nodes. Read it in this order:

   1. the notes;
   2. the output nodes, and back along the links;
   3. the loaders and their files;
   4. what is switched off.

   This lesson explains each thing you meet on the way. It practises one of them on the graph of "A first picture from text".

2. **Notes** (reading)

   Note and Markdown Note nodes are text on the canvas. They never run.

   Template authors write there which model files the graph needs, in which folder each goes, and which settings to change. Read every note first: most "it does not work" ends there.

3. **Groups** (reading)

   A group is a coloured frame with a title around several nodes: "Models", "Prompt", "Upscale". It changes nothing in what runs; it only organises the canvas. Moving a group moves its nodes.

   Read the titles of the groups to see the parts of the graph before the nodes.

4. **Reroutes** (reading)

   A reroute is a dot on a link that only passes the data on, so long links can go around other nodes. The current ComfyUI interface puts such dots on the links themselves; older workflows use Reroute nodes.

   When you follow a link, go through the dots: the real source is further on.

5. **Primitives** (reading)

   A primitive node holds one value and gives it to fields of other nodes: Int for a whole number, Float for a fraction, Text and Text (Multiline) for text, Boolean for yes or no.

   In the current interface every field has its own input dot, so a link from a primitive goes straight into a field. That field then takes the value from the link, not the one typed into it.

   Templates use primitives so that one value sits in one visible place and several nodes share it.

6. **The picture graph is needed**

   The canvas must have the graph of "A first picture from text" with its **Empty Latent Image** node.

   If it is not there, do that lesson first.

7. **Practice: one value for two fields**

   Add a **Int** node. Connect its `INT` output to the `width` input of **Empty Latent Image** and once more to its `height` input. Set its `value` to 1024 (512 for an SD 1.5 model).

   Now the picture is square and its size is set in one place. Change the number and both fields follow. This is how templates share a size between a blank and the nodes that must match it.

8. **Set and Get: links you do not see** (reading)

   Some packs pass data without a visible link, to keep large graphs tidy.

   - ComfyUI-KJNodes: a Set node takes a value under a name, and every Get node of that name gives it out elsewhere.
   - cg-use-everywhere: an Anything Everywhere node sends its input to every matching input that is not linked.
   - rgthree-comfy: Context nodes carry the model, the text encoder, the VAE and the prompts as one link.

   When an input looks empty but the graph works, look for one of these. They live in the interface: without the pack the hidden links are lost.

9. **Bypassed and muted nodes** (reading)

   - Bypass (Ctrl+B in ComfyUI, the node turns purple): the node is skipped and its inputs go straight through to its outputs. A bypassed LoRA loader leaves the model as it was.
   - Mute (Ctrl+M, the node turns grey): the node does not run, and neither does what depends only on it.

   Authors switch off optional parts this way: an upscale, a face fix. When a workflow does not do what its title says, look for purple and grey nodes first.

10. **Subgraphs** (reading)

   A subgraph is a node with a whole graph inside. It shows the inputs, outputs and fields its author chose to show.

   In ComfyUI double-click it, or press its edit button, to go inside; the bar at the top leads back. Official templates often put the whole model part into one subgraph, so the canvas shows only the prompt, the size and the result. In this app the node's context menu has "Open subgraph".

11. **Before you run it** (reading)

   - A red node or one the app marks as unknown needs a pack: install it through ComfyUI Manager.
   - A loader field with a file you do not have needs that file in its folder; the notes usually say where to get it.
   - "Check graph" in this app finds missing nodes and models, empty inputs and mixed model families.

   Save with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 6, **The picture graph is needed**:
  - a **Empty Latent Image** node.
- Step 7, **Practice: one value for two fields**:
  - a **Int** node.
  - `INT` of **Int** into `width` of **Empty Latent Image**.
  - `INT` of **Int** into `height` of **Empty Latent Image**.
  - `value` of **Int** is from 512 to 1024; **Do this for me** sets 1024.

## See also
- [Reading someone else's workflow](../concepts/Reading-A-Workflow.md)
- [Notes, reroutes and primitives](../concepts/Notes-Reroutes-Primitives.md)
- [Workflows and their file formats](../concepts/Workflow-Formats.md)
- [Node packs](../concepts/Node-Packs.md)
- [How lessons work](How-Lessons-Work.md)
