[Русский](Face-Swap.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Put a face onto a picture: ReActor

<!-- lesson: face-swap -->
Lesson "face-swap", in the group **Faces and characters** of the lesson list. Steps: 9.

## Consent first
Only someone who agrees may be shown this way: yourself, a person who gave permission, or an invented character. Obtain consent before using a real person's likeness and permission for the source material, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who is or appears under 18; do not pass a person off as saying or doing what they did not. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You build a graph that puts a face from one picture onto a person in another picture you already have.

## What you need
- It goes on from [Restore a face in an old picture: ReActor](Face-Restore.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI-ReActor**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Model files the lesson checks:
  - for `face_restore_model` of **ReActor 🌌 Fast Face Swap**: a model, not `none`.
- Nodes: Load Image, ReActor 🌌 Fast Face Swap, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **First, about faces** (reading)

   Only someone who agrees may be shown this way: yourself, a person who gave permission, or an invented character. Obtain consent before using a real person's likeness and permission for the source material, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who is or appears under 18; do not pass a person off as saying or doing what they did not. This lesson teaches technique.

   ReActor finds a face in one picture and puts it onto a face in another. The example: a character you generated gets the face from your own photo, or your own face goes into a picture you drew.

   The nodes of this lesson come from the ComfyUI-ReActor pack. A pack runs other people's code on your computer: install it yourself through ComfyUI's manager, and only a pack you trust. The pack has its own detector that refuses explicit pictures.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the picture to change**

   Add a **Load Image** node and choose the picture whose face is replaced in its `image` field.

3. **Load the face**

   Add a **Load Image** node and choose the picture with the face in its `image` field. It must be another file than the first.

   A frontal, sharp face works best. If either picture has several faces, the node takes them in order from the left; its fields `input_faces_index` and `source_faces_index` choose which.

4. **Add the swap**

   Add a **ReActor 🌌 Fast Face Swap** node. Connect the picture from **Load Image** to its `input_image` input and the face from **Load Image** to its `source_image` input.

   In `swap_model` choose `inswapper_128.onnx`; the pack downloads it to models/insightface when it is installed. Set `facedetection` to `retinaface_resnet50`, the most careful way to find faces.

5. **Sharpen the new face**

   The swap model works at a small size, so the new face comes out soft. In **ReActor 🌌 Fast Face Swap** choose a restoration model in `face_restore_model`, for example `codeformer-v0.1.0.pth`, set `face_restore_visibility` to 1 and `codeformer_weight` to 0.5.

   These do what the lesson "Restore a face in an old picture: ReActor" explains.

6. **Save the result**

   Add a **Save Image** node and connect the `SWAPPED_IMAGE` output of **ReActor 🌌 Fast Face Swap** to its `images` input.

7. **Swap, adapter or LoRA** (reading)

   A swap changes a picture that already exists: the pose, the light and the clothes stay, only the face is new. An adapter such as IP-Adapter FaceID draws a new picture around the face. A LoRA trained on the character holds face, body and clothes in every picture.

   The built-in knowledge "Identity: adapter, LoRA or swap" compares them.

8. **When the result is bad** (reading)

   - The face looks pasted on: lower `face_restore_visibility` to 0.7, or try `GFPGANv1.4.pth`.
   - The wrong face is changed: set `input_faces_index`.
   - The skin tone differs: pick a source photo with similar light.
   - Nothing happens: no face was found; use a larger, frontal face.

   A face that is small or broken in a picture you drew is repaired in "Fixing faces and hands with a detailer".

   The InsightFace models the swap uses are for non-commercial use only.

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Nothing made this way may pass a person off as saying or doing what they did not.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the picture to change**:
  - a **Load Image** node.
  - `image` of **Load Image** (picture to change): a value is chosen.
- Step 3, **Load the face**:
  - a **Load Image** node.
  - `image` of **Load Image** (face) is not the same file as `image` of **Load Image** (picture to change).
- Step 4, **Add the swap**:
  - a **ReActor 🌌 Fast Face Swap** node.
  - `IMAGE` of **Load Image** (picture to change) into `input_image` of **ReActor 🌌 Fast Face Swap**.
  - `IMAGE` of **Load Image** (face) into `source_image` of **ReActor 🌌 Fast Face Swap**.
  - `swap_model` of **ReActor 🌌 Fast Face Swap**: a value is chosen.
  - `facedetection` of **ReActor 🌌 Fast Face Swap** is `retinaface_resnet50`.
- Step 5, **Sharpen the new face**:
  - `face_restore_model` of **ReActor 🌌 Fast Face Swap** holds a file and not `none` (capitals, dots and dashes do not matter).
  - `face_restore_visibility` of **ReActor 🌌 Fast Face Swap** is from 0.5 to 1; **Do this for me** sets 1.
  - `codeformer_weight` of **ReActor 🌌 Fast Face Swap** is from 0.3 to 0.8; **Do this for me** sets 0.5.
- Step 6, **Save the result**:
  - a **Save Image** or **Preview Image** node.
  - `SWAPPED_IMAGE` of **ReActor 🌌 Fast Face Swap** into `images` of **Save Image** or **Preview Image**.

## See also
- [Node packs](../concepts/Node-Packs.md)
- [Unsafe model formats](../concepts/Unsafe-Model-Formats.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
