[Русский](Video-Upscale.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A larger, sharper video: SeedVR2

<!-- lesson: video-upscale -->
Lesson "video-upscale", in the group **Packs and tools** of the lesson list. Steps: 8.

## What you will be able to do
A low-resolution clip is redrawn at 1080p with its details restored.

## What you need
- It goes on from [Load, cut and save video: VideoHelperSuite](VideoHelperSuite.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI-SeedVR2_VideoUpscaler**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Model files the lesson checks:
  - for `model` of **SeedVR2 (Down)Load DiT Model**: a file whose name has `seedvr2`;
  - for `model` of **SeedVR2 (Down)Load VAE Model**: a file whose name has `vae`.
- Nodes: Load Video, Get Video Components, SeedVR2 (Down)Load DiT Model, SeedVR2 (Down)Load VAE Model, SeedVR2 Video Upscaler, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What it costs, first** (reading)

   This lesson needs the ComfyUI-SeedVR2_VideoUpscaler pack. Install it yourself through ComfyUI's manager. A pack runs other people's code on your computer, so take it from its official page and keep it up to date.

   SeedVR2 does not only stretch frames: it redraws them larger, restoring detail, and keeps neighbouring frames consistent.

   What it costs: the 3B model (about 7 GB) or the 7B one (about 16 GB, sharper), and a VAE. When a file is missing, the pack's loader fetches it itself into `models/SEEDVR2` when the graph is first run in ComfyUI; the app downloads nothing. With block swapping and tiled VAE, as here, the 3B model runs on modest cards. Each frame is redrawn, so a long clip takes long: start with a few seconds.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the clip**

   Add **Load Video** and **Get Video Components**. Choose the clip in `file` and connect **Load Video** to the `video` input of **Get Video Components**.

3. **Load the model with block swapping**

   Add a **SeedVR2 (Down)Load DiT Model** node. In `model` choose the 3B file to start with. Set `blocks_to_swap` to 32 and `offload_device` to `cpu`.

   Block swapping keeps most of the model's blocks in system memory and brings each in when it is needed: much less graphics memory, a slower run. With a large card, set it to 0.

4. **Load the VAE in tiles**

   Add a **SeedVR2 (Down)Load VAE Model** node, choose the VAE file in `model`, and set `encode_tiled` and `decode_tiled` to `true`.

   The frames are read and written in pieces, so the peak of memory stays low.

5. **The upscaler**

   Add a **SeedVR2 Video Upscaler** node. Connect the `images` output of **Get Video Components** to its `image` input, **SeedVR2 (Down)Load DiT Model** to `dit` and **SeedVR2 (Down)Load VAE Model** to `vae`. Set `resolution` to 1080, `batch_size` to 33 and `color_correction` to `lab`.

   `resolution` is the length of the shorter side of the result. `batch_size` is how many frames are redrawn together: more keeps the motion consistent and needs more memory. It is of the form 4n + 1 (5, 21, 33).

6. **Save with the sound**

   Add **Create Video** and **Save Video**. The frames of **SeedVR2 Video Upscaler** go into `images`, the `audio` output of **Get Video Components** into `audio`, the clip into `video` of **Save Video**. Set `fps` to the rate of the original clip, for example 24.

7. **When the result is not right** (reading)

   - Out of memory: lower `batch_size` to 21 or 5, or `resolution` to 720.
   - Flicker between groups of frames: raise `batch_size`.
   - The colours shift: try `wavelet` in `color_correction`.
   - Too slow: cut the clip shorter first; the template takes the first 96 frames with Image From Batch, which the app accepts on the way.

8. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the clip**:
  - a **Load Video** node.
  - a **Get Video Components** node.
  - `VIDEO` of **Load Video** into `video` of **Get Video Components**.
  - `file` of **Load Video**: a value is chosen.
- Step 3, **Load the model with block swapping**:
  - a **SeedVR2 (Down)Load DiT Model** node.
  - `model` of **SeedVR2 (Down)Load DiT Model** holds a file whose name has `seedvr2` (capitals, dots and dashes do not matter).
  - `blocks_to_swap` of **SeedVR2 (Down)Load DiT Model** is from 0 to 36; **Do this for me** sets 32.
  - `offload_device` of **SeedVR2 (Down)Load DiT Model** is `cpu`.
- Step 4, **Load the VAE in tiles**:
  - a **SeedVR2 (Down)Load VAE Model** node.
  - `model` of **SeedVR2 (Down)Load VAE Model** holds a file whose name has `vae` (capitals, dots and dashes do not matter).
  - `encode_tiled` of **SeedVR2 (Down)Load VAE Model** is `true`.
  - `decode_tiled` of **SeedVR2 (Down)Load VAE Model** is `true`.
- Step 5, **The upscaler**:
  - a **SeedVR2 Video Upscaler** node.
  - `images` of **Get Video Components** into `image` of **SeedVR2 Video Upscaler** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `SEEDVR2_DIT` of **SeedVR2 (Down)Load DiT Model** into `dit` of **SeedVR2 Video Upscaler**.
  - `SEEDVR2_VAE` of **SeedVR2 (Down)Load VAE Model** into `vae` of **SeedVR2 Video Upscaler**.
  - `resolution` of **SeedVR2 Video Upscaler** is from 720 to 2160; **Do this for me** sets 1080.
  - `batch_size` of **SeedVR2 Video Upscaler** is from 5 to 81; **Do this for me** sets 33.
  - `color_correction` of **SeedVR2 Video Upscaler** is `lab`.
- Step 6, **Save with the sound**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **SeedVR2 Video Upscaler** into `images` of **Create Video**.
  - `audio` of **Get Video Components** into `audio` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is from 1 to 120; **Do this for me** sets 24.

## See also
- [Upscaling](../concepts/Upscaling.md)
- [Node packs](../concepts/Node-Packs.md)
- [How lessons work](How-Lessons-Work.md)
