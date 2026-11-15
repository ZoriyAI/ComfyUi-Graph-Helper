[Русский](Family-SDXL.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# SDXL

Stable Diffusion XL: the image model for about 1024 pixels with two text encoders, and the base of Pony, Illustrious and countless fine-tunes.

## What it is
Released in 2023, SDXL draws at about one megapixel with much better composition than SD 1.5, and runs on cards with 8 GB or more. Its ecosystem of fine-tuned checkpoints (realistic, illustration, anime), LoRAs and ControlNets is the largest after SD 1.5. The original release had an optional refiner model; fine-tuned checkpoints rarely need it.

## Files and nodes
One checkpoint (about 6.5 GB) in `models/checkpoints`, loaded with **Load Checkpoint**. Two text encoders inside (`clip_l` and `clip_g`). Empty Latent Image.

## Settings that work
About one megapixel: 1024×1024, 832×1216, 1216×832, 1344×768. 20 to 35 steps; cfg 5 to 7; `dpmpp_2m` with `karras`, or `euler`. Prompt: tags and short phrases. Speed-up versions (Turbo, Lightning, Hyper, DMD2) use 4 to 8 steps and low cfg.

## What fits
SDXL LoRAs and ControlNets (also on Pony and Illustrious, with varying results). SD 1.5 and Flux add-ons do not work. A refiner pass can be any SDXL model.

## How the app helps
Shown as **SDXL** on model cards; names with a separate `XL` word are recognised as SDXL. The lesson [SDXL done properly](../lessons/SDXL.md) sets the size and the sampler the family was trained for, and checks that the checkpoint is SDXL.

## See also
- [Pony](Family-Pony.md)
- [Illustrious](Family-Illustrious.md)
- [SD 1.5](Family-SD15.md)
- [Model families](Model-Families.md)
