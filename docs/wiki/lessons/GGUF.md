[Русский](GGUF.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A quantised model: GGUF

<!-- lesson: gguf -->
Lesson "gguf", in the group **Pictures: models** of the lesson list. Steps: 7.

## What you will be able to do
You put a GGUF model into a graph of separate files, so a large model fits a smaller video card.

## What you need
- It goes on from [Flux.1: a picture from separate files](Flux1.md), [Z-Image Turbo: a picture in eight steps](Z-Image-Turbo.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI-GGUF**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Model files the lesson checks:
  - a .gguf file of the family of this graph (Flux.1 or Z-Image): `models/diffusion_models`, for example `flux1-dev-Q4_K_S.gguf`.
- Nodes: CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Unet Loader (GGUF) / UnetLoaderGGUFAdvanced.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **First, the rules** (reading)

   GGUF files load through the ComfyUI-GGUF node pack. A node pack runs other people's code on your computer: install it yourself through ComfyUI's manager, restart ComfyUI and choose "Sync ▸ Sync now" here. Take model files only from the official page of the model or of the person who quantised it.

   A quantised model is the same model with its numbers stored in fewer bits. The file and the video memory it needs get smaller, the quality a little lower. The pack's author says this works well for transformer models such as Flux, Z-Image, Qwen-Image and SD 3.5, and badly for the older SD 1.5 and SDXL.

2. **A graph of separate files is needed**

   This lesson goes on from the graph of the lesson "Flux.1: a picture from separate files" or "Z-Image Turbo: a picture in eight steps". The canvas must have **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** and **Save Image** with their links.

   If they are not there, do one of those lessons first.

3. **How to read the name of a GGUF file** (reading)

   The letters after Q tell how the model was squeezed. The number is about the bits per weight:
   - Q8_0: nearly the same as the original, about half of a 16-bit file;
   - Q6_K and Q5_K_M: a good balance;
   - Q4_K_S and Q4_0: about a quarter of the size, the detail gets simpler;
   - Q3 and Q2: only when nothing else fits.

   Choose the largest one that fits into your video card together with the text encoder.

4. **Put the GGUF loader in**

   Add a **Unet Loader (GGUF)** node and choose your .gguf file in `unet_name`. The pack looks for these files in models/unet and models/diffusion_models and lists only files ending in .gguf.

   Connect its `MODEL` output to where the output of the old loader went: to the `model` input of **KSampler**, or, in the Z-Image graph, to the `model` input of the shift node in front of the sampler.

5. **The old loader** (reading)

   The usual model loader is no longer needed: delete it. A node whose output leads nowhere is not run by ComfyUI anyway.

   The text encoders, the VAE and every setting stay as they were. The GGUF file must be of the same family as the rest of the graph: a GGUF of Flux needs the encoders and the VAE of Flux.

6. **The text encoder in GGUF** (reading)

   Large text encoders such as T5-XXL also come as .gguf files. The pack has loaders for them that stand in for the usual ones: CLIPLoader (GGUF) and DualCLIPLoader (GGUF), with the same `type`. They read both .gguf and .safetensors files.

   LoRAs go through the usual LoRA loaders; the pack's author calls this experimental.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If it does not work:
   - the GGUF node is missing in ComfyUI: the pack is not installed, or ComfyUI was not restarted;
   - the file is not in the list: it is not in models/unet or models/diffusion_models, or it does not end in .gguf;
   - an error about the model type: the file is of another family than the graph.

   GGUF runs a little slower than an unpacked file of the same size: the numbers are unpacked at every step.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A graph of separate files is needed**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **KSampler** (a FluxGuidance in between is accepted).
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 4, **Put the GGUF loader in**:
  - a **Unet Loader (GGUF)** or **UnetLoaderGGUFAdvanced** node.
  - `MODEL` of **Unet Loader (GGUF)** or **UnetLoaderGGUFAdvanced** into `model` of **KSampler** (a LoraLoaderModelOnly or ModelSamplingAuraFlow or ModelSamplingFlux or ModelSamplingSD3 in between is accepted).
  - `unet_name` of **Unet Loader (GGUF)** or **UnetLoaderGGUFAdvanced** holds a .gguf file of the family of this graph (Flux.1 or Z-Image); such a file lies in `models/diffusion_models`, for example `flux1-dev-Q4_K_S.gguf`.

## See also
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
- [Separate loaders: diffusion model, text encoder, VAE](../concepts/Separate-Loaders.md)
- [Node packs](../concepts/Node-Packs.md)
- [How lessons work](How-Lessons-Work.md)
