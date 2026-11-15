[Русский](Detailer.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Fixing faces and hands with a detailer

<!-- lesson: detailer -->
Lesson "detailer", in the group **Packs and tools** of the lesson list. Steps: 8.

## What you will be able to do
The Impact Pack finds the faces in a finished picture and draws each one again at a larger size, so small faces come out sharp.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI-Impact-Pack**, **ComfyUI-Impact-Subpack**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Model files the lesson checks:
  - for `model_name` of **UltralyticsDetectorProvider**: a file whose name has `face` or `hand`.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, UltralyticsDetectorProvider, FaceDetailer, Save Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What a detailer does** (reading)

   In a full-length picture a face is small, and the model has too few pixels to draw it well. A detailer finds each face, cuts it out, enlarges it, draws it again with the same model and prompt at part of the noise, and puts it back.

   It draws again the face that is there. It does not put another person's face in its place, and this lesson is not about that.

   The nodes come with ComfyUI-Impact-Pack and ComfyUI-Impact-Subpack. A node pack runs other people's code on your computer. Install it yourself through ComfyUI's manager, from its official page, and only if you trust its authors. The app installs nothing.

   The lesson adds three nodes to the graph of "A first picture from text".

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have **Load Checkpoint**, the two texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** and **Save Image** with the links between them.

   If they are not there, do that lesson first.

3. **Load a face detector**

   Add a **UltralyticsDetectorProvider** node and choose `bbox/face_yolov8m.pt` in its `model_name` field. ComfyUI keeps the detectors in `models/ultralytics/bbox`.

   A ".pt" file can run code when it is loaded: take it only from the page the pack names.

4. **Add the detailer**

   Add a **FaceDetailer** node and connect to it:
   - `image`: the output of **VAE Decode**;
   - `model`, `clip` and `vae`: the outputs of **Load Checkpoint**, through the LoRA loaders when there are any;
   - `positive` and `negative`: the two texts;
   - `bbox_detector`: the `BBOX_DETECTOR` output of **UltralyticsDetectorProvider**.

   The detailer has a sampler inside: it draws with the same model and words as the picture.

5. **Set how much to draw again**

   Leave `denoise` of **FaceDetailer** at 0.5.

   At 0.5 the face keeps its features and gets sharp eyes and skin. Above 0.6 it may turn into another face. `guide_size` is the size a face is enlarged to before drawing: 512 for SD 1.5, 1024 for SDXL.

6. **Save the fixed picture**

   Add a **Save Image** node and connect the `image` output of **FaceDetailer** to its `images` input. Compare it with the picture before.

7. **Hands, and finer masks** (reading)

   - For hands choose `bbox/hand_yolov8s.pt` in **UltralyticsDetectorProvider**, or put a second detailer after the first: one for faces, one for hands.
   - A SAMLoader node at `sam_model_opt` makes the mask follow the outline of the face instead of a box: fewer seams.
   - Hands with wrong fingers are often beyond a detailer: draw them again with inpainting or ControlNet.

8. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: a picture of several people far away; the detailer should fix every face.

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
- Step 3, **Load a face detector**:
  - a **UltralyticsDetectorProvider** node.
  - `model_name` of **UltralyticsDetectorProvider** holds a file whose name has `face` or `hand` (capitals, dots and dashes do not matter).
- Step 4, **Add the detailer**:
  - a **FaceDetailer** node.
  - `IMAGE` of **VAE Decode** into `image` of **FaceDetailer**.
  - `MODEL` of **Load Checkpoint** into `model` of **FaceDetailer** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **FaceDetailer** (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `VAE` of **Load Checkpoint** into `vae` of **FaceDetailer**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **FaceDetailer** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **FaceDetailer** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `BBOX_DETECTOR` of **UltralyticsDetectorProvider** into `bbox_detector` of **FaceDetailer**.
- Step 5, **Set how much to draw again**:
  - `denoise` of **FaceDetailer** is from 0.3 to 0.6; **Do this for me** sets 0.5.
- Step 6, **Save the fixed picture**:
  - a **Save Image** node.
  - `image` of **FaceDetailer** into `images` of **Save Image** (fixed picture).

## See also
- [Inpainting and masks](../concepts/Inpainting.md)
- [Node packs](../concepts/Node-Packs.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
