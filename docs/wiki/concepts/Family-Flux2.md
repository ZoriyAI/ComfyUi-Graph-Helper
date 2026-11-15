[Русский](Family-Flux2.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Flux.2

Flux.2 by Black Forest Labs: the second generation of Flux, for pictures and for editing with several reference pictures.

## What it is
Flux.2 (late 2025) is a new architecture, not an update of Flux.1 files. Its **dev** model is large and uses a big language model as its text encoder (a Mistral model); smaller **Klein** models followed for ordinary cards. Flux.2 can take reference pictures and edit or combine them by instruction.

## Files and nodes
**Load Diffusion Model** with the Flux.2 model; **Load CLIP** with its own text encoder, `type` `flux2`; **Load VAE** with the Flux.2 VAE (`flux2-vae`); **Empty Flux 2 Latent** (`EmptyFlux2LatentImage`), the empty latent of the official template; reference pictures go into the conditioning through reference nodes. dev and Klein use different text encoders: dev the Mistral model `mistral_3_small_flux2`, Klein 4B `qwen_3_4b` and Klein 9B `qwen_3_8b`; all share `flux2-vae`. The Klein graph of the templates builds its sampler from parts: **Flux2Scheduler**, **CFGGuider**, **RandomNoise**, **KSamplerSelect** and **SamplerCustomAdvanced**. Start from ComfyUI's Flux.2 or Flux.2 Klein template for the exact files.

## Settings that work
Take steps, guidance and sizes from the template: dev works around 1 to 4 megapixels with guidance; distilled Klein versions use few steps and cfg 1. Prompt: detailed sentences; it handles text in pictures and structured prompts.

## What fits
Only Flux.2 LoRAs, text encoder and VAE. Flux.1 files (LoRAs, `t5xxl`, `ae.safetensors`) do not work with it.

## How the app helps
Shown as **Flux.2** on model cards. The built-in knowledge names both text encoders: the Mistral-based one for dev, `qwen_3_4b` or `qwen_3_8b` for Klein. The lesson [Flux.2 Klein: a sampler built from parts](../lessons/Flux2-Klein.md) builds the Klein graph and checks its files.

## See also
- [Flux.1](Family-Flux1.md)
- [Reference images](Reference-Images.md)
- [Text encoders](Text-Encoders.md)
- [Why families do not mix](Why-Families-Do-Not-Mix.md)
