[Русский](Family-Krea.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Krea 2

Krea 2 by Krea AI: a picture model trained from scratch, with an architecture of its own. The app shows the family
as **Krea 2**.

## What it is
Krea 2 is not a version of Flux. It comes in two kinds:
- **RAW**: the base, made for training LoRAs; it needs many steps (about 52).
- **Turbo**: distilled to 8 steps, for making pictures.

## Not FLUX.1 Krea [dev]
FLUX.1 Krea [dev] is another model with a similar name: a Flux.1 dev model trained again by Krea. It loads exactly
like Flux.1 and belongs to the [Flux.1](Family-Flux1.md) family. The app sorts files the same way: a name that holds
both Flux and Krea ("Flux.1 Krea", "krea-flux") is Flux.1; a name that holds only "krea" or "krea2" is Krea 2.

## Files and nodes
- The model, for example `krea2_turbo`, in `models/diffusion_models`, with **Load Diffusion Model**.
- The text encoder `qwen3vl_4b` in `models/text_encoders`, with **Load CLIP**, `type` `krea2`.
- The VAE `qwen_image_vae` in `models/vae`, with **Load VAE**.

Start from ComfyUI's Krea 2 template for the exact files.

## Settings that work
The template of Krea 2 Turbo: **Empty Latent Image** 1024 × 1024, **KSampler** 8 steps, `cfg` 1, `euler`, `simple`,
and **ConditioningZeroOut** in place of a negative prompt. RAW needs about 52 steps.

## What fits
Only files made for Krea 2. Flux LoRAs do not work with it. LoRAs trained on RAW also work on Turbo.

## How the app helps
Shown as **Krea 2** on model cards. Hold the pointer over the family label to read the built-in note: what Krea 2
is, where its files go, and that it is not FLUX.1 Krea [dev], so Flux LoRAs do not work with it.

## See also
- [Flux.1](Family-Flux1.md)
- [Model families](Model-Families.md)
- [Why families do not mix](Why-Families-Do-Not-Mix.md)
- [Separate loaders](Separate-Loaders.md)
