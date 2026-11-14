[Русский](Checkpoint.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Checkpoint

The main model file: one file that holds everything a basic picture graph needs.

## In plain words
A **checkpoint** is a model saved as one file, usually `.safetensors`, several gigabytes in size. For the classic families (SD 1.5, SDXL and the lines built on SDXL such as Pony and Illustrious) a checkpoint holds three parts at once:
- the **diffusion model**, the part that removes noise and draws (output `MODEL`);
- the **text encoder**, the part that reads the prompt (output `CLIP`);
- the **VAE**, the part that turns the result into pixels (output `VAE`).

A **fine-tuned** checkpoint is a base model trained further by someone on their own pictures: "juggernautXL", "RealVisXL" and thousands of others are fine-tuned SDXL checkpoints. They keep the family of their base, so they take the same LoRAs and the same sizes.

Newer families (Flux, Qwen-Image, Z-Image, Wan, HunyuanVideo) are usually shipped as separate files for each part. Those are loaded with [separate loaders](Separate-Loaders.md), not with Load Checkpoint.

## Where you meet it in a graph
**Load Checkpoint** (class `CheckpointLoaderSimple`) reads files from `models/checkpoints`. It has one field, `ckpt_name`, and three outputs:
- `MODEL` to LoRA loaders or to the sampler's `model` input;
- `CLIP` to CLIP Text Encode nodes (or through Load LoRA first);
- `VAE` to VAE Decode and VAE Encode.

## Values and what they change
The only choice is the file. What you choose decides the family, and the family decides the sizes, the CFG range, the prompt style and which LoRAs fit. Read the model's page: authors give the settings they tested.

## Typical mistakes
- **A diffusion-model-only file in Load Checkpoint**: an error such as "could not detect model type", or the node does not even list the file because it lies in `models/diffusion_models`. Use Load Diffusion Model.
- **Wrong size for the family**: an SD 1.5 checkpoint at 1024 gives doubled heads and repeated objects.
- **An `.ckpt` file from an unknown source**: old formats can carry code. See [Unsafe model formats](Unsafe-Model-Formats.md).
- **LoRA of another family**: it loads with warnings and changes nothing, or spoils the picture.

## How the app helps
- The **Models** tab of the library lists your checkpoints. The card of a file shows its **Family**, read from the file's header or guessed from its name, and which of your LoRAs fit it.
- **Check** warns when models of different families meet in one path.
- The first lesson, [A first picture from text](../lessons/Image.md), starts with this node.

## See also
- [Separate loaders](Separate-Loaders.md)
- [Model families](Model-Families.md)
- [VAE](VAE.md)
- [Text encoders](Text-Encoders.md)
- [Where ComfyUI files live](Where-Files-Live.md)
- [The model card](../interface/Model-Card.md)
