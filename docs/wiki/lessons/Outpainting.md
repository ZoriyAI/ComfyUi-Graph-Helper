[Русский](Outpainting.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Outpainting: a picture beyond its edges

<!-- lesson: outpaint -->
Lesson "outpaint", in the group **Pictures: techniques** of the lesson list. Steps: 6.

## What you will be able to do
A picture gets a new strip on one side, and the model draws what lies beyond the frame.

## What you need
- It goes on from [Inpainting: redraw part of a picture](Inpainting.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Load Image, InpaintModelConditioning, KSampler, Pad Image for Outpainting.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What outpainting is** (reading)

   Outpainting is inpainting of a new strip. The picture gets an empty frame, the frame becomes the mask, and the model fills it so that it goes on from the picture.

   The lesson goes on from "Inpainting: redraw part of a picture".

2. **The inpainting graph is needed**

   This lesson goes on from the graph of "Inpainting: redraw part of a picture". The canvas must have **Load Checkpoint**, the texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **Load Image**, **InpaintModelConditioning** and **KSampler** as that lesson leaves them.

   If they are not there, do that lesson first.

3. **Add a frame**

   Add a **Pad Image for Outpainting** node and give it the picture at its `image` input, through the scaling node when there is one. Its `IMAGE` output goes into `pixels` of **InpaintModelConditioning**, its `MASK` output into `mask`: the mask painted by hand is replaced by the frame. Set `right` to 256.

   `left`, `top`, `right` and `bottom` say how many pixels to add on each side. `feathering` makes the border soft so the seam does not show. Add a little at a time: 256 pixels on one side is easier for a model than 1024 on every side.

4. **Draw the frame fully**

   Set `denoise` of **KSampler** to 1.

   The frame is empty grey, and there is nothing in it to keep. At a lower value the grey shows through.

5. **Describe the whole wider scene** (reading)

   Describe the picture as it should look with the new part: "a lighthouse on a cliff, the sea stretching away to the right, evening light".

   A model trained for inpainting fills a frame better. For a much wider picture, add one side at a time and take each result as the next picture.

6. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: `feathering` 10 and 60; the same frame on the left side.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The inpainting graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **Load Image** node.
  - a **InpaintModelConditioning** node.
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **InpaintModelConditioning** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **InpaintModelConditioning** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `positive` of **InpaintModelConditioning** into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `latent` of **InpaintModelConditioning** into `latent_image` of **KSampler**.
- Step 3, **Add a frame**:
  - a **Pad Image for Outpainting** node.
  - `IMAGE` of **Load Image** into `image` of **Pad Image for Outpainting** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
  - `IMAGE` of **Pad Image for Outpainting** into `pixels` of **InpaintModelConditioning**.
  - `MASK` of **Pad Image for Outpainting** into `mask` of **InpaintModelConditioning** (a GrowMask or FeatherMask or Invert Mask or ThresholdMask in between is accepted).
  - `right` of **Pad Image for Outpainting** is from 64 to 512; **Do this for me** sets 256.
- Step 4, **Draw the frame fully**:
  - `denoise` of **KSampler** is `1`.

## See also
- [Outpainting](../concepts/Outpainting.md)
- [Inpainting and masks](../concepts/Inpainting.md)
- [How lessons work](How-Lessons-Work.md)
