[Русский](Video-Interpolate.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Smoother motion: more frames between frames

<!-- lesson: video-interpolate -->
Lesson "video-interpolate", in the group **Video** of the lesson list. Steps: 7.

## What you will be able to do
A finished clip gets twice as many frames and plays smoothly at twice the frame rate.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `model_name` of **Load Frame Interpolation Model**: a file whose name has `film`.
- Nodes: Load Video, Get Video Components, Load Frame Interpolation Model, Frame Interpolate, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What interpolation does** (reading)

   An interpolation model looks at two neighbouring frames and draws the one between them. A 16 fps clip becomes a smooth 32 fps one, and its length in seconds stays the same.

   What it costs: a small model (FILM or RIFE, tens of megabytes) in `models/frame_interpolation`. It runs on any card that runs ComfyUI, and quickly: seconds to minutes. The memory grows with the size and the number of frames.

   These are ComfyUI's own nodes. The ComfyUI-Frame-Interpolation pack does the same with its RIFE VFI and FILM VFI nodes. If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the clip**

   Add **Load Video** and **Get Video Components**. Choose the clip in `file` and connect the output of **Load Video** to the `video` input of **Get Video Components**. Its outputs are the frames, the sound and the frame rate.

3. **Load the interpolation model**

   Add an **Load Frame Interpolation Model** node and choose the model in `model_name`: `film_net` is the template's choice, RIFE files are faster.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "Frame Interpolation: FILM or RIFE" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

4. **Draw the frames between**

   Add a **Frame Interpolate** node. Connect the model to its `interp_model` input and the `images` output of **Get Video Components** to its `images` input. Set `multiplier` to 2.

   2 puts one new frame between each two; 4 puts three. A larger number on fast motion invents more and makes more mistakes.

5. **Save at the new frame rate**

   Add **Create Video** and **Save Video**. The frames of **Frame Interpolate** go into `images`, the `audio` output of **Get Video Components** into `audio`, and the clip into `video` of **Save Video**.

   Set `fps` to the old rate times `multiplier`: for a 16 fps clip and 2, set 32. With the old rate the clip would play twice as slow.

6. **When the result is not right** (reading)

   - Smeared shapes on fast motion: lower `multiplier` to 2 or try another model.
   - The clip is too slow or too fast: `fps` is not the old rate times the multiplier.
   - Interpolation also gives smooth slow motion: keep `fps` as it was, and the clip plays slower and longer.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the clip**:
  - a **Load Video** node.
  - a **Get Video Components** node.
  - `VIDEO` of **Load Video** into `video` of **Get Video Components**.
  - `file` of **Load Video**: a value is chosen.
- Step 3, **Load the interpolation model**:
  - a **Load Frame Interpolation Model** node.
  - `model_name` of **Load Frame Interpolation Model** holds a file whose name has `film` (capitals, dots and dashes do not matter).
- Step 4, **Draw the frames between**:
  - a **Frame Interpolate** node.
  - `INTERP_MODEL` of **Load Frame Interpolation Model** into `interp_model` of **Frame Interpolate**.
  - `images` of **Get Video Components** into `images` of **Frame Interpolate** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `multiplier` of **Frame Interpolate** is from 2 to 4; **Do this for me** sets 2.
- Step 5, **Save at the new frame rate**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **Frame Interpolate** into `images` of **Create Video**.
  - `audio` of **Get Video Components** into `audio` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is from 2 to 120; **Do this for me** sets 32.

## See also
- [Video length and frame rate](../concepts/Video-Length-And-Frame-Rate.md)
- [How lessons work](How-Lessons-Work.md)
