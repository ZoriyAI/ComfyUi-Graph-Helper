[Русский](Model-Files.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Choosing a model file

A loader node (Load Checkpoint, Load LoRA, Load VAE and others) has a field that names a file, for example `ckpt_name` or `lora_name`. The list of that field shows the files in the matching ComfyUI folder, and next to each a mark that says whether it fits the rest of your graph. "Fits" here means: made for the same model family. A LoRA made for SDXL does not work with a Flux checkpoint. See [Model families](../concepts/Model-Families.md).

## How to choose

1. Click the field of the loader. The list opens; while it reads your files it says "Looking at your files…".
2. At the top it names what it compares with: "Compared with juggernautXL.safetensors (SDXL)", the checkpoint upstream in your graph.
3. Each file has a mark:

| Mark | Meaning |
|---|---|
| **fits** | made for the same family |
| **loads, but made for SDXL** | a related family: ComfyUI loads it, but the result may be poor |
| **family differs: Flux.1 ≠ SDXL** | a different family: it will not work as meant |
| **family unknown** | neither the file nor its name says the family |

4. Pick one. **Find in the list** narrows a long list.

When there is nothing to compare with: "Connect a checkpoint upstream and the list shows which files fit it." (for a LoRA) or "Connect a LoRA downstream and the list shows which checkpoints fit it." (for a checkpoint).

## Other ways

- In the library **Models** tab, open a file's card and press **Add to canvas** (a new loader with the file) or **Put into the selected node** (the selected loader takes the file). See [The model card](../interface/Model-Card.md).
- A LoRA card lists "Your base models it fits:"; a checkpoint card says how many of your LoRAs fit it and **Show them in the list**.

## Where the family comes from

From the header of the file, from the description that lies next to it (written by tools such as a Civitai helper), from the internet if you asked (**Find on the internet**), or a guess from the file name. Until sync has read the header, it is a guess.

## What can go wrong

- "There are no files in this list." Your ComfyUI has no files in that folder. The app never downloads; put the file in ComfyUI's folder and sync.
- "Models from different families" in the check: two models in one chain are of different families. See [Checking a graph](Checking-A-Graph.md).

## See also

- [Model families](../concepts/Model-Families.md)
- [Models in the library](../interface/Model-Library.md)
- [LoRA](../concepts/LoRA.md), [Checkpoint](../concepts/Checkpoint.md)
- [Where files live](../concepts/Where-Files-Live.md)
