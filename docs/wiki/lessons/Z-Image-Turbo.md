[Русский](Z-Image-Turbo.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Z-Image Turbo: a picture in eight steps

<!-- lesson: zimage-turbo -->
Lesson "zimage-turbo", in the group **Pictures: models** of the lesson list. Steps: 14.

## What you will be able to do
You build a graph for a distilled model that draws in 8 steps with cfg 1, and learn why its negative prompt does nothing.

## What you need
- It goes on from [Which loader for which file](Which-Loader.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a Z-Image model: `models/diffusion_models`, for example `z_image_turbo_bf16.safetensors`;
  - qwen_3_4b: `models/text_encoders`, for example `qwen_3_4b.safetensors`;
  - the Flux VAE, ae.safetensors: `models/vae`, for example `ae.safetensors`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, ModelSamplingAuraFlow, CLIP Text Encode (Prompt), ConditioningZeroOut, EmptySD3LatentImage, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What a distilled model is** (reading)

   Turbo, Lightning, schnell, distilled: these words mean a model taught to draw in a few steps. It is fast, and it pays for that: cfg must be 1, so the negative prompt is not read, and more steps rarely help.

   Z-Image Turbo by Alibaba Tongyi is such a model. It draws photos well, understands English and Chinese and can write short words in a picture.

   The graph is the one of ComfyUI's template "Z-Image-Turbo: Text to Image".

2. **Which files your family needs** (reading)

   - the model: `z_image_turbo_bf16.safetensors` in models/diffusion_models;
   - the text encoder: `qwen_3_4b.safetensors` in models/text_encoders. This is a small language model: it reads the prompt the way it reads any text;
   - the VAE: `ae.safetensors` in models/vae, the same file as for Flux.

   The base model Z-Image (without Turbo) takes the same encoder and VAE, with its own model file `z_image_bf16.safetensors`.

   If a file is not in the list, your ComfyUI does not have it. The app downloads nothing. Open the template "Z-Image-Turbo: Text to Image" in ComfyUI itself: it shows which files are missing and where to put them. Take files only from the model's official page. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the model**

   Add a **Load Diffusion Model** node and choose the Z-Image Turbo file in `unet_name`.

   The loader takes the part that draws from models/diffusion_models. Its text encoder and VAE come from loaders of their own.

4. **Load the text encoder**

   Add a **Load CLIP** node. Choose the Qwen file in `clip_name` and set `type` to `lumina2`.

   Z-Image reads the prompt the way the Lumina family does, so ComfyUI names the type after it. With another type the file is read wrongly, and the picture has nothing to do with the prompt.

5. **Load the VAE**

   Add a **Load VAE** node and choose `ae.safetensors` in `vae_name`.

   Z-Image works with the same compressed form of the picture as Flux, so it takes the same VAE.

6. **Set the shift**

   Add a **ModelSamplingAuraFlow** node and connect the `MODEL` output of **Load Diffusion Model** to its `model` input. Set `shift` to 3.

   Models of this kind remove noise along a straight path, and the shift says where on that path the steps are spent. A higher shift spends more of them on the large shapes, a lower one on fine detail. The number comes from ComfyUI's template; try 2 to 6 if the composition falls apart or the detail is mushy.

7. **Write the prompt**

   Add a **CLIP Text Encode (Prompt)** node and connect the output of **Load CLIP** to its `clip` input. Describe the picture in its `text` field in sentences. Words to be written in the picture go in quotes: a ceramic mug on a wooden table with the word "MORNING" printed on it, soft window light.

   A language model reads a long, exact prompt better than a list of tags.

8. **Feed the negative input**

   Add a **ConditioningZeroOut** node and connect the output of **CLIP Text Encode (Prompt)** to its `conditioning` input.

   At cfg 1 the sampler does not read the negative input, so ComfyUI's template gives it an empty conditioning. A negative prompt here does nothing: say what you do not want inside the prompt itself.

9. **Add the empty latent**

   Add a **EmptySD3LatentImage** node and set `width` and `height` to 1024.

   This is the same empty latent as for Flux, with 16 channels. Z-Image draws well up to about 2 megapixels; both sides must divide by 16.

10. **Add the sampler**

   Add a **KSampler** node and connect:
   - to `model`, the output of **ModelSamplingAuraFlow**, not that of the loader;
   - to `positive`, the output of **CLIP Text Encode (Prompt)**;
   - to `negative`, the output of **ConditioningZeroOut**;
   - to `latent_image`, the output of **EmptySD3LatentImage**.

11. **Few steps, cfg 1**

   In **KSampler** set:
   - `steps`: 8;
   - `cfg`: 1;
   - `sampler_name`: `res_multistep`;
   - `scheduler`: `simple`.

   The model was taught to finish in about eight steps. With fewer the picture stays rough, with many more it does not get better. A cfg above 1 burns the colours and doubles the time.

12. **Turn the result into a picture**

   Add a **VAE Decode** node. Connect the output of **KSampler** to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the picture in its compressed form, the latent. The VAE of the same family unfolds it into pixels.

13. **Save the picture**

   Add a **Save Image** node and connect the output of **VAE Decode** to its `images` input.

   Without it ComfyUI works the picture out and puts it nowhere.

14. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the result is bad:
   - grey noise or an error: the VAE is not `ae.safetensors`;
   - the picture ignores the prompt: `type` is not `lumina2`;
   - plastic skin or burnt colours: `cfg` above 1.

   The base Z-Image (without Turbo) uses the same graph with other numbers: 25 steps, `cfg` 4, and a real negative prompt in a second text node instead of **ConditioningZeroOut**. Only LoRAs made for Z-Image work with it.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 3, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a Z-Image model; such a file lies in `models/diffusion_models`, for example `z_image_turbo_bf16.safetensors`.
- Step 4, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds qwen_3_4b; such a file lies in `models/text_encoders`, for example `qwen_3_4b.safetensors`.
  - `type` of **Load CLIP** is `lumina2`. Why: a text encoder of the wrong type reads the prompt wrongly, and the model gets nonsense.
- Step 5, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds the Flux VAE, ae.safetensors; such a file lies in `models/vae`, for example `ae.safetensors`.
- Step 6, **Set the shift**:
  - a **ModelSamplingAuraFlow** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **ModelSamplingAuraFlow** (a LoraLoaderModelOnly in between is accepted).
  - `shift` of **ModelSamplingAuraFlow** is from 1 to 10; **Do this for me** sets 3. Why: the shift decides where the steps are spent; the Z-Image template uses 3.
- Step 7, **Write the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)**.
  - `text` of **CLIP Text Encode (Prompt)** holds at least 20 characters.
- Step 8, **Feed the negative input**:
  - a **ConditioningZeroOut** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **ConditioningZeroOut**.
- Step 9, **Add the empty latent**:
  - a **EmptySD3LatentImage** node.
  - `width` of **EmptySD3LatentImage** is from 512 to 2048; **Do this for me** sets 1024. Why: z-Image was trained near one megapixel.
  - `height` of **EmptySD3LatentImage** is from 512 to 2048; **Do this for me** sets 1024. Why: z-Image was trained near one megapixel.
- Step 10, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingAuraFlow** into `model` of **KSampler** (a LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **KSampler**.
  - `CONDITIONING` of **ConditioningZeroOut** into `negative` of **KSampler**.
  - `LATENT` of **EmptySD3LatentImage** into `latent_image` of **KSampler**.
- Step 11, **Few steps, cfg 1**:
  - `steps` of **KSampler** is from 4 to 12; **Do this for me** sets 8. Why: a turbo model is taught to finish in about 8 steps.
  - `cfg` of **KSampler** is `1`. Why: at cfg 1 the negative prompt is not read; a higher cfg burns the colors of a turbo model.
  - `sampler_name` of **KSampler** is `res_multistep`.
  - `scheduler` of **KSampler** is `simple`.
- Step 12, **Turn the result into a picture**:
  - a **VAE Decode** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
- Step 13, **Save the picture**:
  - a **Save Image** or **Preview Image** node.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## What next
These lessons go on from this one: [Qwen-Image: words inside the picture](Qwen-Image.md), [A quantised model: GGUF](GGUF.md).

## See also
- [Z-Image](../concepts/Family-Z-Image.md)
- [Separate loaders: diffusion model, text encoder, VAE](../concepts/Separate-Loaders.md)
- [How lessons work](How-Lessons-Work.md)
