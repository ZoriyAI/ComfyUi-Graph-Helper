[Русский](Hires-Fix.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A second pass after upscaling (hires fix)

<!-- lesson: hires-fix -->
Lesson "hires-fix", in the group **Pictures: techniques** of the lesson list. Steps: 10.

## What you will be able to do
The enlarged picture is drawn once more by the model: sharp detail at a size the model cannot draw in one go.

## What you need
- It goes on from [Upscaling with a model](Upscale.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Upscale Model, Upscale Image (using Model), Upscale Image, VAE Encode.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Why two passes** (reading)

   A model draws well only near the size it was trained at. A larger picture is made in two passes: draw at the usual size, enlarge, then let the model draw the large picture again with part of the noise. The composition comes from the first pass, the detail from the second.

   This is called "hires fix". The lesson goes on from "Upscaling with a model".

2. **The upscaling graph is needed**

   The canvas must have the picture graph, **Load Checkpoint**, **CLIP Text Encode (Prompt)**, **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode**, **Save Image**, and after **VAE Decode** the nodes **Load Upscale Model** and **Upscale Image (using Model)**.

   If they are not there, do "Upscaling with a model" first.

3. **Bring it to the size you want**

   Add a **Upscale Image** node and connect the output of **Upscale Image (using Model)** to its `image` input. Set `width` and `height` to twice the size of the first picture: 2048 for a 1024 picture of SDXL, 1024 for a 512 picture of SD 1.5. A 0 in one of them keeps the proportions.

   A 4x model gives four times the size. For the second pass twice is enough, and every extra pixel costs memory.

4. **Turn it into a latent**

   Add a **VAE Encode** node: the output of **Upscale Image** into its `pixels` input, the `VAE` output of **Load Checkpoint** into `vae`.

5. **The second sampler**

   Add a second **KSampler** node and connect to it:
   - to `model`, the `MODEL` output of **Load Checkpoint**, through the LoRA loaders when there are any;
   - to `positive` and `negative`, the same two texts;
   - to `latent_image`, the output of **VAE Encode**.

   The same model and the same prompt draw their own picture again, now large.

6. **Set how much to draw again**

   Set `denoise` of **KSampler** to 0.5.

   At 0.5 the composition stays and every detail is drawn again at the large size. At 0.3 the change is slight. Above 0.6 the model starts to draw new objects, and at a size it was not trained at it repeats them: two heads, extra windows.

7. **Save the result**

   Add **VAE Decode** and **Save Image**: the output of **KSampler** into `samples`, the `VAE` of **Load Checkpoint** into `vae`, the picture into `images`.

   The savers of the earlier passes can become Preview Image nodes, so that only the final picture is written to disk.

8. **The other way: in the latent** (reading)

   ComfyUI has a second form of hires fix, without an upscale model: an Upscale Latent node between the first sampler and the second, and the second sampler at `denoise` 0.5. It is faster, but an enlarged latent is blurred, and the second pass must fill that in, so `denoise` cannot go much lower. ComfyUI's templates show both ways.

9. **Very large pictures** (reading)

   When the second pass runs out of memory:
   - VAE Decode (Tiled) and VAE Encode (Tiled) turn the picture into a latent and back piece by piece;
   - the ComfyUI_UltimateSDUpscale pack draws a large picture again in tiles, each at the size the model likes;
   - the Impact Pack does the same with its own tile nodes.

   A node pack runs other people's code on your computer. Install it yourself through ComfyUI's manager, from its official page, and only if you trust its authors. The app installs nothing.

10. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: `denoise` 0.35 and 0.55 on the same `seed`.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The upscaling graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - a **Load Upscale Model** node.
  - a **Upscale Image (using Model)** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (first pass) (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (first pass) (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (first pass) (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **KSampler** (first pass) into `samples` of **VAE Decode** (first pass).
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode** (first pass).
  - `IMAGE` of **VAE Decode** (first pass) into `images` of **Save Image** or **Preview Image** (first picture).
  - `UPSCALE_MODEL` of **Load Upscale Model** into `upscale_model` of **Upscale Image (using Model)**.
  - `IMAGE` of **VAE Decode** (first pass) into `image` of **Upscale Image (using Model)**.
- Step 3, **Bring it to the size you want**:
  - a **Upscale Image** node.
  - `IMAGE` of **Upscale Image (using Model)** into `image` of **Upscale Image**.
- Step 4, **Turn it into a latent**:
  - a **VAE Encode** node.
  - `IMAGE` of **Upscale Image** into `pixels` of **VAE Encode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Encode**.
- Step 5, **The second sampler**:
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (second pass) (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (second pass) (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (second pass) (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **VAE Encode** into `latent_image` of **KSampler** (second pass).
- Step 6, **Set how much to draw again**:
  - `denoise` of **KSampler** (second pass) is from 0.3 to 0.6; **Do this for me** sets 0.5.
- Step 7, **Save the result**:
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `LATENT` of **KSampler** (second pass) into `samples` of **VAE Decode** (second pass).
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode** (second pass).
  - `IMAGE` of **VAE Decode** (second pass) into `images` of **Save Image** or **Preview Image** (second pass).

## See also
- [Upscaling](../concepts/Upscaling.md)
- [Denoise](../concepts/Denoise.md)
- [How lessons work](How-Lessons-Work.md)
