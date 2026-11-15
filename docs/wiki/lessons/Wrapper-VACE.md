[Русский](Wrapper-VACE.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# VACE: motion from another video

<!-- lesson: wrapper-vace -->
Lesson "wrapper-vace", in the group **WanVideoWrapper** of the lesson list. Steps: 10.

## What you will be able to do
A clip on WanVideoWrapper repeats the motion, the depth or the outlines of another video.

## What you need
- It goes on from [Video on WanVideoWrapper](Wrapper.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - the VACE module for the high_noise model: `models/diffusion_models`, for example `Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors`;
  - the VACE module for the low_noise model: `models/diffusion_models`, for example `Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo VAE Loader, WanVideo Sampler, WanVideo VACE Module Select, Load Video, Get Video Components, WanVideo VACE Encode.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What VACE is** (reading)

   VACE is a module that teaches Wan to take a hint from a ready video. The hint can be the video itself, a depth map, a person's pose or outlines made from its frames. The prompt says what to draw, and the hint says how it moves and where it stands.

   This is how a dancer's motion is moved onto another character, how a clip changes style while keeping its motion, or how a camera move is set by example.

   The lesson goes on from the graph of "Video on WanVideoWrapper".

2. **A WanVideoWrapper graph is needed**

   The canvas must have two **WanVideo Model Loader** loaders, a **WanVideo VAE Loader** node and two **WanVideo Sampler** samplers, the second taking the result of the first. This is the graph of "Video on WanVideoWrapper".

   If it is not there, do that lesson first.

3. **Add the VACE module to both models**

   Add two **WanVideo VACE Module Select** nodes. In the `vace_model` field of one choose the VACE module for the `high_noise` model, in the other the one for `low_noise`. Connect the `extra_model` output of each to the `extra_model` input of its model loader.

   A module is made for its own model: Wan 2.2 has two of them, Wan 2.1 one. It lies in the same folder as the models.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the VACE example graph from the pack's `example_workflows` folder: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

4. **Load the hint video**

   Add **Load Video** and **Get Video Components**. In the `file` field choose the video whose motion is to be repeated. Connect the output of **Load Video** to the `video` input of **Get Video Components**: it takes the video apart into frames.

   The list shows the videos of the `input` folder of your ComfyUI.

5. **Frames, depth, a pose or outlines** (reading)

   The frames can go to VACE as they are: then the model holds on to everything at once, shape, colour and motion. More often one hint is made from the frames first:
   - a depth map holds the layout and the motion and leaves the looks to the prompt;
   - a pose holds a person's motion and not their clothes or face;
   - outlines hold the shape of things.

   Such nodes are in the comfyui_controlnet_aux pack: Depth Anything, OpenPose, DWPose, Canny, Lineart. They stand between **Get Video Components** and VACE: the frames into their input, their output on. The lesson counts a direct link and a link through them alike.

6. **Prepare the hint for the model**

   Add a **WanVideo VACE Encode** node. Connect the output of **WanVideo VAE Loader** to its `vae` input, and to `input_frames` the frames from **Get Video Components** or from the node that made a hint of them.

   Set `num_frames` to 81, and `width` and `height` as in the clip. The `strength` field is the strength of the hint: start at 1.

7. **Give the hint to both samplers**

   Connect the `vace_embeds` output of **WanVideo VACE Encode** to the `image_embeds` input of both samplers.

   The old links from the empty blank come off by themselves. The empty blank node can be deleted after that: the VACE node now sets the size and the length.

8. **A sample picture** (reading)

   The **WanVideo VACE Encode** node has a `ref_images` input: a picture of who or what must be in the clip. Connect a node with a picture to it, and the model keeps that look the whole time.

   A picture on a plain background, with nothing else in it, works best.

9. **How closely to follow the hint** (reading)

   Three fields of **WanVideo VACE Encode** decide how strongly the hint holds the clip:
   - `strength`: below 1 gives the model more freedom, above 1 holds it more strictly;
   - `vace_start_percent` and `vace_end_percent`: for which share of the steps the hint acts. Set `vace_end_percent` to 0.5 and the hint sets the start, while the model finishes the detail itself.

   If the clip repeats the hint too literally, flaws and all, lower `strength` or `vace_end_percent`.

10. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The clip is no longer than the hint video. If the video is shorter, lower `num_frames`.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A WanVideoWrapper graph is needed**:
  - a **WanVideo Model Loader** node.
  - a **WanVideo Model Loader** node.
  - a **WanVideo VAE Loader** node.
  - a **WanVideo Sampler** node.
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** (first pass) into `model` of **WanVideo Sampler** (first pass).
  - `model` of **WanVideo Model Loader** (second pass) into `model` of **WanVideo Sampler** (second pass).
  - `samples` of **WanVideo Sampler** (first pass) into `samples` of **WanVideo Sampler** (second pass).
- Step 3, **Add the VACE module to both models**:
  - a **WanVideo VACE Module Select** node.
  - a **WanVideo VACE Module Select** node.
  - `extra_model` of **WanVideo VACE Module Select** (VACE for the first pass) into `extra_model` of **WanVideo Model Loader** (first pass).
  - `extra_model` of **WanVideo VACE Module Select** (VACE for the second pass) into `extra_model` of **WanVideo Model Loader** (second pass).
  - `vace_model` of **WanVideo VACE Module Select** (VACE for the first pass) holds the VACE module for the high_noise model; such a file lies in `models/diffusion_models`, for example `Wan2_2_Fun_VACE_module_A14B_HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `vace_model` of **WanVideo VACE Module Select** (VACE for the second pass) is not the same file as `vace_model` of **WanVideo VACE Module Select** (VACE for the first pass).
  - `vace_model` of **WanVideo VACE Module Select** (VACE for the second pass) holds the VACE module for the low_noise model; such a file lies in `models/diffusion_models`, for example `Wan2_2_Fun_VACE_module_A14B_LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 4, **Load the hint video**:
  - a **Load Video** node.
  - a **Get Video Components** node.
  - `VIDEO` of **Load Video** into `video` of **Get Video Components**.
  - `file` of **Load Video**: a value is chosen.
- Step 6, **Prepare the hint for the model**:
  - a **WanVideo VACE Encode** node.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo VACE Encode**.
  - `images` of **Get Video Components** into `input_frames` of **WanVideo VACE Encode** (a Depth Anything V2 - Relative or DepthAnythingPreprocessor or MiDaS-DepthMapPreprocessor or OpenPose Pose or DWPreprocessor or Canny Edge or LineArtPreprocessor or AnyLineArtPreprocessor_aux or Upscale Image or Resize Image in between is accepted).
  - `num_frames` of **WanVideo VACE Encode** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
  - `strength` of **WanVideo VACE Encode** is from 0.5 to 1.5; **Do this for me** sets 1. Why: the strength of the guide: at 1 the model follows it the usual way, a good place to start tuning.
- Step 7, **Give the hint to both samplers**:
  - `WANVIDIMAGE_EMBEDS` of **WanVideo VACE Encode** into `image_embeds` of **WanVideo Sampler** (first pass).
  - `WANVIDIMAGE_EMBEDS` of **WanVideo VACE Encode** into `image_embeds` of **WanVideo Sampler** (second pass).

## Mistakes people make
- The same module for both models.
- A hint video shorter than `num_frames`.
- A hint too literal (flaws copied): lower `strength` or `vace_end_percent`.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Video to video](../concepts/Video-To-Video.md)
- [ControlNet and preprocessors](../concepts/ControlNet.md)
- [Pose animation](../concepts/Pose-Animation.md)
- [Node packs](../concepts/Node-Packs.md)
