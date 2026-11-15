[Русский](Family-Wan22.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Wan 2.2

Wan 2.2 by Alibaba: the video model of most lessons in the app; the 14B version works as two experts, the 5B version as one small model.

## What it is
Wan 2.2 (2025) improves motion and look over Wan 2.1. The **14B** models (`t2v` and `i2v`) are a pair: a `high_noise` expert lays out the clip and a `low_noise` expert finishes it, in two samplers (see [Wan 2.2 two passes](Wan-Two-Passes.md)). The **5B** model (`ti2v`) does both text and image to video in one model on cards with about 8 GB, with its own VAE. Further models: **Animate** (pose and face from a video), **S2V** (sound to video), **Fun** Control and InP, and VACE modules for 2.2.

## Files and nodes
- 14B: two **Load Diffusion Model** nodes (`wan2.2_t2v_high_noise_14B` and `..._low_noise_14B`, or the `i2v` pair); **Load CLIP** with `umt5_xxl` (type `wan`); **Load VAE** with `wan_2.1_vae` (the 14B models use the 2.1 VAE); two **ModelSamplingSD3**; EmptyHunyuanLatentVideo or WanImageToVideo; two KSampler (Advanced).
- 5B: one Load Diffusion Model (`wan2.2_ti2v_5B`), the same text encoder, **`wan2.2_vae`**, Wan22ImageToVideoLatent, one sampler.

## Settings that work
14B: 832×480 or 1280×720, 81 frames at 16 fps, 20 steps handed over at 10, cfg 3.5, shift 8; with lightx2v LoRAs 4 steps handed over at 2, cfg 1. 5B: 1280×704, 121 frames at 24 fps. Prompt: detailed sentences with action and camera.

## What fits
LoRAs for Wan 2.2 and the right expert (`high` or `low` files); many Wan 2.1 14B LoRAs work too. The 5B and 14B add-ons are not interchangeable.

## How the app helps
Shown as **Wan 2.2** on model cards. Most lessons of the groups **Video**, **Video: the anchor picture** and **WanVideoWrapper** are built on it, the 5B model among them in [Video on a modest graphics card: Wan 2.2 5B](../lessons/Video-Small.md).

## See also
- [Wan 2.2 two passes](Wan-Two-Passes.md)
- [Wan 2.1](Family-Wan21.md)
- [Speed-up LoRAs](Speed-Up-LoRAs.md)
- [Lesson: Video from text](../lessons/Video-Text.md)
