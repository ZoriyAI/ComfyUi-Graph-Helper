[Русский](Style-Reference.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A reference picture for style (Flux Redux)

<!-- lesson: style-reference -->
Lesson "style-reference", in the group **Pictures: techniques** of the lesson list. Steps: 9.

## What you will be able to do
A Flux.1 picture takes its look from a sample picture: colours, materials, mood.

## What you need
- It goes on from [Flux.1: a picture from separate files](Flux1.md). The card says so; it is a hint, not a lock.
- Nodes: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ConditioningZeroOut, Load Image, Load CLIP Vision, CLIP Vision Encode, Load Style Model, Apply Style Model, EmptySD3LatentImage, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What Redux does** (reading)

   Words describe a style poorly. Redux lets you show it: a vision model looks at a sample picture, and a small style model turns what it saw into an addition to the prompt.

   The graph is ComfyUI's Flux.1 dev graph with the part of the official "Flux Redux" template that does this. It is built from an empty canvas: "File ▸ New project". Flux.1 dev needs a strong graphics card; its fp8 files need less memory.

2. **Load Flux.1**

   Add **Load Diffusion Model**, **DualCLIPLoader** and **Load VAE**.
   - `unet_name` of **Load Diffusion Model**: flux1-dev, from `models/diffusion_models`.
   - **DualCLIPLoader** reads the prompt with two files: `clip_name1` clip_l, `clip_name2` t5xxl. Set `type` to `flux`.
   - `vae_name` of **Load VAE**: ae.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the official template "Flux Redux": it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Write the prompt**

   Add **CLIP Text Encode (Prompt)** and **ConditioningZeroOut**. The output of **DualCLIPLoader** goes into `clip` of **CLIP Text Encode (Prompt)**, the output of **CLIP Text Encode (Prompt)** into `conditioning` of **ConditioningZeroOut**. Write in `text` what the picture shows: the subject, the place.

   Flux does not use a prompt of what is unwanted. **ConditioningZeroOut** gives the sampler an empty one, as ComfyUI's Flux template does.

4. **Show the sample**

   Add **Load Image**, **Load CLIP Vision** and **CLIP Vision Encode**.
   - In **Load Image** choose the sample picture.
   - In `clip_name` of **Load CLIP Vision**: sigclip_vision_patch14_384, from `models/clip_vision`.
   - **CLIP Vision Encode** gets `clip_vision` from **Load CLIP Vision** and `image` from **Load Image**.

   The vision model turns the picture into numbers that say what is in it and how it looks.

5. **Apply the style model**

   Add **Load Style Model** and **Apply Style Model**.
   - In `style_model_name` of **Load Style Model**: flux1-redux-dev, from `models/style_models`.
   - **Apply Style Model** gets `conditioning` from **CLIP Text Encode (Prompt)**, `style_model` from **Load Style Model**, `clip_vision_output` from **CLIP Vision Encode**.

   The output of **Apply Style Model** is your prompt with the sample added to it.

6. **The empty latent and the sampler**

   Add **EmptySD3LatentImage** and **KSampler**. Connect: `model` from **Load Diffusion Model**, `positive` from **Apply Style Model**, `negative` from **ConditioningZeroOut**, `latent_image` from **EmptySD3LatentImage**. Set `cfg` to 1.

   Flux.1 dev is distilled: it follows the prompt without the usual guidance, and a higher `cfg` burns the picture. An empty latent of 1024 × 1024 suits it.

7. **Decode and save**

   Add **VAE Decode** and **Save Image**: the output of **KSampler** into `samples`, the output of **Load VAE** into `vae`, the picture into `images`.

8. **When the sample wins over the words** (reading)

   At `strength` 1 of **Apply Style Model** Redux often copies the sample and forgets the prompt. Lower it to 0.5 and the words get their say again.

   Two samples: chain two **Apply Style Model** nodes, the output of the first into `conditioning` of the second, each with its own picture, as the template does.

   For SD 1.5 and SDXL the same idea is IP-Adapter, see "A reference picture with IP-Adapter".

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: one prompt with two very different samples.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load Flux.1**:
  - a **Load Diffusion Model** node.
  - a **DualCLIPLoader** node.
  - a **Load VAE** node.
  - `unet_name` of **Load Diffusion Model**: a value is chosen.
  - `clip_name1` of **DualCLIPLoader**: a value is chosen.
  - `clip_name2` of **DualCLIPLoader** is not the same file as `clip_name1` of **DualCLIPLoader**.
  - `type` of **DualCLIPLoader** is `flux`.
  - `vae_name` of **Load VAE**: a value is chosen.
- Step 3, **Write the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **ConditioningZeroOut** node.
  - `CLIP` of **DualCLIPLoader** into `clip` of **CLIP Text Encode (Prompt)**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **ConditioningZeroOut**.
  - `text` of **CLIP Text Encode (Prompt)** holds at least 3 characters.
- Step 4, **Show the sample**:
  - a **Load Image** node.
  - a **Load CLIP Vision** node.
  - a **CLIP Vision Encode** node.
  - `CLIP_VISION` of **Load CLIP Vision** into `clip_vision` of **CLIP Vision Encode**.
  - `IMAGE` of **Load Image** into `image` of **CLIP Vision Encode** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
  - `image` of **Load Image**: a value is chosen.
  - `clip_name` of **Load CLIP Vision**: a value is chosen.
- Step 5, **Apply the style model**:
  - a **Load Style Model** node.
  - a **Apply Style Model** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **Apply Style Model** (a FluxGuidance or Apply Style Model in between is accepted).
  - `STYLE_MODEL` of **Load Style Model** into `style_model` of **Apply Style Model**.
  - `CLIP_VISION_OUTPUT` of **CLIP Vision Encode** into `clip_vision_output` of **Apply Style Model**.
  - `style_model_name` of **Load Style Model**: a value is chosen.
- Step 6, **The empty latent and the sampler**:
  - a **EmptySD3LatentImage** node.
  - a **KSampler** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **Apply Style Model** into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **ConditioningZeroOut** into `negative` of **KSampler**.
  - `LATENT` of **EmptySD3LatentImage** into `latent_image` of **KSampler**.
  - `cfg` of **KSampler** is `1`.
- Step 7, **Decode and save**:
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## See also
- [Reference images: IP-Adapter, Redux, editing models](../concepts/Reference-Images.md)
- [Flux.1](../concepts/Family-Flux1.md)
- [How lessons work](How-Lessons-Work.md)
