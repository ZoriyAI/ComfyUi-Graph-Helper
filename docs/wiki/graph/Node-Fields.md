[Русский](Node-Fields.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Node fields

Fields are the settings of a node: how many steps, which sampler, which model file, the prompt. You set them right on the node or in [Properties](../interface/Properties.md); both show the same value. The options come from your ComfyUI, so a list shows what your ComfyUI offers. What a field means: right-click the node ▸ **Explain the ports**, or the question mark next to the field in Properties.

## Kinds of fields

| Kind | How you set it |
|---|---|
| A whole number (steps, width, seed) | type it, or use **Decrease** / **Increase**. Properties shows the range: "From 1 to 10000". |
| A decimal number (cfg, denoise) | the same; the value keeps to the field's step. |
| A seed with **Random** | **Random value for seed** picks a new number. See [Seed](../concepts/Seed.md). |
| A switch | **on** / **off**. |
| A list (sampler_name, scheduler) | open it and choose; **Find in the list** narrows a long list, "Nothing matches" when nothing does. |
| A model file (ckpt_name, lora_name) | a list of your files, with a mark of how each fits. See [Choosing a model file](Model-Files.md). |
| A text (the prompt) | type in the box. See [Prompt](../concepts/Prompt.md). |

## Marks on a field

- "not set": the field has no value. If it has no default either, the check and the export warn: "Field … has no value and no default; set it before saving for ComfyUI."
- "not in the list": "This value is not among the options ComfyUI offers for this field." Common in an opened workflow made on another computer.
- "← link": the value comes through a link from another node.
- "This field is set in ComfyUI itself.": the app cannot show this kind of field; ComfyUI keeps its value.

## How each change is kept

Every field change is one step of the history: `Ctrl+Z` takes it back, and the undo button names it ("Undo: set KSampler.steps").

## What can go wrong

- A node whose class is not read yet shows no fields: "This node has saved values, but the app does not know its fields yet…" Sync, and the fields appear.
- "The app does not know the exact order of this node's fields, so these values are not written to the saved workflow." This happens with a node your ComfyUI does not describe fully; set the values in ComfyUI.

<!-- verify: the editing and search branch changes the seed control -->

## See also

- [Choosing a model file](Model-Files.md)
- [Properties](../interface/Properties.md)
- [Steps](../concepts/Steps.md), [CFG](../concepts/CFG.md), [Sampler](../concepts/Sampler.md)
- [Connecting nodes](Connecting-Nodes.md)
