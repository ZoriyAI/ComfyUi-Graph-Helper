[Русский](Family-Chroma.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Chroma

Chroma: an open image model made from Flux.1 schnell, retrained and slimmed, with a T5 text encoder and no CLIP.

## What it is
Chroma is a community model built on the Flux.1 schnell architecture (about 8.9 billion parameters after pruning) and trained on a broad dataset under an open licence. Unlike Flux dev it uses real CFG and a working negative prompt.

## Files and nodes
**Load Diffusion Model** with the Chroma file; **Load CLIP** with `t5xxl` (type `chroma`), no `clip_l`; **Load VAE** with the Flux `ae.safetensors`; the empty latent of the official template.

## Settings that work
About 1 megapixel; 26 to 40 steps; cfg about 3 to 5 with a negative prompt; `euler` or the template's sampler and scheduler. Prompt: natural sentences.

## What fits
LoRAs made for Chroma. Flux.1 LoRAs may load but often do not behave as expected. The Flux VAE fits.

## How the app helps
Shown as **Chroma** on model cards.

## See also
- [Flux.1](Family-Flux1.md)
- [Text encoders](Text-Encoders.md)
- [The negative prompt](Negative-Prompt.md)
- [Model families](Model-Families.md)
