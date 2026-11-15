[Русский](Family-Pony.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Pony

Pony Diffusion: a line of models trained further from SDXL, with its own quality and rating tags.

## What it is
Pony Diffusion V6 XL is an SDXL model retrained at large scale on stylised and anime material. Many further fine-tunes are built on it. Technically it is SDXL: it loads, runs and sizes exactly like SDXL. What differs is how it reads the prompt.

## Files and nodes
One checkpoint in `models/checkpoints`, **Load Checkpoint**, Empty Latent Image, as for SDXL. Many Pony models want **CLIP Set Last Layer** at -2; the model page says.

## Settings that work
SDXL sizes (1024×1024, 832×1216); 25 to 30 steps; cfg about 5 to 7; `euler_ancestral` or `dpmpp_2m`. Prompt: tags, starting with its score tags (`score_9, score_8_up, score_7_up, ...`) as the model page lists, plus source and rating tags the page documents.

## What fits
LoRAs trained for Pony fit best. SDXL LoRAs load but often behave differently; Illustrious LoRAs are hit and miss. SD 1.5 and Flux add-ons do not work.

## How the app helps
Shown as **Pony** on model cards, separate from plain SDXL, so a LoRA's card can tell Pony LoRAs from SDXL ones. The lesson [Pony and Illustrious: tags instead of sentences](../lessons/Pony-And-Illustrious.md) writes a tag prompt.

## See also
- [SDXL](Family-SDXL.md)
- [Illustrious](Family-Illustrious.md)
- [The prompt](Prompt.md)
- [Why families do not mix](Why-Families-Do-Not-Mix.md)
