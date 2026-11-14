[Русский](Family-LTX2.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# LTX-2

LTX-2 by Lightricks: an open model that makes video together with its sound, for text to video and image to video.

## What it is
LTX-2 generates the picture and a matching soundtrack (speech, effects, music) in one run. It follows the earlier LTX-Video line, which was known for speed, but its files are a new family. Its templates include a two-stage approach with its own upscale models for higher resolution.

## Files and nodes
LTX-2 uses its own model, text encoder and latent nodes, plus upscale models; start from ComfyUI's official LTX-2 templates for the exact files and nodes rather than building by hand.

## Settings that work
Take size, length (8n + 1 frames), frame rate (around 24 to 25), steps and guidance from the template. Prompt: detailed sentences that describe the scene, the action, the camera and what is heard.

## What fits
Only LTX-2 LoRAs. LoRAs for the older LTX-Video (0.9.x) models are not compatible.

## How the app helps
Shown as **LTX-2** on model cards. There is no LTX-2 lesson yet.

## See also
- [Audio](Audio.md)
- [Video generation](Video-Models.md)
- [Upscaling](Upscaling.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
