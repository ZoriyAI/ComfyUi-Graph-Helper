[Русский](Face-From-Photo.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The same face from one photo: IP-Adapter FaceID

<!-- lesson: face-same-photo -->
Lesson "face-same-photo", in the group **Faces and characters** of the lesson list. Steps: 11.

## Consent first
Only someone who agrees may be shown this way: yourself, a person who gave permission, or an invented character. Obtain consent before using a real person's likeness and permission for the source material, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who is or appears under 18; do not pass a person off as saying or doing what they did not. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You add IP-Adapter FaceID to the first picture graph so that a photo of a face drives the face of the new picture.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI_IPAdapter_plus**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Nodes: Load Checkpoint, KSampler, IPAdapter Unified Loader FaceID, Load Image, IPAdapter FaceID.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **First, about faces** (reading)

   Only someone who agrees may be shown this way: yourself, a person who gave permission, or an invented character. Obtain consent before using a real person's likeness and permission for the source material, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who is or appears under 18; do not pass a person off as saying or doing what they did not. This lesson teaches technique.

   IP-Adapter FaceID reads a face from one photo and makes the model draw that face in a new picture. The example is your own photo or a character you generated.

   The nodes of this lesson come from the ComfyUI_IPAdapter_plus pack. A pack runs other people's code on your computer: install it yourself through ComfyUI's manager, and only a pack you trust.

   This lesson goes on from the graph of "A first picture from text".

2. **The first picture graph is needed**

   The canvas must hold **Load Checkpoint** and **KSampler** with the model going from one to the other.

   FaceID works with SD 1.5 and SDXL checkpoints. With Flux, SD3 or Wan it does nothing useful: those families have their own methods.

3. **Which files it needs and where they go** (reading)

   The FaceID loader finds its files itself, by name, in these folders:
   - the FaceID adapter, such as ip-adapter-faceid-plusv2_sd15.bin or ip-adapter-faceid-plusv2_sdxl.bin: models/ipadapter;
   - its LoRA of the same name, ip-adapter-faceid-plusv2_sd15_lora.safetensors: models/loras;
   - the picture reader CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors: models/clip_vision;
   - InsightFace with its buffalo_l model: models/insightface. The InsightFace Python package must be installed in ComfyUI.

   Files in the old formats (.ckpt, .pt, .pth, .bin) can run code when they are loaded. Take them only from the model's official page. The pack's own page lists the exact names; take the files from the pages it links to.

4. **Add the FaceID loader**

   Add a **IPAdapter Unified Loader FaceID** node and connect the `MODEL` output of **Load Checkpoint** to its `model` input. Set `preset` to `FACEID PLUS V2` and `lora_strength` to 0.6.

   The preset picks the adapter and its LoRA. `FACEID PLUS V2` is the one the pack's example uses. The LoRA strength of 0.6 is the example's value too: higher pushes the face harder and stiffens the picture.

5. **Load the photo of the face**

   Add a **Load Image** node and choose the photo in its `image` field.

   The best photo is frontal, sharp and evenly lit, the face large in the frame, nothing covering it. InsightFace looks for one face: with several, it may take the wrong one.

6. **Add the FaceID node**

   Add an **IPAdapter FaceID** node and connect:
   - `model` and `ipadapter` from the outputs of the same name of **IPAdapter Unified Loader FaceID**;
   - `image` from **Load Image**.

   Then connect the `MODEL` output of **IPAdapter FaceID** to the `model` input of **KSampler**. The link that came straight from **Load Checkpoint** comes off by itself.

7. **Set the strength**

   In **IPAdapter FaceID** set `weight` to 1 and `weight_faceidv2` to 2, as the pack's example does.

   `weight` is how strongly the face is pressed into the picture. If the picture "burns", with harsh contrast, broken colours or a stiff mask of a face, lower it towards 0.7. `weight_faceidv2` works only with the V2 adapters and sets how much the face looks like the photo.

8. **Set the sampler**

   In **KSampler** set `steps` to 30 and `cfg` to 6.5, the example's values.

   With an adapter a high `cfg` burns the picture sooner: if lowering the `weight` is not enough, lower `cfg` as well.

9. **What it keeps and what it does not** (reading)

   FaceID keeps the face: its shape, the eyes, the nose, the mouth. It does not keep the hair, the age, the make-up, the light or the expression: those come from the prompt. Write them there.

   A photo in hard side light gives a face with that light baked in. A photo from below gives a wide jaw. This is why a frontal, evenly lit photo works best.

10. **Other identity adapters** (reading)

   Two other methods do the same job with other families:
   - InstantID (ComfyUI_InstantID pack): SDXL; an InstantID adapter in models/instantid, its own ControlNet in models/controlnet, and InsightFace AntelopeV2 in models/insightface. It also keeps the angle of the head from the photo;
   - PuLID (PuLID packs for SDXL and for Flux): a PuLID file in models/pulid, InsightFace AntelopeV2, and an EVA-CLIP model the pack downloads. It changes the rest of the picture less.

   Their graphs look like this one: a loader, a node that takes the face photo, and the model going on to the sampler.

11. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If you publish such a picture, do not present it as a photo of a real event.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The first picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or IPAdapter Unified Loader FaceID or IPAdapter FaceID in between is accepted).
- Step 4, **Add the FaceID loader**:
  - a **IPAdapter Unified Loader FaceID** node.
  - `MODEL` of **Load Checkpoint** into `model` of **IPAdapter Unified Loader FaceID** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `preset` of **IPAdapter Unified Loader FaceID** is `FACEID PLUS V2`.
  - `lora_strength` of **IPAdapter Unified Loader FaceID** is from 0.5 to 0.7; **Do this for me** sets 0.6.
- Step 5, **Load the photo of the face**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 6, **Add the FaceID node**:
  - a **IPAdapter FaceID** node.
  - `MODEL` of **IPAdapter Unified Loader FaceID** into `model` of **IPAdapter FaceID**.
  - `ipadapter` of **IPAdapter Unified Loader FaceID** into `ipadapter` of **IPAdapter FaceID**.
  - `IMAGE` of **Load Image** into `image` of **IPAdapter FaceID**.
  - `MODEL` of **IPAdapter FaceID** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
- Step 7, **Set the strength**:
  - `weight` of **IPAdapter FaceID** is from 0.5 to 1; **Do this for me** sets 1.
  - `weight_faceidv2` of **IPAdapter FaceID** is from 1 to 2; **Do this for me** sets 2.
- Step 8, **Set the sampler**:
  - `steps` of **KSampler** is from 20 to 40; **Do this for me** sets 30.
  - `cfg` of **KSampler** is from 4 to 7; **Do this for me** sets 6.5.

## See also
- [Reference images: IP-Adapter, Redux, editing models](../concepts/Reference-Images.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
