[Русский](Family-Kolors.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Kolors

Kolors by Kuaishou: an image model similar to SDXL in size and design, but with the ChatGLM language model as its text encoder.

## What it is
Kolors (2024) draws at SDXL sizes and reads Chinese and English prompts through ChatGLM3. Because of that encoder it needs loader and text nodes that core ComfyUI does not provide; people use node packs made for Kolors.

## Files and nodes
The Kolors model, the ChatGLM3 text encoder and an SDXL-type VAE, loaded through the pack's own nodes; follow the pack's example workflow.

## Settings that work
SDXL sizes (1024×1024); about 25 to 50 steps; cfg about 5 to 6.5. Prompt: sentences in Chinese or English.

## What fits
Add-ons made for Kolors (its own IP-Adapter and ControlNets). SDXL LoRAs and ControlNets are not reliably compatible.

## How the app helps
Shown as **Kolors** on model cards. A Kolors graph needs a pack, so **Check** will list its nodes if the pack is missing.

## See also
- [SDXL](Family-SDXL.md)
- [Node packs](Node-Packs.md)
- [Model families](Model-Families.md)
