[Русский](Family-Wan21.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Wan 2.1

Wan 2.1 by Alibaba: an open video model for text to video and image to video, in a small 1.3B and a large 14B size, with many add-ons.

## What it is
Released in 2025, Wan 2.1 made good open video generation practical. The 14B models come in 480p and 720p versions for text to video (`t2v`) and image to video (`i2v`); the 1.3B model runs on small cards. A large family of add-ons builds on it: VACE, first-last-frame (FLF2V), Fun Control and InP, InfiniteTalk and MultiTalk, FantasyTalking, UniAnimate, ReCamMaster, speed-up LoRAs.

## Files and nodes
**Load Diffusion Model** (`wan2.1_t2v_14B`, `wan2.1_i2v_480p_14B` and others); **Load CLIP** with `umt5_xxl` (type `wan`); **Load VAE** with `wan_2.1_vae`; for image to video also **Load CLIP Vision** with `clip_vision_h`. EmptyHunyuanLatentVideo or WanImageToVideo; ModelSamplingSD3; one KSampler.

## Settings that work
832×480 (480p) or 1280×720 (720p); 81 frames at 16 fps; about 20 to 30 steps; cfg about 5 to 6 in the official templates (lower with speed-up LoRAs: 4 to 8 steps, cfg 1); shift about 5 to 8. Prompt: detailed sentences in English or Chinese.

## What fits
LoRAs for Wan 2.1 and for the same size: 1.3B and 14B are not interchangeable. Many 14B LoRAs also work on Wan 2.2 14B.

## How the app helps
Shown as **Wan 2.1** on model cards. The InfiniteTalk, FantasyTalking, UniAnimate and ReCamMaster lessons use Wan 2.1 models.

## See also
- [Wan 2.2](Family-Wan22.md)
- [Video generation](Video-Models.md)
- [Talking portraits](Talking-Portraits.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
