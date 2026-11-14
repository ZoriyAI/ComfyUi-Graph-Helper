[Русский](Family-Flux1.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Flux.1

Flux.1 by Black Forest Labs: a large image model (dev, schnell and tool models) that reads sentences and follows prompts closely.

## What it is
Released in 2024, Flux.1 is a 12-billion-parameter transformer. **dev** is the quality version (non-commercial licence for the weights); **schnell** is distilled for 4 steps (Apache 2.0). Black Forest Labs also published **Fill** (inpainting and outpainting), **Canny** and **Depth** (control), **Redux** (image variations) and **Kontext** (editing by instruction). A large ecosystem of fine-tunes and LoRAs exists for dev.

## Files and nodes
- **Load Diffusion Model**: `flux1-dev` or `flux1-schnell` (fp8 versions about 12 GB) in `models/diffusion_models`. Some all-in-one fp8 checkpoints load with Load Checkpoint instead.
- **DualCLIPLoader**: `clip_l` and `t5xxl` (fp16 or fp8), `type` `flux`.
- **Load VAE**: `ae.safetensors`.
- **EmptySD3LatentImage**; **FluxGuidance** on the positive conditioning; often **ModelSamplingFlux**; many templates use SamplerCustomAdvanced with BasicGuider.

## Settings that work
About 1 megapixel, flexible up to about 2; dev: 20 to 30 steps, cfg 1, FluxGuidance about 3.5 (lower for more realism), `euler` with `simple` or `beta`. schnell: 4 steps, cfg 1. Prompt: natural sentences; it can write short text in quotes. The negative prompt does nothing at cfg 1.

## What fits
Only Flux.1 LoRAs and ControlNets. Flux.2 files are not compatible. Krea and Chroma are related but behave differently with Flux.1 LoRAs.

## How the app helps
Shown as **Flux.1** on model cards. The built-in knowledge describes FluxGuidance and ModelSamplingFlux.

## See also
- [CFG and guidance](CFG.md)
- [Flux.1 Krea](Family-Krea.md)
- [Flux.2](Family-Flux2.md)
- [Chroma](Family-Chroma.md)
- [Separate loaders](Separate-Loaders.md)
