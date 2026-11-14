[Русский](Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A first picture from text

<!-- lesson: image -->
Lesson "image", the first lesson: you build a graph of seven nodes that draws a picture from a prompt.

## What you will be able to do
Build the basic text to image graph from an empty canvas, and say what each of its nodes does: load the model, read the prompt, start from a blank, remove noise, turn the result into pixels, save it.

## What you need
- Built-in nodes only: Load Checkpoint, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image.
- One checkpoint file in `models/checkpoints`: an SD 1.5 or SDXL model, or a model built on them. The app never downloads anything; if the list is empty, open ComfyUI's ready template for a picture from text, which tells you which file is missing and where it goes, then choose **Sync ▸ Sync now**.
- Start from an empty canvas: **File ▸ New project**.

## The steps
1. **How a graph works** (reading): left to right, one job per node, links carry results.
2. **Load the model**: add Load Checkpoint and choose a file in `ckpt_name`. One file holds the drawing model, the text encoder and the VAE, hence three outputs.
3. **Add two texts**: two CLIP Text Encode nodes, because the sampler takes the wanted and the unwanted through different inputs.
4. **Connect the texts to the model**: `CLIP` to the `clip` input of both, so the text reaches the part that reads it.
5. **Write what you want to see**: at least a few words in one text node.
6. **Add the blank**: Empty Latent Image; `width` and `height` set the size.
7. **Add the sampler**: KSampler, where noise becomes a picture.
8. **Bring four links to the sampler**: `MODEL` to `model`, your prompt to `positive`, the other text to `negative`, the blank to `latent_image`.
9. **Turn the result into a picture**: VAE Decode, fed by the sampler and by the checkpoint's `VAE`.
10. **Save the picture**: Save Image after VAE Decode; without it ComfyUI has nowhere to put the result.
11. **The graph is ready** (reading): save the workflow, run it in ComfyUI, try other `seed`, `steps` (20 to 30) and `cfg` (usually 5 to 8).

## What the lesson checks
The nodes are on the canvas, a file is chosen in `ckpt_name`, the positive text has at least 3 characters, and every link listed above exists. A LoRA loader or CLIP Set Last Layer between the checkpoint and the texts or sampler is accepted.

## Mistakes people make
- positive and negative swapped: the picture avoids what you wrote.
- `CLIP` connected to only one text node.
- Leaving the 512×512 default with an SDXL model: the lesson does not check the size; use 1024×1024 for SDXL. See [Resolution](../concepts/Resolution.md).

## What next
[The description: how a model reads it](Prompt.md) and [Refining with a second model](Refine.md) both go on from this graph.

## See also
- [Text to image](../concepts/Text-To-Image.md)
- [Checkpoint](../concepts/Checkpoint.md)
- [Latent](../concepts/Latent.md)
- [Sampler and sampler names](../concepts/Sampler.md)
- [VAE](../concepts/VAE.md)
- [How lessons work](How-Lessons-Work.md)
