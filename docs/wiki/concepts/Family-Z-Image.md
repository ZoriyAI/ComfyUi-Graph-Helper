[Русский](Family-Z-Image.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Z-Image

Z-Image by Alibaba's Tongyi lab: a 6-billion-parameter image model; its Turbo version draws good pictures in a few steps on ordinary cards.

## What it is
Z-Image (late 2025) is a compact image model that reads sentences in English and Chinese and renders text well. **Z-Image Turbo** is distilled for about 8 steps and runs on cards with 12 to 16 GB (less with fp8 or GGUF files). Its small size and speed made it a popular choice for newcomers.

## Files and nodes
**Load Diffusion Model** with the Z-Image file; **Load CLIP** with `qwen_3_4b`; **Load VAE** with the Flux `ae.safetensors`; the empty latent of the official template.

## Settings that work
About 1 megapixel (1024×1024); Turbo: about 8 to 9 steps, cfg 1 (so no negative prompt); the template's sampler and scheduler. Prompt: detailed natural sentences.

## What fits
Only Z-Image LoRAs and control patches. Flux LoRAs do not work, although the VAE is shared with Flux.1.

## How the app helps
Shown as **Z-Image** on model cards.

## See also
- [Speed-up LoRAs](Speed-Up-LoRAs.md)
- [Text encoders](Text-Encoders.md)
- [Model families](Model-Families.md)
- [Graphics card memory](Graphics-Card-Memory.md)
