[Русский](LoRA.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# LoRA

A small add-on that teaches a model a style, a character, an object or a kind of motion.

## In plain words
A **LoRA** (low-rank adaptation) is a small file, usually tens to a few hundred megabytes, trained on top of one base model. It does not replace the model; it nudges it. One LoRA teaches one thing: a drawing style, a person's look (with consent), a costume, a camera move, or speed (see [Speed-up LoRAs](Speed-Up-LoRAs.md)).

A LoRA works only with the family it was trained for: an SDXL LoRA on an SDXL-based model, a Wan 2.2 14B LoRA on Wan 2.2 14B.

## Where you meet it in a graph
- **Load LoRA** (`LoraLoader`): `model` and `clip` in, changed `MODEL` and `CLIP` out; fields `lora_name`, `strength_model`, `strength_clip`. For SD 1.5 and SDXL, whose LoRAs often change the text encoder too.
- **LoraLoaderModelOnly**: `model` in, `MODEL` out, `strength_model` only. Common for Flux, Qwen-Image, Z-Image and Wan.
- It stands **in the path of the model**: between the loader and whatever uses the model (the sampler, or ModelSamplingSD3 in Wan graphs). With Load LoRA, the text nodes must take `CLIP` from the LoRA node, not from the checkpoint.
- **Several at once**: chain them, the output of one into the next. Order rarely matters.
- **Two-model graphs**: Wan 2.2 14B LoRAs often come as a `high` and a `low` file, one for each model.
- Files live in `models/loras`.

## Values and what they change
- `strength_model` 1 is full strength. If the LoRA overrides everything or breaks the picture, try 0.6 to 0.8. Above about 1.2 most LoRAs distort.
- `strength_clip` changes how the prompt is read; usually the same as `strength_model`.
- Several strong LoRAs fight each other; lower each.
- **Trigger words**: many LoRAs act only when the prompt contains the words they were trained with. Authors often write them into the file's metadata or on the download page.

## Typical mistakes
- **A LoRA of another family**: ComfyUI loads it with "lora key not loaded" warnings in its log and the picture does not change. It does not stop.
- **No trigger words**: the LoRA barely acts.
- **`<lora:name:1>` in the prompt**: does nothing in ComfyUI.
- **The text nodes still fed from the checkpoint** after a Load LoRA: the CLIP part of the LoRA is skipped.

## How the app helps
- The **Models** tab card of a LoRA shows its **Family**, its **Trigger words** (click to copy), the strength the author advises, and which of your checkpoints it fits.
- **Check** reports models of different families in one path and a prompt missing a LoRA's trigger words.
- Lessons: [LoRA: add a style or a subject](../lessons/LoRA.md), [Fast video in four steps](../lessons/Video-Fast.md), [LoRA for pictures](../lessons/LoRA-Image.md), [LoRA for a character: face, body, clothes, pose](../lessons/LoRA-Character.md). A lesson checks that the LoRA is made for the family of the checkpoint and that its trigger words are in the prompt.

## See also
- [Speed-up LoRAs](Speed-Up-LoRAs.md)
- [Why families do not mix](Why-Families-Do-Not-Mix.md)
- [Model families](Model-Families.md)
- [Prompt syntax and weights](Prompt-Syntax.md)
- [The model card](../interface/Model-Card.md)
