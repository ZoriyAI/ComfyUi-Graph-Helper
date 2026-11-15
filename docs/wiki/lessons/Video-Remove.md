[Русский](Video-Remove.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Remove an object from a video: ProPainter

<!-- lesson: video-remove -->
Lesson "video-remove", in the group **Packs and tools** of the lesson list. Steps: 8.

## What you will be able to do
An object marked by a mask video disappears, and the background behind it is filled in from the neighbouring frames.

## What you need
- It goes on from [Load, cut and save video: VideoHelperSuite](VideoHelperSuite.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI-VideoHelperSuite**, **ComfyUI_ProPainter_Nodes**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Nodes: Load Video (Upload) 🎥🅥🅗🅢 / VHS_LoadVideoPath, Convert Image to Mask, ProPainter Inpainting, Video Combine 🎥🅥🅗🅢.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What it costs, first** (reading)

   This lesson needs the ComfyUI_ProPainter_Nodes pack. Install it yourself through ComfyUI's manager. A pack runs other people's code on your computer, so take it from its official page and keep it up to date. The example also uses ComfyUI-VideoHelperSuite to load and save.

   ProPainter follows the motion between frames and fills a masked area with what the other frames show behind it. It needs two videos of the same length: the clip, and a mask video where the object to remove is red (or white) and the rest black. A mask video is made in a video editor or with a segmentation pack such as SAM2.

   What it costs: its models are small; the pack fetches them itself into its own folder when the graph is first run in ComfyUI. Memory grows quickly with the size and the number of frames; the example halves the size and takes 24 frames.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the clip**

   Add a **Load Video (Upload) 🎥🅥🅗🅢** node, choose the clip in `video` and set `frame_load_cap` to 24.

   Try a short piece first: the work grows with every frame.

3. **Load the mask video**

   Add a second **Load Video (Upload) 🎥🅥🅗🅢** node, choose the mask video in `video` and set the same `frame_load_cap` and `skip_first_frames` as for the clip.

   The mask must match the clip frame for frame; a shift of one frame leaves a ghost of the object.

4. **Turn the mask video into a mask**

   Add a **Convert Image to Mask** node, connect the frames of the mask video to its `image` input and set `channel` to `red`.

   The node reads one colour of each frame as the mask: where it is bright, the object is removed.

5. **Remove the object**

   Add a **ProPainter Inpainting** node. Connect the frames of the clip to `image` and the output of **Convert Image to Mask** to `mask`. Set `width` to 640 and `height` to 480 (the size of your frames) and `mask_dilates` to 5.

   `mask_dilates` widens the mask by a few pixels, so the edge of the object does not stay behind.

   If the frames are large, put an Upscale Image By node with 0.5 before both inputs, as the example does; the app accepts it on the way.

6. **Save the result**

   Add a **Video Combine 🎥🅥🅗🅢** node, connect the `IMAGE` output of **ProPainter Inpainting** to `images` and set `frame_rate` to 24, the rate of the clip.

7. **When the result is not right** (reading)

   - A shadow or an edge of the object remains: raise `mask_dilates` to 8-10, or widen the mask itself.
   - The filled area is blurry: the background behind the object is never seen in the clip; ProPainter can only invent it roughly.
   - Out of memory: fewer frames, or a smaller size.

8. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the clip**:
  - a **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** node.
  - `video` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (clip): a value is chosen.
  - `frame_load_cap` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (clip) is from 1 to 300; **Do this for me** sets 24.
- Step 3, **Load the mask video**:
  - a **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** node.
  - `video` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (mask video) is not the same file as `video` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (clip).
  - `frame_load_cap` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (mask video) equals `frame_load_cap` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (clip).
- Step 4, **Turn the mask video into a mask**:
  - a **Convert Image to Mask** node.
  - `IMAGE` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (mask video) into `image` of **Convert Image to Mask** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `channel` of **Convert Image to Mask** is `red`.
- Step 5, **Remove the object**:
  - a **ProPainter Inpainting** node.
  - `IMAGE` of **Load Video (Upload) 🎥🅥🅗🅢** or **VHS_LoadVideoPath** (clip) into `image` of **ProPainter Inpainting** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `MASK` of **Convert Image to Mask** into `mask` of **ProPainter Inpainting**.
  - `width` of **ProPainter Inpainting** is from 64 to 2560; **Do this for me** sets 640.
  - `height` of **ProPainter Inpainting** is from 64 to 2560; **Do this for me** sets 480.
  - `mask_dilates` of **ProPainter Inpainting** is from 0 to 20; **Do this for me** sets 5.
- Step 6, **Save the result**:
  - a **Video Combine 🎥🅥🅗🅢** node.
  - `IMAGE` of **ProPainter Inpainting** into `images` of **Video Combine 🎥🅥🅗🅢**.
  - `frame_rate` of **Video Combine 🎥🅥🅗🅢** is from 1 to 60; **Do this for me** sets 24.

## See also
- [Inpainting and masks](../concepts/Inpainting.md)
- [Node packs](../concepts/Node-Packs.md)
- [How lessons work](How-Lessons-Work.md)
