[Русский](Wrapper-VACE.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# VACE: motion from another video

<!-- lesson: wrapper-vace -->
Lesson "wrapper-vace": a clip on WanVideoWrapper repeats the motion, the depth or the outlines of another video.

## What you will be able to do
Add the VACE module to both Wan models, take a video apart into frames, optionally turn the frames into a depth map, a pose or outlines, and let them guide a new clip.

## What you need
- The graph of [Video on WanVideoWrapper](Wrapper.md).
- VACE module files for Wan 2.2 (one for `high_noise`, one for `low_noise`) in the models folder; the pack's VACE example graph names them.
- A video in ComfyUI's `input` folder that you have the right to use.
- Nodes: WanVideoVACEModelSelect (×2), Load Video, Get Video Components, WanVideoVACEEncode. Optional preprocessors from the **comfyui_controlnet_aux** pack: Depth Anything, OpenPose, DWPose, Canny, Lineart.

## The steps
1. **What VACE is** (reading): a hint from a ready video; the prompt says what, the hint says how it moves.
2. **A WanVideoWrapper graph is needed.**
3. **Add the VACE module to both models**: `extra_model` into each loader; the right module for each model.
4. **Load the hint video**: Load Video and Get Video Components.
5. **Frames, depth, a pose or outlines** (reading): raw frames hold everything; depth holds layout; pose holds a person's moves; outlines hold shapes.
6. **Prepare the hint for the model**: WanVideoVACEEncode with the VAE and `input_frames` (directly or through a preprocessor); `num_frames` 81, `strength` 1.
7. **Give the hint to both samplers**: `vace_embeds` into `image_embeds` of both.
8. **A sample picture** (reading): `ref_images` keeps a look throughout; a plain background works best.
9. **How closely to follow the hint** (reading): `strength`, `vace_start_percent`, `vace_end_percent`.
10. **The graph is ready** (reading): the clip is no longer than the hint video.

## What the lesson checks
Two different VACE modules connected to the two loaders; a video chosen; frames into VACE (a preprocessor or resize node in between is accepted); `num_frames` 49 to 121; `strength` 0.5 to 1.5; the VACE output in both samplers.

## Mistakes people make
- The same module for both models.
- A hint video shorter than `num_frames`.
- A hint too literal (flaws copied): lower `strength` or `vace_end_percent`.

## What next
[Animation by pose: Wan Animate](Wrapper-Animate.md).

## See also
- [Video to video](../concepts/Video-To-Video.md)
- [ControlNet and preprocessors](../concepts/ControlNet.md)
- [Pose animation](../concepts/Pose-Animation.md)
- [Node packs](../concepts/Node-Packs.md)
