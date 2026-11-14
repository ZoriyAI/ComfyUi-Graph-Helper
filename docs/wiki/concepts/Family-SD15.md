[Русский](Family-SD15.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# SD 1.5

Stable Diffusion 1.5: the classic image model for 512 pixels, small and fast, with the largest library of add-ons.

## What it is
Released in 2022, SD 1.5 is light enough for almost any graphics card (about 2 to 4 GB of weights) and has thousands of fine-tuned checkpoints, LoRAs, embeddings and ControlNets. Its picture quality and prompt understanding are below newer families, but it is still used for speed, for old workflows and for its ControlNet and IP-Adapter tools.

## Files and nodes
One checkpoint in `models/checkpoints`, loaded with **Load Checkpoint** (MODEL, CLIP, VAE). Text encoder: CLIP ViT-L (`clip_l`). Empty Latent Image (4 channels). Some anime models ask for **CLIP Set Last Layer** at -2 ("clip skip 2").

## Settings that work
512×512 or 512×768; 20 to 30 steps; cfg 7 to 8; `euler`, `euler_ancestral` or `dpmpp_2m` with `karras`. Prompt: tags and short phrases, 75-token chunks. Hires fix to reach 1024.

## What fits
Only SD 1.5 LoRAs, embeddings, ControlNets and IP-Adapters. SDXL and Flux add-ons do not work. SD 2.x is a different family.

## How the app helps
The family appears as **SD 1.5** on model cards; the first lesson works with an SD 1.5 checkpoint.

## See also
- [Model families](Model-Families.md)
- [SDXL](Family-SDXL.md)
- [Checkpoint](Checkpoint.md)
- [Resolution and aspect ratio](Resolution.md)
