[Русский](Upscale.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Upscaling with a model

<!-- lesson: upscale -->
Lesson "upscale", in the group **Pictures: techniques** of the lesson list. Steps: 7.

## What you will be able to do
The finished picture is enlarged by a model that draws sharp detail instead of stretching the pixels.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Upscale Model, Upscale Image (using Model), Save Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What an upscale model is** (reading)

   An upscale model is a small network trained to enlarge pictures: it draws edges and textures where simple stretching gives blur. It does not know your prompt and adds nothing new: it makes what is there larger.

   The lesson adds three nodes to the graph of "A first picture from text".

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have **Load Checkpoint**, the two texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** and **Save Image** with the links between them.

   If they are not there, do that lesson first.

3. **Load the upscale model**

   Add a **Load Upscale Model** node and choose the model in its `model_name` field. ComfyUI looks for these files in `models/upscale_models`.

   The number in the name says how many times it enlarges: 4x is four times, 2x is twice. Some models are trained for photos, others for drawings.

   Files in old formats (.pth, .pt) can run code when they are loaded: take them only from the model's official page or a collection you trust, such as OpenModelDB.

4. **Enlarge the picture**

   Add a **Upscale Image (using Model)** node. The output of **Load Upscale Model** goes into its `upscale_model` input, the `IMAGE` output of **VAE Decode** into `image`.

5. **Save the large picture**

   Add one more **Save Image** node and connect the output of **Upscale Image (using Model)** to its `images` input.

   The graph now saves the picture twice, as drawn and enlarged. Compare them at full size.

6. **What an upscale model can and cannot do** (reading)

   - A 4x model turns a 1024 picture into 4096 pixels a side, sixteen times the pixels: that takes memory and time. Take a 2x model, or make the result smaller afterwards.
   - It does not fix a wrong hand or a blurred face: it enlarges the mistake. A second pass does that, the next lesson.
   - Different models suit different pictures: compare two on the same picture.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Next, "A second pass after upscaling (hires fix)" adds detail to the large picture.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image** (first picture).
- Step 3, **Load the upscale model**:
  - a **Load Upscale Model** node.
  - `model_name` of **Load Upscale Model**: a value is chosen.
- Step 4, **Enlarge the picture**:
  - a **Upscale Image (using Model)** node.
  - `UPSCALE_MODEL` of **Load Upscale Model** into `upscale_model` of **Upscale Image (using Model)**.
  - `IMAGE` of **VAE Decode** into `image` of **Upscale Image (using Model)**.
- Step 5, **Save the large picture**:
  - a **Save Image** node.
  - `IMAGE` of **Upscale Image (using Model)** into `images` of **Save Image** (large picture).

## What next
These lessons go on from this one: [A second pass after upscaling (hires fix)](Hires-Fix.md).

## See also
- [Upscaling](../concepts/Upscaling.md)
- [Unsafe model formats](../concepts/Unsafe-Model-Formats.md)
- [How lessons work](How-Lessons-Work.md)
