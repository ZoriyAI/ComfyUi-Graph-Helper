[Русский](Face-Restore.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Restore a face in an old picture: ReActor

<!-- lesson: face-restore -->
Lesson "face-restore", in the group **Faces and characters** of the lesson list. Steps: 7.

## Consent first
The result is a likeness, not a record of how the person looked. Restore pictures you have the right to use: your own, your family's with their agreement, invented people. Obtain consent before using a real person's likeness, and do not put it into explicit content. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You build a graph that redraws blurred or damaged faces in a picture with a face restoration model.

## What you need
- Node packs: **ComfyUI-ReActor**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Model files the lesson checks:
  - for `model` of **Restore Face 🌌 ReActor**: a model, not `none`.
- Nodes: Load Image, Restore Face 🌌 ReActor, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **First, what restoring is** (reading)

   A restoration model finds the faces in a picture and draws them again, sharp. It does not know the real face: it guesses the details. The result is a likeness, not a record of how the person looked.

   Restore pictures you have the right to use: your own, your family's with their agreement, invented people. Obtain consent before using a real person's likeness, and do not put it into explicit content.

   The nodes of this lesson come from the ComfyUI-ReActor pack. A pack runs other people's code on your computer: install it yourself through ComfyUI's manager, and only a pack you trust. If the folder models/facerestore_models is empty, the pack itself downloads four restoration models there when ComfyUI starts.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the picture**

   Add a **Load Image** node and choose the picture in its `image` field.

   If the picture is very small, enlarge it first with an upscale model: the restoration model works on faces of a certain size.

3. **Add the restoration**

   Add a **Restore Face 🌌 ReActor** node and connect the picture from **Load Image** to its `image` input. In `model` choose the restoration model; with `none` nothing happens.

   The usual ones: `codeformer-v0.1.0.pth` handles badly damaged faces, `GFPGANv1.4.pth` keeps more of the original, `GPEN-BFR-512.onnx` is sharp on large faces.

   Files in the old formats (.ckpt, .pt, .pth, .bin) can run code when they are loaded. Take them only from the model's official page.

4. **Set how much is changed**

   In **Restore Face 🌌 ReActor** set:
   - `facedetection`: `retinaface_resnet50`, the most careful way to find faces;
   - `visibility`: 1, how strongly the new face covers the old; lower blends them;
   - `codeformer_weight`: 0.5, for CodeFormer only: closer to 0 is sharper and less alike, closer to 1 is more alike and softer.

5. **Save the picture**

   Add a **Save Image** node and connect the output of **Restore Face 🌌 ReActor** to its `images` input.

6. **When the face looks wrong** (reading)

   - The face looks painted on: lower `visibility` to 0.7.
   - The face is not alike: try `GFPGANv1.4.pth` or raise `codeformer_weight`.
   - A face is missed: it is too small or turned away; enlarge the picture first.
   - The rest of the picture stays old: the node restores faces only.

   The facerestore_cf pack does the same with its own nodes and reads the same folder models/facerestore_models.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 3, **Add the restoration**:
  - a **Restore Face 🌌 ReActor** node.
  - `IMAGE` of **Load Image** into `image` of **Restore Face 🌌 ReActor**.
  - `model` of **Restore Face 🌌 ReActor** holds a file and not `none` (capitals, dots and dashes do not matter).
- Step 4, **Set how much is changed**:
  - `facedetection` of **Restore Face 🌌 ReActor** is `retinaface_resnet50`.
  - `visibility` of **Restore Face 🌌 ReActor** is from 0.5 to 1; **Do this for me** sets 1.
  - `codeformer_weight` of **Restore Face 🌌 ReActor** is from 0.3 to 0.8; **Do this for me** sets 0.5.
- Step 5, **Save the picture**:
  - a **Save Image** or **Preview Image** node.
  - `IMAGE` of **Restore Face 🌌 ReActor** into `images` of **Save Image** or **Preview Image**.

## What next
These lessons go on from this one: [Put a face onto a picture: ReActor](Face-Swap.md).

## See also
- [Node packs](../concepts/Node-Packs.md)
- [Unsafe model formats](../concepts/Unsafe-Model-Formats.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
