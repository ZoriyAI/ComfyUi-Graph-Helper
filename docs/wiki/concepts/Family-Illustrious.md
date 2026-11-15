[Русский](Family-Illustrious.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Illustrious

Illustrious XL: an anime-focused line of models trained further from SDXL, and the base of NoobAI and many fine-tunes.

## What it is
Illustrious XL was trained from SDXL on a large set of tagged illustrations. It knows many characters and art styles by their tags. NoobAI-XL and a large number of anime checkpoints are built on it. Like Pony, it is SDXL inside.

## Files and nodes
One checkpoint, **Load Checkpoint**, Empty Latent Image, as for SDXL.

## Settings that work
SDXL sizes, often a little larger (up to about 1536 on later versions, per the model page); 20 to 30 steps; cfg about 5 to 7; `euler_ancestral` or `euler`. Prompt: booru-style tags (`1girl, solo, red coat, outdoors, rain`) with quality tags the model page recommends (for example `masterpiece, best quality`).

## What fits
LoRAs trained for Illustrious or NoobAI fit best; SDXL LoRAs load with mixed results; Pony LoRAs often misbehave. SD 1.5 and Flux add-ons do not work.

## How the app helps
Shown as **Illustrious** on model cards; names with `illustrious`, `noobai`, `ill` or `ilxl` as separate words are recognised. The lesson [Pony and Illustrious: tags instead of sentences](../lessons/Pony-And-Illustrious.md) writes a tag prompt.

## See also
- [SDXL](Family-SDXL.md)
- [Pony](Family-Pony.md)
- [The prompt](Prompt.md)
- [Model families](Model-Families.md)
