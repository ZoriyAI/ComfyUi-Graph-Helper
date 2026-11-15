[Русский](Wrapper-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from a picture on WanVideoWrapper

<!-- lesson: wrapper-image -->
Lesson "wrapper-image", in the group **WanVideoWrapper** of the lesson list. Steps: 8.

## What you will be able to do
A clip made on WanVideoWrapper nodes starts from your picture.

## What you need
- It goes on from [Video on WanVideoWrapper](Wrapper.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - the high_noise half of Wan 2.2 image to video (i2v): `models/diffusion_models`, for example `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors`;
  - the low_noise half of Wan 2.2 image to video (i2v): `models/diffusion_models`, for example `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo VAE Loader, WanVideo Sampler, Load Image, WanVideo ImageToVideo Encode.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What changes** (reading)

   The graph is the one from "Video on WanVideoWrapper". Three things change: the model files, a node with the picture, and a node that puts the picture at the start of the clip in place of the empty blank.

2. **A WanVideoWrapper graph is needed**

   This lesson goes on from the graph of "Video on WanVideoWrapper". The canvas must have two **WanVideo Model Loader** loaders, a **WanVideo VAE Loader** node and two **WanVideo Sampler** samplers, the second taking the result of the first.

   If they are not there, do that lesson first.

3. **Models for a picture**

   In the `model` field of both loaders choose `i2v` files: one with `high_noise` in its name, the other with `low_noise`.

   The `t2v` models do not take a picture. The rest of the graph stays as it is.

4. **Load the picture**

   Add a **Load Image** node and choose your picture in its `image` field. The list shows the files of the `input` folder of your ComfyUI.

5. **Prepare the start**

   Add a **WanVideo ImageToVideo Encode** node and connect to it:
   - to `vae`, the output of **WanVideo VAE Loader**;
   - to `start_image`, the `IMAGE` output of **Load Image**.

   Set `width` to 832, `height` to 480 and `num_frames` to 81. Proportions like those of the picture work best.

6. **Connect the start to the samplers**

   Connect the `image_embeds` output of **WanVideo ImageToVideo Encode** to the `image_embeds` input of both samplers.

   The old links from the empty blank come off by themselves. The empty blank node can be deleted after that.

7. **How to get more motion** (reading)

   If the clip hardly moves, **WanVideo ImageToVideo Encode** has two fields that change that:
   - `noise_aug_strength`: a little noise over the picture, for example 0.02, gives the model freedom to move;
   - `start_latent_strength`: a value below 1, for example 0.8, holds the first frame less.

   Change one field at a time. Values too large take the clip away from the picture.

   The node also has an `end_image` input: a picture for the last frame. It needs models trained for it. The model's page says whether it can.

8. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The prompt of a clip from a picture says what changes, not what is already seen. More on this in "A prompt for video".

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
- Step 3, **Models for a picture**:
  - `model` of **WanVideo Model Loader** (first pass) holds the high_noise half of Wan 2.2 image to video (i2v); such a file lies in `models/diffusion_models`, for example `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors`.
  - `model` of **WanVideo Model Loader** (second pass) holds the low_noise half of Wan 2.2 image to video (i2v); such a file lies in `models/diffusion_models`, for example `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`.
- Step 4, **Load the picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 5, **Prepare the start**:
  - a **WanVideo ImageToVideo Encode** node.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo ImageToVideo Encode**.
  - `IMAGE` of **Load Image** into `start_image` of **WanVideo ImageToVideo Encode**.
  - `num_frames` of **WanVideo ImageToVideo Encode** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
- Step 6, **Connect the start to the samplers**:
  - `image_embeds` of **WanVideo ImageToVideo Encode** into `image_embeds` of **WanVideo Sampler** (first pass).
  - `image_embeds` of **WanVideo ImageToVideo Encode** into `image_embeds` of **WanVideo Sampler** (second pass).

## Mistakes people make
- Leaving one sampler on the empty embeds.
- Raising both motion fields at once: the clip drifts away from the picture.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Lesson: Video from a picture](Video-Image.md)
- [First and last frame](../concepts/First-And-Last-Frame.md)
- [Video models](../concepts/Video-Models.md)
