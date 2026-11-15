[Русский](Which-Loader.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Which loader for which file

<!-- lesson: loaders -->
Lesson "loaders", in the group **Pictures: models** of the lesson list. Steps: 8.

## What you will be able to do
You find the right loader for four kinds of model files and learn where ComfyUI looks for each.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model: `models/checkpoints`, for example `juggernautXL_v9.safetensors`;
  - a full VAE, not a small preview decoder (taesd, vae_approx): `models/vae`, for example `sdxl_vae.safetensors`.
- Nodes: Load Checkpoint, Load Diffusion Model, Load CLIP, Load VAE.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Every loader has its folder** (reading)

   A model file comes in one of a few kinds, and each kind has its loader node and its folder in ComfyUI. A loader lists only the files of its own folder. So when a file is not in the list, it lies in another folder or is another kind of file.

   In this lesson you put four loaders on the canvas and choose a file in each. They do not need to be linked: the aim is to know which node takes which file.

2. **A checkpoint: Load Checkpoint**

   Add a **Load Checkpoint** node and choose a file in `ckpt_name`.

   A checkpoint holds three parts in one file, so the node has three outputs: the model, the text encoder and the VAE. ComfyUI looks for it in models/checkpoints. SD 1.5, SDXL, Pony, Illustrious and SD 3.5 usually come this way.

3. **A diffusion model alone: Load Diffusion Model**

   Add a **Load Diffusion Model** node and choose a file in `unet_name`.

   This is only the part that draws, without the text encoder and the VAE. ComfyUI looks for it in models/diffusion_models (and in the old folder models/unet). Flux, Flux.2, Z-Image, Qwen-Image, HiDream and the video models come this way. The `weight_dtype` field can squeeze a full file into fp8 to save memory.

4. **A text encoder: Load CLIP**

   Add a **Load CLIP** node, choose a file in `clip_name` and the family in `type`.

   The text encoder turns the prompt into numbers for the model. ComfyUI looks for it in models/text_encoders (and in the old models/clip). The type must match the family: `lumina2` for Z-Image, `qwen_image` for Qwen-Image, `flux2` for Flux.2, `sd3` for a single T5 of SD 3.5. Families with two encoders take the node for two files (Flux.1: `flux`), SD 3.5 the one for three, HiDream the one for four.

5. **A VAE: Load VAE**

   Add a **Load VAE** node and choose a file in `vae_name`.

   The VAE turns the latent into pixels and back. ComfyUI looks for it in models/vae. Each family has its own: `ae.safetensors` for Flux.1 and Z-Image, `flux2-vae.safetensors` for Flux.2, `qwen_image_vae.safetensors` for Qwen-Image.

   The list may also show small preview files (taesd, taesdxl, taef1 and others) from models/vae_approx. They are quick and rough: ComfyUI uses them to show the picture while it is being drawn. For the final picture take the full VAE.

6. **How to tell what a file is** (reading)

   Ways to tell, from the surest:
   - the official template of the model names each file and its folder;
   - the model's page says "checkpoint", "diffusion model", "text encoder" or "VAE";
   - the size: a VAE is up to a few hundred MB, an SD 1.5 checkpoint 2 to 4 GB, an SDXL one about 6.5 GB, a large diffusion model alone 10 to 40 GB;
   - the card of the file in the "Models" tab of this app names its family.

   A checkpoint in Load Diffusion Model or a diffusion model in Load Checkpoint ends in an error. A .gguf file needs the loaders of the GGUF pack. The old formats .ckpt, .pt, .pth and .bin can run code when loaded: prefer .safetensors.

7. **Other files of picture graphs** (reading)

   Other kinds you will meet, with their folder:
   - LoRA: models/loras, the Load LoRA node;
   - ControlNet: models/controlnet;
   - upscale models: models/upscale_models;
   - CLIP Vision, for a picture as a hint: models/clip_vision;
   - embeddings: models/embeddings; they have no node and are called in the prompt as embedding:name.

8. **What next** (reading)

   Now you know which node takes which file. The lessons "Flux.1: a picture from separate files" and "Z-Image Turbo: a picture in eight steps" build whole graphs from such loaders.

   These four loaders can stay on the canvas or be deleted: a loader whose output leads nowhere is not run by ComfyUI.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A checkpoint: Load Checkpoint**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint** holds a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model; such a file lies in `models/checkpoints`, for example `juggernautXL_v9.safetensors`.
- Step 3, **A diffusion model alone: Load Diffusion Model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model**: a value is chosen.
- Step 4, **A text encoder: Load CLIP**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP**: a value is chosen.
  - `type` of **Load CLIP**: a value is chosen.
- Step 5, **A VAE: Load VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds a full VAE, not a small preview decoder (taesd, vae_approx); such a file lies in `models/vae`, for example `sdxl_vae.safetensors`.

## What next
These lessons go on from this one: [Flux.1: a picture from separate files](Flux1.md), [Z-Image Turbo: a picture in eight steps](Z-Image-Turbo.md).

## See also
- [Separate loaders: diffusion model, text encoder, VAE](../concepts/Separate-Loaders.md)
- [Checkpoint](../concepts/Checkpoint.md)
- [Text encoders: CLIP, T5 and others](../concepts/Text-Encoders.md)
- [VAE](../concepts/VAE.md)
- [Where ComfyUI files live](../concepts/Where-Files-Live.md)
- [How lessons work](How-Lessons-Work.md)
