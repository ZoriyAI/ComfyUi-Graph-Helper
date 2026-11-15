[Русский](Mask-By-Words.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A mask by words

<!-- lesson: mask-text -->
Lesson "mask-text", in the group **Pictures: techniques** of the lesson list. Steps: 8.

## What you will be able to do
ComfyUI finds an object by its name and gives its mask to the inpainting node, with no painting by hand.

## What you need
- It goes on from [Inpainting: redraw part of a picture](Inpainting.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Load Image, InpaintModelConditioning, KSampler, SAM3 Detect.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What SAM3 does** (reading)

   SAM3 is a model that finds in a picture what a word names and outlines it exactly. Write "hat", and it gives the mask of the hat. That mask goes where the mask painted by hand went.

   Its nodes are part of new versions of ComfyUI. The lesson goes on from "Inpainting: redraw part of a picture".

2. **The inpainting graph is needed**

   This lesson goes on from the graph of "Inpainting: redraw part of a picture". The canvas must have **Load Checkpoint**, the texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **Load Image**, **InpaintModelConditioning** and **KSampler** as that lesson leaves them.

   If they are not there, do that lesson first.

3. **Load the finder**

   Add one more **Load Checkpoint** node and choose the file of the finder in its `ckpt_name` field, for example sam3.1_multiplex_fp16. One file holds the finder and its text reader, which is why it goes into the ordinary checkpoint loader.

   It does not draw: the model that draws stays in **Load Checkpoint**.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the official template "Image Segment (SAM3)": it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

4. **Say what to find**

   Add **CLIP Text Encode (Prompt)** and **SAM3 Detect**.
   - The `CLIP` output of **Load Checkpoint** goes into the `clip` input of **CLIP Text Encode (Prompt)**. Write in its `text` field what to find, a word or two in English: hat, red car.
   - **SAM3 Detect** gets `model` from **Load Checkpoint**, `image` from **Load Image**, through the scaling node as the inpainting node gets it, and `conditioning` from **CLIP Text Encode (Prompt)**.

   The finder must see the picture at the same size as the inpainting node, or the mask will not fit.

5. **Set how sure it must be**

   Leave `threshold` of **SAM3 Detect** at 0.5.

   Lower, and the finder takes more for the object, including what only looks like it. Higher, and it may find nothing. If the mask is empty, lower it to 0.3.

6. **Give the mask to the inpainting node**

   Connect the `masks` output of **SAM3 Detect** to the `mask` input of **InpaintModelConditioning**. The link from the mask painted by hand is replaced.

   The mask of a found object is tight. Pass it through a Grow Mask node that adds 8 to 16 pixels, so the model has room to blend the edge.

7. **By a click instead of a word** (reading)

   The finder also takes points: `positive_coords` says where the object is, `negative_coords` where it is not. Points come as text with coordinates; a node where you click them on the picture comes with a pack, for example the Points Editor of ComfyUI-KJNodes.

   The ComfyUI-Florence2 and ComfyUI-segment-anything-2 packs do the same with older models: Florence2 finds a box by words, SAM2 outlines what is in it. A node pack runs other people's code on your computer. Install it yourself through ComfyUI's manager, from its official page, and only if you trust its authors. The app installs nothing.

   To see the mask before drawing, connect `masks` to a Preview Mask node.

8. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: `individual_masks` on, when the word finds several objects and you need one of them.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The inpainting graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **Load Image** node.
  - a **InpaintModelConditioning** node.
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** (picture model) into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **InpaintModelConditioning** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **InpaintModelConditioning** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `positive` of **InpaintModelConditioning** into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `latent` of **InpaintModelConditioning** into `latent_image` of **KSampler**.
- Step 3, **Load the finder**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint** (finder) is not the same file as `ckpt_name` of **Load Checkpoint** (picture model).
- Step 4, **Say what to find**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **SAM3 Detect** node.
  - `CLIP` of **Load Checkpoint** (finder) into `clip` of **CLIP Text Encode (Prompt)** (what to find).
  - `MODEL` of **Load Checkpoint** (finder) into `model` of **SAM3 Detect**.
  - `IMAGE` of **Load Image** into `image` of **SAM3 Detect** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (what to find) into `conditioning` of **SAM3 Detect**.
  - `text` of **CLIP Text Encode (Prompt)** (what to find) holds at least 3 characters.
- Step 5, **Set how sure it must be**:
  - `threshold` of **SAM3 Detect** is from 0.3 to 0.7; **Do this for me** sets 0.5.
- Step 6, **Give the mask to the inpainting node**:
  - `masks` of **SAM3 Detect** into `mask` of **InpaintModelConditioning** (a GrowMask or FeatherMask or Invert Mask or ThresholdMask in between is accepted).

## See also
- [Inpainting and masks](../concepts/Inpainting.md)
- [How lessons work](How-Lessons-Work.md)
