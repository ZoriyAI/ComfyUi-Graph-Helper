[Русский](IP-Adapter.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A reference picture with IP-Adapter

<!-- lesson: ipadapter -->
Lesson "ipadapter", in the group **Packs and tools** of the lesson list. Steps: 9.

## Consent first
Only the face of someone who agrees may be carried this way. Get that consent first. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
An SD 1.5 or SDXL model takes the style of a sample picture through the ComfyUI_IPAdapter_plus pack.

## What you need
- It goes on from [LoRA for pictures](LoRA-Image.md), [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI_IPAdapter_plus**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, IPAdapter Unified Loader, Load Image, IPAdapter.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What IP-Adapter does** (reading)

   IP-Adapter is "a LoRA from one picture": it shows the model a sample, and the model draws in its manner. It works with SD 1.5 and SDXL models.

   The nodes come with the ComfyUI_IPAdapter_plus pack. A node pack runs other people's code on your computer. Install it yourself through ComfyUI's manager, from its official page, and only if you trust its authors. The app installs nothing. Its author keeps it in maintenance mode: it works, but new models are not added.

   The lesson adds three nodes to the graph of "A first picture from text".

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have **Load Checkpoint**, the two texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** and **Save Image** with the links between them.

   If they are not there, do that lesson first.

3. **The files the pack needs** (reading)

   The unified loader of the pack finds its files by name, so they must be named exactly as the pack's page says:
   - the IP-Adapter models in `models/ipadapter`, for example ip-adapter-plus_sdxl_vit-h;
   - the vision model in `models/clip_vision`, named as the pack's page says.

   Files in old formats (.bin, .pth) can run code when they are loaded: take them only from the official pages the pack names.

4. **The unified loader**

   Add an **IPAdapter Unified Loader** node and connect the `MODEL` output of **Load Checkpoint** to its `model` input. Set `preset` to `PLUS (high strength)`.

   The preset says which IP-Adapter to take; the loader finds it and the vision model by their names.

5. **Load the sample**

   Add a **Load Image** node and choose the sample picture in its `image` field: the style you want, not the subject.

6. **Apply it to the model**

   Add an **IPAdapter** node and connect: `model` and `ipadapter` from the outputs of **IPAdapter Unified Loader** with the same names, `image` from **Load Image**. Its `MODEL` output goes into `model` of **KSampler**, in place of the direct link.

   IP-Adapter changes the model itself, not the prompt; that is why it stands on the way of the model.

7. **Set the weight and the kind**

   Set `weight` of **IPAdapter** to 0.8 and `weight_type` to `style transfer`.

   `style transfer` takes the look of the sample and leaves its content; `standard` takes both. At `weight` 1 and above the sample presses on the picture; at 0.5 it only tints it.

8. **Fine tuning** (reading)

   - `start_at` and `end_at` say in which part of the steps it acts, as with ControlNet.
   - The pack's "IPAdapter Style & Composition" node takes one picture for the style and another for the composition.
   - `style transfer` is precise with SDXL and rougher with SD 1.5.
   - The pack's FaceID nodes carry a face. Only the face of someone who agrees may be carried this way. Get that consent first.

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: one sample at `weight` 0.5 and at 1.

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
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 4, **The unified loader**:
  - a **IPAdapter Unified Loader** node.
  - `MODEL` of **Load Checkpoint** into `model` of **IPAdapter Unified Loader** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `preset` of **IPAdapter Unified Loader** is `PLUS (high strength)`.
- Step 5, **Load the sample**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 6, **Apply it to the model**:
  - a **IPAdapter** node.
  - `model` of **IPAdapter Unified Loader** into `model` of **IPAdapter**.
  - `ipadapter` of **IPAdapter Unified Loader** into `ipadapter` of **IPAdapter**.
  - `IMAGE` of **Load Image** into `image` of **IPAdapter** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
  - `MODEL` of **IPAdapter** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
- Step 7, **Set the weight and the kind**:
  - `weight` of **IPAdapter** is from 0.5 to 0.9; **Do this for me** sets 0.8.
  - `weight_type` of **IPAdapter** is `style transfer`.

## See also
- [Reference images: IP-Adapter, Redux, editing models](../concepts/Reference-Images.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
