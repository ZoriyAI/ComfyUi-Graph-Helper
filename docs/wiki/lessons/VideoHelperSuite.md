[Русский](VideoHelperSuite.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Load, cut and save video: VideoHelperSuite

<!-- lesson: video-vhs -->
Lesson "video-vhs", in the group **Packs and tools** of the lesson list. Steps: 7.

## What you will be able to do
You load a piece of a video at a chosen frame rate and save it with its sound.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Node packs: **ComfyUI-VideoHelperSuite**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Nodes: Load Video (Upload) 🎥🅥🅗🅢, Video Combine 🎥🅥🅗🅢.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What the pack is for** (reading)

   This lesson needs the ComfyUI-VideoHelperSuite pack. Install it yourself through ComfyUI's manager. A pack runs other people's code on your computer, so take it from its official page and keep it up to date.

   ComfyUI's own Load Video takes a whole video. The pack's loader takes a piece of it: from which frame, how many, at what frame rate and size. Its Video Combine saves frames as mp4, webm or gif, with sound. Many published video graphs use these two nodes.

   No model is needed and nothing heavy runs: the memory is the frames themselves, so a long piece at a large size can still fill it. If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the video**

   Add a **Load Video (Upload) 🎥🅥🅗🅢** node and choose the video in `video`. The list shows the videos of the `input` folder; the node can also upload a new one.

3. **Take the piece you need**

   In **Load Video (Upload) 🎥🅥🅗🅢** set:
   - `force_rate` to 16: the frames are taken as if the video were shot at 16 fps, the rate of the large Wan models;
   - `skip_first_frames` to 16: the first second is skipped;
   - `frame_load_cap` to 81: no more frames than that are taken.

   Frames are counted after the rate is changed. 0 in `force_rate` keeps the video's own rate, 0 in `frame_load_cap` takes everything.

4. **Size and every other frame** (reading)

   - `custom_width` and `custom_height` resize the frames on loading; 0 keeps the size, and one of them alone keeps the proportions.
   - `select_every_nth` takes every second, third… frame: a quick way to a lower frame rate or a shorter piece.

   A video model wants its own size and frame rate; preparing frames here saves a resize node later.

5. **Save it with the sound**

   Add a **Video Combine 🎥🅥🅗🅢** node. Connect the `IMAGE` output of **Load Video (Upload) 🎥🅥🅗🅢** to its `images` input and `audio` to `audio`. Set `frame_rate` to 16, the same as `force_rate`, and `format` to `video/h264-mp4`.

   The sound comes cut to the same piece. With another frame rate the video and its sound part ways.

6. **What else the pack has** (reading)

   - Video Info gives the rate, the length and the size of the video, before and after loading.
   - Load Video (Path) takes a video by its path instead of the `input` folder.
   - Meta Batch Manager splits a long video into parts that fit in memory.
   - Video Combine has `loop_count` and `pingpong` for gifs, and its `crf` (in the mp4 settings) trades size for quality.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the video**:
  - a **Load Video (Upload) 🎥🅥🅗🅢** node.
  - `video` of **Load Video (Upload) 🎥🅥🅗🅢**: a value is chosen.
- Step 3, **Take the piece you need**:
  - `force_rate` of **Load Video (Upload) 🎥🅥🅗🅢** is from 1 to 60; **Do this for me** sets 16.
  - `skip_first_frames` of **Load Video (Upload) 🎥🅥🅗🅢** is from 1 to 100000; **Do this for me** sets 16.
  - `frame_load_cap` of **Load Video (Upload) 🎥🅥🅗🅢** is from 1 to 1000; **Do this for me** sets 81.
- Step 5, **Save it with the sound**:
  - a **Video Combine 🎥🅥🅗🅢** node.
  - `IMAGE` of **Load Video (Upload) 🎥🅥🅗🅢** into `images` of **Video Combine 🎥🅥🅗🅢** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `audio` of **Load Video (Upload) 🎥🅥🅗🅢** into `audio` of **Video Combine 🎥🅥🅗🅢**.
  - `frame_rate` of **Video Combine 🎥🅥🅗🅢** equals `force_rate` of **Load Video (Upload) 🎥🅥🅗🅢**.
  - `format` of **Video Combine 🎥🅥🅗🅢** is `video/h264-mp4`.

## What next
These lessons go on from this one: [A larger, sharper video: SeedVR2](Video-Upscale.md), [Remove an object from a video: ProPainter](Video-Remove.md).

## See also
- [Node packs](../concepts/Node-Packs.md)
- [Video to video](../concepts/Video-To-Video.md)
- [How lessons work](How-Lessons-Work.md)
