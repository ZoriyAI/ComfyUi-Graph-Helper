[Русский](Family-Krea.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Flux.1 Krea

FLUX.1 Krea [dev]: a Flux.1 dev model trained again by Krea and Black Forest Labs for a more natural, less "AI-looking" style.

## What it is
FLUX.1 Krea [dev] (2025) keeps the Flux.1 dev architecture and was further trained for photographic realism and varied aesthetics. It is a drop-in replacement for Flux.1 dev.

## Files and nodes
Exactly as Flux.1: **Load Diffusion Model** with the Krea file, **DualCLIPLoader** with `clip_l` and `t5xxl` (type `flux`), **Load VAE** with `ae.safetensors`, EmptySD3LatentImage, FluxGuidance.

## Settings that work
As Flux.1 dev: about 1 megapixel, 20 to 30 steps, cfg 1 with guidance about 3.5 to 4.5, `euler`. Prompt: natural sentences.

## What fits
Flux.1 dev LoRAs usually load, but results can differ from the original model. Flux.2 files do not fit.

## In the app
The built-in knowledge has a family entry "krea" that describes FLUX.1 Krea [dev]. The app's file detection, however, sorts files named "Flux.1 Krea" under **Flux.1**, and shows the label **Krea 2** for files named only "krea", treating them as a separate architecture. So a FLUX.1 Krea file normally appears as Flux.1 on its card.
<!-- verify: the krea family label and text (knowledge says FLUX.1 Krea dev, the label says Krea 2) -->

## See also
- [Flux.1](Family-Flux1.md)
- [Model families](Model-Families.md)
- [CFG and guidance](CFG.md)
