[Русский](Node-Fields.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Node fields

Fields are the settings of a node: how many steps, which sampler, which model file, the prompt. You set them right on the node or in [Properties](../interface/Properties.md); both show the same value. The options come from your ComfyUI, so a list shows what your ComfyUI offers. What a field means: the small **i** beside the field name in Properties ("What this field does") opens the built-in note; the question mark at the end of the row asks the assistant; right-click the node ▸ **Explain the inputs and outputs** asks about all of them.

## Kinds of fields

| Kind | How you set it |
|---|---|
| A whole number (steps, width, seed) | type it, or use **Decrease** / **Increase**. Properties shows the range: "From 1 to 10000". |
| A decimal number (cfg, denoise) | the same; the value keeps to the field's step. |
| A seed with **Random** | **Random value for seed** picks a new number. See [Seed](../concepts/Seed.md). |
| The **after run** row under a seed | what ComfyUI does with the value after each run: **fixed** keeps it (the same result again), **increment** and **decrement** change it by one, **randomize** draws a new one (a new result every time). It is saved in the workflow. |
| A switch | **on** / **off**. |
| A list (sampler_name, scheduler) | open it and choose; **Find in the list** narrows a long list, "Nothing matches" when nothing does. |
| A model file (ckpt_name, lora_name) | a list of your files, with a mark of how each fits. See [Choosing a model file](Model-Files.md). |
| A text (the prompt) | type in the box. See [Prompt](../concepts/Prompt.md). |

## Marks on a field

- "not set": the field has no value. If it has no default either, the check and the export warn: "Field … has no value and no default; set it before saving for ComfyUI."
- "not in the list": "This value is not among the options ComfyUI offers for this field." Common in an opened workflow made on another computer.
- "← link": the value comes through a link from another node.
- "This field is set in ComfyUI itself.": the app cannot show this kind of field; ComfyUI keeps its value.
- "service data": the node keeps this for itself, for example the state of a preview. It goes back to ComfyUI unchanged.

## When a typed number changes

A number field keeps to its range and step and says why it changed what you typed: "The smallest allowed is 1; set to 1.", "The largest allowed is …; set to ….", "Rounded to …." Text that is not a number is refused: "That is not a number; the value stays …."

## How each change is kept

Every field change is one step of the history: `Ctrl+Z` takes it back, and the undo button names it ("Undo: set KSampler.steps").

## What can go wrong

- A node whose class is not read yet shows no fields: "This node has saved values, but the app does not know its fields yet…" Sync, and the fields appear.
- "The app does not know the exact order of this node's fields, so these values are not written to the saved workflow." This happens with a node your ComfyUI does not describe fully; set the values in ComfyUI.
- A node your ComfyUI does not have shows "Not installed" and its saved values, read-only. They go back to ComfyUI unchanged.

## See also

- [Choosing a model file](Model-Files.md)
- [Properties](../interface/Properties.md)
- [Steps](../concepts/Steps.md), [CFG](../concepts/CFG.md), [Sampler](../concepts/Sampler.md)
- [Connecting nodes](Connecting-Nodes.md)
