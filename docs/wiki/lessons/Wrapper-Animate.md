[Русский](Wrapper-Animate.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Animation by pose: Wan Animate

<!-- lesson: wrapper-animate -->
Lesson "wrapper-animate": the character from your picture repeats the moves and the face of the person in a video.

## Consent first
Only someone who agrees may be animated: yourself, a made-up character, or a person who gave permission. The app does not help with someone else's face without consent. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Build a one-model Wan 2.2 Animate graph: show the character to the model, take pose and face out of a driving video, and combine them in one sampler.

## What you need
- Packs: **ComfyUI-WanVideoWrapper** and **ComfyUI-WanAnimatePreprocess**.
- Files: the Wan 2.2 Animate model (one file), `umt5-xxl-enc`, `wan_2.1_vae`, `clip_vision_h`, and the ViTPose and YOLO detection models in the `detection` folder. The pack's Animate example graph names them.
- A picture of the character and a driving video in `input`.
- An empty canvas.

## The steps
1. **What Wan Animate does** (reading), with the consent rule.
2. **Load the Animate model.**
3. **The text reader and the VAE.**
4. **Describe the scene briefly**: the video sets the motion.
5. **Load the picture of the character**: whole or from the waist up, facing the camera, alone.
6. **Show the picture to the model**: Load CLIP Vision (`clip_vision_h`) and WanVideo ClipVision Encode.
7. **Load the video with the motion**: Load Video and Get Video Components; the model draws 16 frames a second.
8. **Take out the pose and the face**: the detection model loader, Pose and Face Detection, Draw ViT Pose.
9. **Build the start of the clip**: WanVideo Animate Embeds with the VAE, the picture, the pose images, the face images and the CLIP Vision embeds; `num_frames` 81.
10. **Add the sampler**: one sampler; `steps` and `cfg` from the model page (with a speed-up LoRA, about 6 and 1).
11. and 12. **Decode and save**: `fps` 16.
13. **When the result is not right** (reading): `pose_strength`, `face_strength`, `colormatch`, `frame_window_size`.
14. **The graph is ready** (reading).

## What the lesson checks
The model, text encoder, VAE, CLIP Vision and both detection files chosen (the two detection fields hold different files); the picture and the video chosen; every link listed; `num_frames` 49 to 121; `fps` 16.

## Mistakes people make
- Different proportions for picture, clip and driving video.
- A driving video at another frame rate: motion too fast or too slow.
- Several people in the driving video: the detector mixes them.

## What next
[Animation by pose: UniAnimate](Wrapper-UniAnimate.md) for a lighter way without the face.

## See also
- [Pose animation](../concepts/Pose-Animation.md)
- [Video to video](../concepts/Video-To-Video.md)
- [Content rules](../trust/Content-Rules.md)
