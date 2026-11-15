[Русский](Family-Qwen-Image.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Qwen-Image

Qwen-Image by Alibaba's Qwen team: a large image model that is especially good at text inside pictures, with editing versions.

## What it is
Qwen-Image (2025) is a 20-billion-parameter model that renders signs, posters and long text in English and Chinese well and follows detailed prompts. **Qwen-Image-Edit** (and its later versions) edits a picture by instruction, can change text in it and can combine several reference pictures.

## Files and nodes
**Load Diffusion Model** with the Qwen-Image file (fp8 versions are about 20 GB); **Load CLIP** with `qwen_2.5_vl_7b` (type `qwen_image`); **Load VAE** with `qwen_image_vae`; EmptySD3LatentImage; ModelSamplingAuraFlow sets the shift in the templates. Editing graphs use TextEncodeQwenImageEdit (or the "Plus" version) with the input picture.

## Settings that work
About 1.6 megapixels (1328×1328, 1664×928); 20 to 50 steps, cfg about 2.5 to 4 (with Lightning LoRAs: 4 or 8 steps, cfg 1); `euler` with `simple`. Prompt: sentences; put text to render in quotes.

## What fits
Only Qwen-Image LoRAs and ControlNets; edit models have their own LoRAs. Its VAE and encoder fit nothing else.

## How the app helps
Shown as **Qwen-Image** on model cards. The lesson [Qwen-Image: words inside the picture](../lessons/Qwen-Image.md) builds the picture graph; [Editing a picture by words](../lessons/Edit-By-Words.md) builds an editing graph.

## See also
- [Reference images](Reference-Images.md)
- [Image to image](Image-To-Image.md)
- [Text encoders](Text-Encoders.md)
- [Model families](Model-Families.md)
