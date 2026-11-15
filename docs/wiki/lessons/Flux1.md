[Русский](Flux1.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Flux.1: a picture from separate files

<!-- lesson: flux -->
Lesson "flux", in the group **Pictures: models** of the lesson list. Steps: 14.

## What you will be able to do
You build a Flux graph of ten nodes, where the model, the two text encoders and the VAE come from loaders of their own.

## What you need
- It goes on from [Which loader for which file](Which-Loader.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a Flux.1 model (dev, schnell or Krea): `models/diffusion_models`, for example `flux1-dev-fp8.safetensors`;
  - clip_l: `models/text_encoders`, for example `clip_l.safetensors`;
  - t5xxl: `models/text_encoders`, for example `t5xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Flux VAE, ae.safetensors: `models/vae`, for example `ae.safetensors`.
- Nodes: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ConditioningZeroOut, EmptySD3LatentImage, KSampler, FluxGuidance, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **One file or several** (reading)

   SD 1.5 and SDXL come as one checkpoint file: the model that draws, the text encoder and the VAE in one. Newer families come as separate files, and each file has a loader node of its own.

   The Flux family by Black Forest Labs has three models with one graph: dev (the main one), schnell (fast, distilled to a few steps) and Krea dev (dev trained further for a more natural look). Only the model file and the number of steps change.

   This graph is the one of ComfyUI's own template "Flux.1 Dev: Text to Image".

2. **Which files your family needs** (reading)

   Put the files into these folders of ComfyUI:
   - the model: `flux1-dev.safetensors`, `flux1-schnell.safetensors` or `flux1-krea-dev_fp8_scaled.safetensors` in models/diffusion_models;
   - two text encoders: `clip_l.safetensors` and `t5xxl_fp16.safetensors` (or the smaller `t5xxl_fp8_e4m3fn_scaled.safetensors`) in models/text_encoders;
   - the VAE: `ae.safetensors` in models/vae.

   The text encoders and the VAE serve dev, schnell and Krea alike. The full dev model is about 24 GB: with a small video card take an fp8 file, or a GGUF file (the lesson "A quantised model: GGUF").

   There is also `flux1-dev-fp8.safetensors` in models/checkpoints, one file with all three parts: it goes into Load Checkpoint, like SDXL. This lesson is about the separate files.

   If a file is not in the list, your ComfyUI does not have it. The app downloads nothing. Open the template "Flux.1 Dev: Text to Image" in ComfyUI itself: it shows which files are missing and where to put them. Take files only from the model's official page. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the model**

   Add a **Load Diffusion Model** node and choose the Flux model in its `unet_name` field.

   This loader takes only the part that draws, from models/diffusion_models. It has one output, `MODEL`. Leave `weight_dtype` at `default`; `fp8_e4m3fn` halves the memory of a full file at a small cost in quality.

4. **Load the two text encoders**

   Add a **DualCLIPLoader** node. In `clip_name1` choose `clip_l.safetensors`, in `clip_name2` the t5xxl file, and set `type` to `flux`.

   Flux reads the prompt with two encoders at once: CLIP-L gives the general idea, T5-XXL reads long sentences. The `type` field tells ComfyUI how to join them. With another type the prompt is read wrongly and the picture ignores it.

5. **Load the VAE**

   Add a **Load VAE** node and choose `ae.safetensors` in `vae_name`.

   This is the VAE of Flux. The VAE of SD 1.5 or SDXL gives noise or an error here: Flux works with another compressed form of the picture.

6. **Write the prompt in sentences**

   Add a **CLIP Text Encode (Prompt)** node and connect the output of **DualCLIPLoader** to its `clip` input. In its `text` field describe the picture in whole sentences. For example: a red bicycle leans against a white wall in the morning sun, long soft shadows.

   T5 understands ordinary language. Say what is in the picture, where, in what light and in what style. Tags and weights in brackets matter much less here than in SD 1.5.

7. **Feed the negative input**

   Add a **ConditioningZeroOut** node and connect the output of **CLIP Text Encode (Prompt)** to its `conditioning` input.

   Flux dev was trained without a negative prompt: at cfg 1 the sampler does not read the negative input at all. But the input must be fed, and this node gives an empty conditioning of the right shape, as ComfyUI's template does. Say what you do not want inside the prompt instead: "a clean wall without posters".

8. **Add the empty latent of Flux**

   Add a **EmptySD3LatentImage** node. Set `width` and `height` to 1024.

   This empty latent has 16 channels, the form Flux works in, and it is the node ComfyUI's template uses. The usual Empty Latent Image makes the 4 channels of SD 1.5 and SDXL; a recent ComfyUI quietly fits an empty latent to the model, so it works too, but keep to the template's node. Flux draws well from about 0.5 to 2 megapixels: 1024 by 1024, 832 by 1216, 1216 by 832. Both sides must divide by 16.

9. **Add the sampler**

   Add a **KSampler** node and connect:
   - to `model`, the output of **Load Diffusion Model**;
   - to `positive`, the output of **CLIP Text Encode (Prompt)**;
   - to `negative`, the output of **ConditioningZeroOut**;
   - to `latent_image`, the output of **EmptySD3LatentImage**.

10. **Set the sampler for Flux**

   In **KSampler** set:
   - `steps`: 20 (4 for schnell);
   - `cfg`: 1;
   - `sampler_name`: `euler`;
   - `scheduler`: `simple`.

   Flux dev and schnell are distilled: how closely the picture follows the prompt is built into the model. With a cfg above 1 ComfyUI also works out the negative: every step takes twice as long and the colours usually burn. Schnell is made for 1 to 4 steps; dev and Krea need about 20.

11. **Set the guidance of Flux**

   Add a **FluxGuidance** node between the prompt and the sampler: the output of **CLIP Text Encode (Prompt)** goes into its `conditioning` input, and its output into the `positive` input of **KSampler**. Set `guidance` to 3.5.

   This is how Flux dev is told how closely to follow the prompt, instead of cfg. ComfyUI already uses 3.5 when the node is missing, so the node is for another number: 2 to 3 for a softer, more natural picture, 4 to 5 for a stricter one. Schnell does not read it. Other Flux models have their own numbers: Kontext 2.5, Fill and Canny 30.

12. **Turn the result into a picture**

   Add a **VAE Decode** node. Connect the output of **KSampler** to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the picture in its compressed form, the latent. The VAE of the same family unfolds it into pixels.

13. **Save the picture**

   Add a **Save Image** node and connect the output of **VAE Decode** to its `images` input.

   Without it ComfyUI works the picture out and puts it nowhere.

14. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the result is bad:
   - grey noise or an error: the VAE or the empty latent is not the one of Flux;
   - the picture ignores the prompt: check `type` `flux` and both encoder files;
   - burnt colours: `cfg` above 1 or `guidance` too high;
   - not enough video memory: fp8 files, `weight_dtype` `fp8_e4m3fn`, or a GGUF model.

   Only LoRAs made for Flux.1 work here. They go between **Load Diffusion Model** and **KSampler** in a Load LoRA node, usually the one for the model only.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 3, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a Flux.1 model (dev, schnell or Krea); such a file lies in `models/diffusion_models`, for example `flux1-dev-fp8.safetensors`.
- Step 4, **Load the two text encoders**:
  - a **DualCLIPLoader** node.
  - `clip_name1` of **DualCLIPLoader** holds clip_l; such a file lies in `models/text_encoders`, for example `clip_l.safetensors`.
  - `clip_name2` of **DualCLIPLoader** is not the same file as `clip_name1` of **DualCLIPLoader**.
  - `clip_name2` of **DualCLIPLoader** holds t5xxl; such a file lies in `models/text_encoders`, for example `t5xxl_fp8_e4m3fn_scaled.safetensors`.
  - `type` of **DualCLIPLoader** is `flux`. Why: a text encoder of the wrong type reads the prompt wrongly, and the model gets nonsense.
- Step 5, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds the Flux VAE, ae.safetensors; such a file lies in `models/vae`, for example `ae.safetensors`.
- Step 6, **Write the prompt in sentences**:
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **DualCLIPLoader** into `clip` of **CLIP Text Encode (Prompt)**.
  - `text` of **CLIP Text Encode (Prompt)** holds at least 20 characters.
- Step 7, **Feed the negative input**:
  - a **ConditioningZeroOut** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **ConditioningZeroOut**.
- Step 8, **Add the empty latent of Flux**:
  - a **EmptySD3LatentImage** node.
  - `width` of **EmptySD3LatentImage** is from 512 to 2048; **Do this for me** sets 1024. Why: flux was trained near one megapixel: 1024 by 1024 or the same number of pixels in other proportions.
  - `height` of **EmptySD3LatentImage** is from 512 to 2048; **Do this for me** sets 1024. Why: flux was trained near one megapixel: 1024 by 1024 or the same number of pixels in other proportions.
- Step 9, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **KSampler** (a LoraLoaderModelOnly or ModelSamplingAuraFlow or ModelSamplingFlux or ModelSamplingSD3 in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **KSampler** (a FluxGuidance in between is accepted).
  - `CONDITIONING` of **ConditioningZeroOut** into `negative` of **KSampler**.
  - `LATENT` of **EmptySD3LatentImage** into `latent_image` of **KSampler**.
- Step 10, **Set the sampler for Flux**:
  - `steps` of **KSampler** is from 4 to 30; **Do this for me** sets 20. Why: the Flux templates use 20 steps; fewer leave the picture unfinished.
  - `cfg` of **KSampler** is `1`. Why: flux dev learned its own guidance number instead of cfg: cfg above 1 doubles the time and burns the colors.
  - `sampler_name` of **KSampler** is `euler`.
  - `scheduler` of **KSampler** is `simple`.
- Step 11, **Set the guidance of Flux**:
  - a **FluxGuidance** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **FluxGuidance**.
  - `CONDITIONING` of **FluxGuidance** into `positive` of **KSampler**.
  - `guidance` of **FluxGuidance** is from 1.5 to 5; **Do this for me** sets 3.5. Why: this is the number Flux dev learned instead of cfg; 3.5 is ComfyUI's own default for it.
- Step 12, **Turn the result into a picture**:
  - a **VAE Decode** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
- Step 13, **Save the picture**:
  - a **Save Image** or **Preview Image** node.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## What next
These lessons go on from this one: [Flux.2 Klein: a sampler built from parts](Flux2-Klein.md), [A quantised model: GGUF](GGUF.md), [A reference picture for style (Flux Redux)](Style-Reference.md).

## See also
- [Flux.1](../concepts/Family-Flux1.md)
- [Separate loaders: diffusion model, text encoder, VAE](../concepts/Separate-Loaders.md)
- [Text encoders: CLIP, T5 and others](../concepts/Text-Encoders.md)
- [CFG and guidance](../concepts/CFG.md)
- [How lessons work](How-Lessons-Work.md)
