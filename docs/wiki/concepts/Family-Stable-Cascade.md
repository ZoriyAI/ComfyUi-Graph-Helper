[Русский](Family-Stable-Cascade.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Stable Cascade

Stable Cascade by Stability AI: an image model that works in stages on a very small latent.

## What it is
Stable Cascade (2024) first draws in a highly compressed latent (stage C), then expands it (stage B) and decodes it (stage A). The tiny first latent makes it fast for its size. It saw little use, so few add-ons exist.

## Files and nodes
Two stage checkpoints (stage C and stage B, in versions for checkpoints folder use), each loaded with **Load Checkpoint**; **StableCascade_EmptyLatentImage** makes both latents; two samplers (stage C, then stage B through **StableCascade_StageB_Conditioning**); VAE Decode with stage B's VAE (stage A). Follow the official template.

## Settings that work
About 1024×1024; stage C about 20 steps, cfg about 4; stage B about 10 steps, cfg 1.1; `compression` 42 on the empty latent node.

## What fits
Its own stages and add-ons only; SD 1.5 and SDXL files are not compatible.

## How the app helps
Shown as **Stable Cascade** on model cards.

## See also
- [Model families](Model-Families.md)
- [Latent](Latent.md)
- [Sampler and sampler names](Sampler.md)
