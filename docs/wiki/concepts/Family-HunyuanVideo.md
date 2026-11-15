[Русский](Family-HunyuanVideo.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# HunyuanVideo

HunyuanVideo by Tencent: an open video model with a language-model text encoder; version 1.5 is a separate, lighter family.

## What it is
HunyuanVideo (late 2024) is a 13-billion-parameter text to video model; an image to video version followed. **HunyuanVideo 1.5** (late 2025) is a newer, smaller model with its own files and graphs. Tencent's Hunyuan image models are separate families again.

## Files and nodes
**Load Diffusion Model** with the HunyuanVideo model; **DualCLIPLoader** with `clip_l` and `llava_llama3` (type `hunyuan_video`); **Load VAE** with `hunyuan_video_vae`; **EmptyHunyuanLatentVideo**; image to video adds a CLIP Vision encoder and its own conditioning node. Version 1.5 has its own template.

## Settings that work
About 848×480 to 1280×720; up to about 129 frames at 24 fps (4n + 1); about 20 to 30 steps; guidance through a FluxGuidance-style node in the templates; `euler` with `simple`. Prompt: detailed sentences.

## What fits
LoRAs made for HunyuanVideo (and for 1.5 separately). Wan LoRAs do not work.

## How the app helps
Shown as **HunyuanVideo** on model cards. The node EmptyHunyuanLatentVideo, named after this family, is also used by Wan graphs. The lesson [Video from text: HunyuanVideo 1.5](../lessons/Video-Hunyuan.md) builds a HunyuanVideo 1.5 graph.

## See also
- [Video generation](Video-Models.md)
- [Text encoders](Text-Encoders.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
