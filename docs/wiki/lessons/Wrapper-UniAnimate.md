[Русский](Wrapper-UniAnimate.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Animation by pose: UniAnimate

<!-- lesson: wrapper-unianimate -->
Lesson "wrapper-unianimate": the character from a picture repeats the moves of a person in a video, with a Wan 2.1 model and one LoRA.

## Consent first
Only someone who agrees may be animated: yourself, a made-up character, or a person who gave permission. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Build a Wan 2.1 image to video graph that obeys a skeleton: the pose comes from every frame of a video, the look from your picture. Unlike Wan Animate it carries the body, not the face, and needs no separate model.

## What you need
- The **ComfyUI-WanVideoWrapper** pack.
- Files: a Wan 2.1 `i2v` 14B model (480p or 720p), `umt5-xxl-enc`, `wan_2.1_vae`, `clip_vision_h`, and the UniAnimate LoRA for Wan 2.1 14B. The pack's pose detector downloads two small pose models by itself the first time the graph runs in ComfyUI; this app downloads nothing.
- A picture of the character and a video of one person moving, in `input`.

## The steps
1. **What UniAnimate does** (reading).
2. to 6. **Model, text reader and VAE, prompt, picture, CLIP Vision**: as in the other one-model lessons. Pick a full-height picture in a pose close to the video's first pose.
7. **Add the UniAnimate LoRA**: WanVideo Lora Select into the loader's `lora` input; without it the skeleton cannot be connected.
8. **Load the video with the movement.**
9. **Take the pose out**: the UniAnimate DWPose detector with the video frames in `pose_images` and the character picture in `reference_pose_image`.
10. **Hand the skeleton to the model**: the UniAnimate pose input node, `strength` 1.
11. **Prepare the start**: WanVideoImageToVideoEncode with the VAE, the picture and the CLIP Vision embeds; `num_frames` 81.
12. **Add the sampler**: with `unianimate_poses`.
13. and 14. **Decode and save**: `fps` 16.
15. **If the character moves wrong** (reading): sizes, length, `score_threshold`, the reference pose.
16. **The graph is ready** (reading).

## What the lesson checks
All files and the picture and video chosen; the LoRA connected to the loader; the detector, pose node, start node and sampler linked as above (a resize or batch-cut node between the frames and the detector is accepted); pose `strength` 0.5 to 1; `num_frames` 49 to 121; `fps` 16.

## Mistakes people make
- Video frames of another size than the clip: add a resize node with the same width and height.
- The character picture not connected to `reference_pose_image`: the character takes the build of the person in the video.

## What next
[A talking video: InfiniteTalk](Wrapper-Talk.md).

## See also
- [Pose animation](../concepts/Pose-Animation.md)
- [Lesson: Animation by pose: Wan Animate](Wrapper-Animate.md)
- [LoRA](../concepts/LoRA.md)
