[Русский](Family-SD3.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# SD 3 and 3.5

Stable Diffusion 3 and 3.5 by Stability AI: image models with three text encoders and a 16-channel latent.

## What it is
SD3 Medium (2024) and SD 3.5 Large, Large Turbo and Medium (late 2024) are transformer models ("MMDiT") that read sentences well thanks to a T5 encoder next to two CLIP encoders. They are used less than SDXL and Flux, so fewer add-ons exist.

## Files and nodes
Either a checkpoint that includes the text encoders (Load Checkpoint), or the model alone with **TripleCLIPLoader** (`clip_l`, `clip_g`, `t5xxl`) and its VAE. **EmptySD3LatentImage** (16 channels). **ModelSamplingSD3** sets the shift.

## Settings that work
About one megapixel (1024×1024); 28 to 40 steps; cfg about 4 to 5.5 (Large Turbo: about 4 steps, cfg near 1); `euler` or `dpmpp_2m` with `sgm_uniform` or `simple`, per the template. Prompt: sentences.

## What fits
Only SD3 or SD 3.5 LoRAs and ControlNets, and only for the same size (Medium and Large differ). SDXL and Flux add-ons do not work.

## How the app helps
Shown as **SD 3** on model cards. The lesson [SD 3.5: one file and a new empty latent](../lessons/SD35.md) builds its graph.

## See also
- [Model families](Model-Families.md)
- [Text encoders](Text-Encoders.md)
- [Scheduler](Scheduler.md)
