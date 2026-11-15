[Русский](Separate-Loaders.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Separate loaders: diffusion model, text encoder, VAE

Why newer models come as three or four files, and which node loads each.

## In plain words
A [checkpoint](Checkpoint.md) packs the drawing model, the text encoder and the VAE into one file. Newer families do not: their parts are large and shared between versions, so authors publish them apart. One text encoder file can serve several model versions; one VAE serves a whole family. You then load each part with its own node and join them in the graph.

## Where you meet it in a graph

| Part | Node (title on screen) | Class | Folder | Output |
|---|---|---|---|---|
| Diffusion model | Load Diffusion Model | `UNETLoader` | `models/diffusion_models` (older: `models/unet`) | `MODEL` |
| One text encoder | Load CLIP | `CLIPLoader` | `models/text_encoders` (older: `models/clip`) | `CLIP` |
| Two text encoders | DualCLIPLoader | `DualCLIPLoader` | `models/text_encoders` | `CLIP` |
| VAE | Load VAE | `VAELoader` | `models/vae` | `VAE` |

Load CLIP and DualCLIPLoader have a `type` field that must name the family: for example `wan`, `qwen_image`, `flux`, `hunyuan_video`, `sd3`. Load Diffusion Model has `weight_dtype`: `default` keeps the file's own precision; the `fp8` choices store the weights in 8 bits to save memory, at a small cost in quality.

Typical sets:
- **Flux.1**: Load Diffusion Model (`flux1-dev`), DualCLIPLoader with `clip_l` and `t5xxl` (type `flux`), Load VAE with `ae.safetensors`.
- **Wan 2.1 / 2.2 14B**: Load Diffusion Model (two for Wan 2.2), Load CLIP with `umt5_xxl` (type `wan`), Load VAE with `wan_2.1_vae`.
- **Qwen-Image**: Load Diffusion Model, Load CLIP with Qwen2.5-VL (type `qwen_image`), Load VAE with `qwen_image_vae`.
- **Z-Image Turbo**: Load Diffusion Model, Load CLIP with `qwen_3_4b`, Load VAE with `ae.safetensors`.

Some packs ship loaders of their own (for example GGUF loaders, or the WanVideoWrapper loaders); their outputs may have other types.

## Typical mistakes
- **The wrong `type`** on Load CLIP: the model gets meaningless numbers and draws noise or something unrelated.
- **A text encoder or VAE of another family**: errors about shapes ("size mismatch"), or broken colours.
- **The diffusion model in `checkpoints`**: Load Diffusion Model will not list it. Move it to `diffusion_models`.
- **Forgetting one part**: the model alone does nothing; all three must be from the same family.

## How the app helps
- Node descriptions say which folder each loader reads and which `type` values exist.
- The lesson [Which loader for which file](../lessons/Which-Loader.md) sorts the loaders; the video and picture-model lessons check `type` and the kind of each file.
- **Check** lists model files that are not on disk and models of different families in one path.
- In **Properties**, a field with a built-in note has a button **What this field does** next to its name; it opens the note under the field: what the field does and what to put in it.

## See also
- [Checkpoint](Checkpoint.md)
- [Text encoders](Text-Encoders.md)
- [VAE](VAE.md)
- [Model families](Model-Families.md)
- [Graphics card memory](Graphics-Card-Memory.md)
- [Where ComfyUI files live](Where-Files-Live.md)
