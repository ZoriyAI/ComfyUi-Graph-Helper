[Русский](Inpainting.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Inpainting: redraw part of a picture

<!-- lesson: inpaint -->
Lesson "inpaint", in the group **Pictures: techniques** of the lesson list. Steps: 10.

## What you will be able to do
You paint a mask over part of a picture, and the model draws only that part again, by a new prompt.

## What you need
- It goes on from [A picture from a picture](Image-To-Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Image, InpaintModelConditioning.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What inpainting is** (reading)

   Inpainting draws again the part of a picture under a mask and leaves the rest as it was. The mask is painted by hand in ComfyUI or made by a node that finds an object; that is the lesson "A mask by words".

   This lesson goes on from "A picture from a picture" and puts the inpainting node where the plain encoding was.

2. **The graph of a picture from a picture is needed**

   The canvas must have **Load Checkpoint**, the texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode**, **Save Image** and **Load Image**, as "A picture from a picture" leaves them.

   If they are not there, do that lesson first.

3. **Paint the mask in ComfyUI** (reading)

   The mask is painted in ComfyUI, not in this app. Open the graph there, right-click the Load Image node and choose "Open in MaskEditor". Paint over what must change, a little wider than the object, and press "Save".

   ComfyUI keeps the picture with its mask in the `input` folder, and the `MASK` output of the node carries the mask. A picture with a transparent area works the same: the transparent part is the mask.

   This app does not show the mask. The graph is the same either way.

4. **Which model draws a part best** (reading)

   Any model can draw under a mask, but the border often shows. Models trained for inpainting see the picture around the mask and blend better: for SD 1.5 the checkpoints with "inpainting" in the name, for Flux the Flux.1 Fill model (it has separate loaders: open the official "Flux.1 Fill Dev" template in ComfyUI to see its graph).

   An inpainting checkpoint goes into the same **Load Checkpoint** node as an ordinary one.

5. **Add the inpainting node**

   Add an **InpaintModelConditioning** node and connect to it:
   - to `positive` and `negative`, the two texts;
   - to `vae`, the `VAE` output of **Load Checkpoint**;
   - to `pixels`, the picture, through the scaling node when the picture goes through it;
   - to `mask`, the `MASK` output of **Load Image**.

   The node encodes the picture, marks the masked part in the latent and tells an inpainting model what lies around it. Leave `noise_mask` on: then only the masked part is drawn again.

6. **Feed the sampler from it**

   Connect the three outputs of **InpaintModelConditioning** to **KSampler**: `positive` to `positive`, `negative` to `negative`, `latent` to `latent_image`.

   The encoding node of the previous lesson is not needed any more: its link to the sampler is replaced.

7. **Set the strength**

   Set `denoise` of **KSampler** to 1 for an inpainting model. For an ordinary model take 0.6 to 0.8: the colours of the old content then show through and help it fit.

   If the masked part comes out the same as before, raise `denoise`. If it comes out foreign to the picture, lower it or take an inpainting model.

8. **Describe what should be there** (reading)

   Describe the whole picture with the new content, not an order to replace something. For a hat on a man: "a man in a red wool hat on a city street". The model sees the rest of the picture and fits the new part to it.

   The prompt can be short: the picture around says the rest.

9. **When the border shows** (reading)

   What helps:
   - paint the mask wider than the object; a Grow Mask node widens it by a few pixels;
   - a Differential Diffusion node between the model and the sampler softens the edge of the mask, as ComfyUI's Flux Fill template does;
   - for a small part of a large picture, the ComfyUI-Inpaint-CropAndStitch pack cuts out the area around the mask, draws it at the size the model likes and puts it back.

   A node pack runs other people's code on your computer. Install it yourself through ComfyUI's manager, from its official page, and only if you trust its authors. The app installs nothing.

10. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: the same mask with three different `seed` values; a mask painted tight and a mask painted wide.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The graph of a picture from a picture is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - a **Load Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 5, **Add the inpainting node**:
  - a **InpaintModelConditioning** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **InpaintModelConditioning** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **InpaintModelConditioning** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `VAE` of **Load Checkpoint** into `vae` of **InpaintModelConditioning**.
  - `IMAGE` of **Load Image** into `pixels` of **InpaintModelConditioning** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
  - `MASK` of **Load Image** into `mask` of **InpaintModelConditioning** (a GrowMask or FeatherMask or Invert Mask or ThresholdMask in between is accepted).
- Step 6, **Feed the sampler from it**:
  - `positive` of **InpaintModelConditioning** into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `negative` of **InpaintModelConditioning** into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `latent` of **InpaintModelConditioning** into `latent_image` of **KSampler**.
- Step 7, **Set the strength**:
  - `denoise` of **KSampler** is from 0.5 to 1; **Do this for me** sets 1.

## What next
These lessons go on from this one: [Outpainting: a picture beyond its edges](Outpainting.md), [A mask by words](Mask-By-Words.md).

## See also
- [Inpainting and masks](../concepts/Inpainting.md)
- [Denoise](../concepts/Denoise.md)
- [How lessons work](How-Lessons-Work.md)
