[Русский](Checking-A-Graph.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Checking a graph

The check compares your graph with what your ComfyUI has, and finds what ComfyUI would refuse or run badly. It runs nothing and changes nothing in ComfyUI, and needs no model. It also gives advice on your prompts. The tab where the result shows: [The check tab](../interface/Check-Panel.md).

## How to check

1. **Check** on the toolbar, **Graph ▸ Check graph**, or `Ctrl+Shift+C`. The **Check** tab opens.
2. Read the findings. Each finding is one line and names the node ("Node number 7").
3. Click a finding to see its place on the canvas; the **?** button (**Ask why**) asks the assistant how to fix it.
4. Fix, then check again. "No problems found." means ComfyUI should accept the graph.

The check also runs by itself after a workflow or project is opened and whenever the node list of your ComfyUI is read again, once there is a graph on the canvas. **File ▸ Save workflow for ComfyUI…** runs the same check first and asks when it finds something.

## Marks on the canvas

After a check, every node with a finding carries a coloured ring and a number, the count of its findings. A wave runs over the marked nodes from left to right.

- Raspberry: the graph will not run (a missing node or model, a link of the wrong type).
- Amber: everything else.
- Advice about a prompt is listed but leaves no mark.
- The marks disappear after any change to the graph; check again to see them. Inside a subgraph there are none.

An empty required input also gets an amber dot: "This input needs a link".

## The kinds of findings

| Finding | Example | What to do |
|---|---|---|
| **Nodes that are not installed** | The node "WanVideo Sampler" is not installed in your ComfyUI. Install the pack that provides WanVideoSampler through ComfyUI Manager. | Install the node pack in ComfyUI yourself, then **Sync ▸ Sync now**. Or replace the node with one you have. A pack runs its own code on your computer: take it from the Manager's list or from an author you trust, never from a link in a workflow or a note. |
| **Models that are not on disk** | sdxl_base.safetensors is not in checkpoints (node "Load Checkpoint"). | Choose another file in the field, or put the file into that folder of ComfyUI and sync. See [Choosing a model file](Model-Files.md). |
| **Links with the wrong type** | "VAE Decode" → "Save Image": LATENT goes into an input that expects IMAGE. | Remove the link and connect outputs and inputs of the same type. See [Connecting nodes](Connecting-Nodes.md). |
| **Models from different families** | lora_x is made for SDXL, but flux_dev upstream is Flux.1. | Pick a LoRA, VAE or checkpoint of the same family. See [Model families](../concepts/Model-Families.md). |
| **Required inputs left empty** | Input model (MODEL) on "KSampler" needs a link. | Connect something of that type. |
| **Unknown node types** | XYZ is not in the synced catalog. | Sync; if it stays, the node comes from a pack you do not have. |
| **Fields with no value** | Field seed on "KSampler" has no value and no default; set it before saving for ComfyUI. | Set the field. See [Node fields](Node-Fields.md). |
| **Nothing saves or shows the result** | The graph has no node that saves or shows a picture, so ComfyUI will refuse to run it. Add Save Image or Preview Image after "VAE Decode". | Add a node that saves or shows the result. In the node search these carry the mark **Result**. |
| **Cycles in the graph** | These nodes form a cycle, so ComfyUI cannot execute the graph: … | Remove one of the links that lead back. |
| **Values outside the allowed range** | Field steps on "KSampler" is 0, but the smallest allowed is 1. ComfyUI will refuse it; set 1 or more. | Set a value inside the range. |
| **Values your ComfyUI does not offer** | Field sampler_name on "KSampler" holds "dpmpp_3m", which is not in its list in your ComfyUI. Pick a value from the list. | Pick a value from the list. Common in a workflow made on another computer. |

## Advice on prompts

Under **Prompts: worth changing**: "These are not errors: the graph will run. But with them the result usually comes out worse than you expect." The check looks at your prompts and says, for example:

- a LoRA tag such as `<lora:…>` in the text does nothing in ComfyUI: a LoRA is added with its own node;
- the parentheses do not match;
- a weight above 1.5 usually breaks the picture;
- weights in parentheses do little on models that read whole sentences;
- at cfg 1 the negative prompt does nothing;
- the positive prompt is empty;
- the same words stand in both the positive and the negative prompt;
- a negation ("no hat") in the positive prompt is often read the other way;
- the text is not in English, which most models understand worse;
- the text is long for this model (chunks of 75 tokens, or an end that is dropped);
- the trigger words of your LoRA are missing.

See [Prompt](../concepts/Prompt.md) and [Negative prompt](../concepts/Negative-Prompt.md).

## Limits

The check knows what the app has read from your ComfyUI. With nothing read yet, every node is "unknown". It does not run the graph, so it cannot find a problem that shows only while ComfyUI runs (for example, too little graphics card memory). See [An error in ComfyUI](ComfyUI-Errors.md).

- Bypassed and muted nodes are left out: their empty inputs, fields and model files are not reported.
- Model-file lists, upload lists, fields that take a link and lists with several choices are not judged by "Values your ComfyUI does not offer".

## See also

- [The check tab](../interface/Check-Panel.md)
- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [An error in ComfyUI](ComfyUI-Errors.md)
