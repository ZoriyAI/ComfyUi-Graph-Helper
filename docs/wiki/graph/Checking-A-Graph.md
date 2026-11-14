[Русский](Checking-A-Graph.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Checking a graph

The check compares your graph with what your ComfyUI has, and finds what ComfyUI would refuse or run badly. It runs nothing and changes nothing in ComfyUI, and needs no model. It also gives advice on your prompts. The tab where the result shows: [The check tab](../interface/Check-Panel.md).

## How to check

1. **Check** on the toolbar, **Graph ▸ Check graph**, or `Ctrl+Shift+C`. The **Check** tab opens.
2. Read the findings. Each names the node ("Node number 7").
3. **Show** takes you to the node; **Ask why** asks the assistant how to fix it.
4. Fix, then check again. "No problems found." means ComfyUI should accept the graph.

**File ▸ Save workflow for ComfyUI…** runs the same check first and asks when it finds something. Nodes with a problem get a red outline and a warning sign on the canvas; an empty required input gets an amber dot.

## The kinds of findings

| Finding | Example | What to do |
|---|---|---|
| **Nodes that are not installed** | The node "WanVideo Sampler" is not installed in your ComfyUI. Install the pack that provides WanVideoSampler. | Install the node pack in ComfyUI yourself, then **Sync ▸ Sync now**. Or replace the node with one you have. |
| **Models that are not on disk** | sdxl_base.safetensors is not in checkpoints (node "Load Checkpoint"). | Choose another file in the field, or put the file into that folder of ComfyUI and sync. See [Choosing a model file](Model-Files.md). |
| **Connections with the wrong type** | "VAE Decode" → "Save Image": LATENT goes into an input that expects IMAGE. | Remove the link and connect outputs and inputs of the same type. See [Connecting nodes](Connecting-Nodes.md). |
| **Models from different families** | lora_x is made for SDXL, but flux_dev upstream is Flux.1. | Pick a LoRA, VAE or checkpoint of the same family. See [Model families](../concepts/Model-Families.md). |
| **Required inputs left empty** | Input model (MODEL) on "KSampler" needs a connection. | Connect something of that type. |
| **Unknown node types** | XYZ is not in the synced catalog. | Sync; if it stays, the node comes from a pack you do not have. |
| **Fields with no value** | Field seed on "KSampler" has no value and no default; set it before saving for ComfyUI. | Set the field. See [Node fields](Node-Fields.md). |

## Advice on descriptions

Under **Descriptions: worth changing**: "These are not errors: the graph will run. But with them the result usually comes out worse than you expect." The check looks at your prompts and says, for example:

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

<!-- verify: the canvas and files branch adds a check that finds more of what ComfyUI refuses to run; list the new kinds -->

## See also

- [The check tab](../interface/Check-Panel.md)
- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [An error in ComfyUI](ComfyUI-Errors.md)
