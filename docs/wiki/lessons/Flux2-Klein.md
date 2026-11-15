[Русский](Flux2-Klein.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Flux.2 Klein: a sampler built from parts

<!-- lesson: flux2-klein -->
Lesson "flux2-klein", in the group **Pictures: models** of the lesson list. Steps: 15.

## What you will be able to do
You build the graph of a small Flux.2 model, where the sampler is put together from five nodes.

## What you need
- It goes on from [Flux.1: a picture from separate files](Flux1.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a Flux.2 Klein model: `models/diffusion_models`, for example `flux-2-klein-base-4b-fp8.safetensors`;
  - qwen_3_4b, or qwen_3_8b for the 9B model: `models/text_encoders`, for example `qwen_3_8b_fp8mixed.safetensors`;
  - flux2-vae: `models/vae`, for example `flux2-vae.safetensors`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), CFG Guider, Empty Flux 2 Latent, Flux2Scheduler, KSamplerSelect, RandomNoise, SamplerCustomAdvanced, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Flux.2 and its small models** (reading)

   Flux.2 by Black Forest Labs comes as one large model, dev, and small ones, Klein, in two sizes: 4B and 9B. Each Klein comes as a base model and as a distilled one.

   Flux.2 is not Flux.1 made bigger. Its text encoder is a language model, its VAE and empty latent are its own, and no file of Flux.1 fits it.

   The official templates build its sampler from parts: KSampler takes everything in one node, while here the noise, the guide, the sampling method and the schedule are separate nodes. This is the graph of the template "FLUX.2 [Klein] 4B: Text to Image".

2. **Which files your family needs** (reading)

   For Klein 4B:
   - the model: `flux-2-klein-base-4b.safetensors` (base) or `flux-2-klein-4b.safetensors` (distilled) in models/diffusion_models;
   - the text encoder: `qwen_3_4b.safetensors` in models/text_encoders, the same file as for Z-Image;
   - the VAE: `flux2-vae.safetensors` in models/vae.

   Klein 9B takes `flux-2-klein-base-9b-fp8.safetensors` and the larger encoder `qwen_3_8b_fp8mixed.safetensors`. Flux.2 dev takes a Mistral encoder and is many times larger.

   If a file is not in the list, your ComfyUI does not have it. The app downloads nothing. Open the template "FLUX.2 [Klein] 4B: Text to Image" in ComfyUI itself: it shows which files are missing and where to put them. Take files only from the model's official page. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the model**

   Add a **Load Diffusion Model** node and choose the Klein file in `unet_name`.

   This lesson sets the numbers of the base model. For the distilled one, the step "Base and distilled" says what changes.

4. **Load the text encoder**

   Add a **Load CLIP** node. Choose the Qwen file in `clip_name` and set `type` to `flux2`.

   The same file serves Z-Image with another type: the type tells ComfyUI which model the encoder feeds.

5. **Load the VAE**

   Add a **Load VAE** node and choose `flux2-vae.safetensors` in `vae_name`.

   The VAE of Flux.1 does not fit Flux.2: the compressed form of the picture is another one.

6. **Write the prompt and the negative**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the output of **Load CLIP** to the `clip` input of each. In the `text` field of the first, describe the picture in sentences: a hedgehog in a tiny party hat among confetti, flash photo of an old digital camera.

   The base model reads the negative, so the second node may hold what is not wanted, or stay empty.

7. **The guide: how closely to follow the prompt**

   Add a **CFG Guider** node and connect:
   - to `model`, the output of **Load Diffusion Model**;
   - to `positive` and `negative`, the two text nodes.

   Set `cfg` to 5. This node is the part of KSampler that weighs the prompt against the negative.

8. **Add the empty latent of Flux.2**

   Add a **Empty Flux 2 Latent** node and set `width` and `height` to 1024.

   Its latent has 128 channels at a sixteenth of the size, and this is the node of ComfyUI's template. Both sides must divide by 16.

9. **The schedule of the noise**

   Add a **Flux2Scheduler** node. Set `steps` to 20, and `width` and `height` the same as in **Empty Flux 2 Latent**.

   This node works out how much noise is left before each step. For Flux.2 it depends on the size of the picture, so the size here must be that of the empty latent.

10. **The sampling method and the noise**

   Add a **KSamplerSelect** node and choose `euler` in `sampler_name`. Add a **RandomNoise** node: its `noise_seed` field is the seed, the number the starting noise is made from.

   In KSampler these are two fields; here they are two nodes.

11. **Put the sampler together**

   Add a **SamplerCustomAdvanced** node and connect its five inputs:
   - `noise`: the output of **RandomNoise**;
   - `guider`: the output of **CFG Guider**;
   - `sampler`: the output of **KSamplerSelect**;
   - `sigmas`: the output of **Flux2Scheduler**;
   - `latent_image`: the output of **Empty Flux 2 Latent**.

   This node does the work. Its first output, `output`, is the finished latent.

12. **Turn the result into a picture**

   Add a **VAE Decode** node. Connect the `output` output of **SamplerCustomAdvanced** to its `samples` input and the output of **Load VAE** to its `vae` input.

13. **Save the picture**

   Add a **Save Image** node and connect the output of **VAE Decode** to its `images` input.

   Without it ComfyUI works the picture out and puts it nowhere.

14. **Base and distilled** (reading)

   The distilled Klein is made for speed. In the same template its numbers are: `steps` 4 in **Flux2Scheduler**, `cfg` 1 in **CFG Guider**, and an empty conditioning node instead of the negative prompt: at cfg 1 the negative is not read.

   Flux.2 dev is built the same way with two changes: a Basic Guider without a negative instead of **CFG Guider**, and a Flux Guidance node with 4 on the prompt.

15. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the result is bad:
   - grey noise or an error: the VAE is not the one of Flux.2;
   - a blurred or strange picture: the size in **Flux2Scheduler** differs from that of **Empty Flux 2 Latent**;
   - burnt colours on the distilled model: `cfg` is above 1.

   LoRAs of Flux.1 do not fit Flux.2, and those of Klein 4B do not fit Klein 9B.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 3, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a Flux.2 Klein model; such a file lies in `models/diffusion_models`, for example `flux-2-klein-base-4b-fp8.safetensors`.
- Step 4, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds qwen_3_4b, or qwen_3_8b for the 9B model; such a file lies in `models/text_encoders`, for example `qwen_3_8b_fp8mixed.safetensors`.
  - `type` of **Load CLIP** is `flux2`. Why: a text encoder of the wrong type reads the prompt wrongly, and the model gets nonsense.
- Step 5, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds flux2-vae; such a file lies in `models/vae`, for example `flux2-vae.safetensors`.
- Step 6, **Write the prompt and the negative**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 20 characters.
- Step 7, **The guide: how closely to follow the prompt**:
  - a **CFG Guider** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **CFG Guider** (a LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **CFG Guider**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **CFG Guider**.
  - `cfg` of **CFG Guider** is from 3 to 6; **Do this for me** sets 5. Why: the Klein base model is guided at 5, as its template does.
- Step 8, **Add the empty latent of Flux.2**:
  - a **Empty Flux 2 Latent** node.
  - `width` of **Empty Flux 2 Latent** is from 512 to 2048; **Do this for me** sets 1024. Why: flux was trained near one megapixel: 1024 by 1024 or the same number of pixels in other proportions.
  - `height` of **Empty Flux 2 Latent** is from 512 to 2048; **Do this for me** sets 1024. Why: flux was trained near one megapixel: 1024 by 1024 or the same number of pixels in other proportions.
- Step 9, **The schedule of the noise**:
  - a **Flux2Scheduler** node.
  - `steps` of **Flux2Scheduler** is from 10 to 50; **Do this for me** sets 20. Why: the schedule of the Klein template has 20 steps.
  - `width` of **Flux2Scheduler** equals `width` of **Empty Flux 2 Latent**. Why: the schedule depends on the picture size; it must equal the size of the latent.
  - `height` of **Flux2Scheduler** equals `height` of **Empty Flux 2 Latent**. Why: the schedule depends on the picture size; it must equal the size of the latent.
- Step 10, **The sampling method and the noise**:
  - a **KSamplerSelect** node.
  - a **RandomNoise** node.
  - `sampler_name` of **KSamplerSelect** is `euler`.
- Step 11, **Put the sampler together**:
  - a **SamplerCustomAdvanced** node.
  - `NOISE` of **RandomNoise** into `noise` of **SamplerCustomAdvanced**.
  - `GUIDER` of **CFG Guider** into `guider` of **SamplerCustomAdvanced**.
  - `SAMPLER` of **KSamplerSelect** into `sampler` of **SamplerCustomAdvanced**.
  - `SIGMAS` of **Flux2Scheduler** into `sigmas` of **SamplerCustomAdvanced**.
  - `LATENT` of **Empty Flux 2 Latent** into `latent_image` of **SamplerCustomAdvanced**.
- Step 12, **Turn the result into a picture**:
  - a **VAE Decode** node.
  - `output` of **SamplerCustomAdvanced** into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
- Step 13, **Save the picture**:
  - a **Save Image** or **Preview Image** node.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## See also
- [Flux.2](../concepts/Family-Flux2.md)
- [Sampler and sampler names](../concepts/Sampler.md)
- [Scheduler](../concepts/Scheduler.md)
- [How lessons work](How-Lessons-Work.md)
