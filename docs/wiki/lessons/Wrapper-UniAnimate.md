[Русский](Wrapper-UniAnimate.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Animation by pose: UniAnimate

<!-- lesson: wrapper-unianimate -->
Lesson "wrapper-unianimate", in the group **WanVideoWrapper** of the lesson list. Steps: 16.

## Consent first
Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
The character from a picture repeats the moves of a person in a video. A Wan 2.1 model and one LoRA are enough.

## What you need
- Model files the lesson checks:
  - Wan 2.1 image to video (i2v) 14B: `models/diffusion_models`, for example `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`;
  - clip_vision_h: `models/clip_vision`, for example `clip_vision_h.safetensors`;
  - the UniAnimate LoRA: `models/loras`, for example `UniAnimate-Wan2.1-14B-Lora-12000-fp16.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, WanVideo Lora Select, Load Video, Get Video Components, WanVideo UniAnimate DWPose Detector, WanVideo UniAnimate Pose Input, WanVideo ImageToVideo Encode, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What UniAnimate does** (reading)

   UniAnimate is a LoRA for the Wan 2.1 "image to video" model. With it the model obeys a skeleton: the pose is taken out of every frame of a video of a person moving, and the character from your picture repeats those moves.

   Unlike Wan Animate it does not carry the face over, only the body. In return no separate model is needed.

   Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add the node **WanVideo Model Loader** and choose in the field `model` a Wan 2.1 `i2v` 14B model, the 480p or the 720p one.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, any Wan 2.1 I2V example graph from the `example_workflows` folder of the WanVideoWrapper pack: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text reader and the VAE**

   Add the nodes **WanVideo T5 Text Encoder Loader** and **WanVideo VAE Loader**. In the field `model_name` of the first choose the file `umt5-xxl-enc`, of the second the file `wan_2.1_vae`.

4. **Describe the character and the place**

   Add the node **WanVideo TextEncode** and connect the output of **WanVideo T5 Text Encoder Loader** to its input `t5`. In the field `positive_prompt` say who is in the frame, what they wear and where they are.

   The movement needs no words: the video sets it.

5. **Load the character**

   Add the node **Load Image** and choose in the field `image` the picture of the character. Full height works best, in a pose close to the first pose of the video.

6. **Show the picture to the model**

   Add the nodes **Load CLIP Vision** and **WanVideo ClipVision Encode**. In the field `clip_name` of the first choose the file `clip_vision_h`. Connect its output to the input `clip_vision` of the second, and the picture to the input `image_1`.

   The Wan 2.1 "image to video" models cannot do without it.

7. **Add the UniAnimate LoRA**

   Add the node **WanVideo Lora Select** and choose in the field `lora` the UniAnimate file for Wan 2.1 14B. Connect its output to the input `lora` of the model loader.

   Without this LoRA a skeleton cannot be connected: the run stops with an error.

8. **Load the video with the movement**

   Add the nodes **Load Video** and **Get Video Components**. In the field `file` of the first choose a video from the `input` folder, and connect its output to the input `video` of the second.

   Take a video where the person is alone in the frame and seen whole.

9. **Take the pose out**

   Add the node **WanVideo UniAnimate DWPose Detector**. Connect the output `images` of **Get Video Components** to its input `pose_images`, and the picture of the character to the input `reference_pose_image`.

   The node draws a skeleton for every frame and, apart from them, the skeleton of the character in the picture. From the second the model learns how the build of the character differs from the person in the video.

   This node downloads two small pose models itself when the graph is first run in ComfyUI. This app downloads nothing.

10. **Hand the skeleton to the model**

   Add the node **WanVideo UniAnimate Pose Input**. Connect the output `poses` of **WanVideo UniAnimate DWPose Detector** to the input `pose_images`, and the output `reference_pose` to the input `reference_pose_image`.

   Leave the field `strength` at 1: it is how firmly the skeleton leads the character.

11. **Prepare the start**

   Add the node **WanVideo ImageToVideo Encode**. Connect the output of **WanVideo VAE Loader** to its input `vae`, the picture to the input `start_image`, and the output of **WanVideo ClipVision Encode** to the input `clip_embeds`.

   Leave the field `num_frames` at 81, which is five seconds. The fields `width` and `height` set the size of the clip.

12. **Add the sampler**

   Add the node **WanVideo Sampler** and connect to it:
   - the model to the input `model`;
   - the prompt to the input `text_embeds`;
   - the output of **WanVideo ImageToVideo Encode** to the input `image_embeds`;
   - the output of **WanVideo UniAnimate Pose Input** to the input `unianimate_poses`.

13. **Turn the result into frames**

   Add the node **WanVideo Decode**. Connect the output of the sampler to its input `samples`, and the output of **WanVideo VAE Loader** to the input `vae`.

14. **Assemble the clip**

   Add the nodes **Create Video** and **Save Video**: the frames into `images`, the clip into `video`. Set the field `fps` to 16.

15. **If the character moves wrong** (reading)

   What to check:
   - the frames of the video are of another size than the clip: put a resize node between **Get Video Components** and **WanVideo UniAnimate DWPose Detector** and set the same `width` and `height` as in **WanVideo ImageToVideo Encode**;
   - the video is longer than the clip: the poses left over are dropped. If it is shorter, lower `num_frames`;
   - the skeleton vanishes or shows where it should not: change `score_threshold` in **WanVideo UniAnimate DWPose Detector**;
   - the character changes build: check that the picture of the character is connected to the input `reference_pose_image`.

16. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The first run takes longer than usual: the node **WanVideo UniAnimate DWPose Detector** downloads its models.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **WanVideo Model Loader** node.
  - `model` of **WanVideo Model Loader** holds Wan 2.1 image to video (i2v) 14B; such a file lies in `models/diffusion_models`, for example `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`.
- Step 3, **The text reader and the VAE**:
  - a **WanVideo T5 Text Encoder Loader** node.
  - a **WanVideo VAE Loader** node.
  - `model_name` of **WanVideo T5 Text Encoder Loader** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - `model_name` of **WanVideo VAE Loader** holds the Wan 2.1 VAE (wan_2.1_vae); such a file lies in `models/vae`, for example `wan_2.1_vae.safetensors`.
- Step 4, **Describe the character and the place**:
  - a **WanVideo TextEncode** node.
  - `wan_t5_model` of **WanVideo T5 Text Encoder Loader** into `t5` of **WanVideo TextEncode**.
  - `positive_prompt` of **WanVideo TextEncode** holds at least 3 characters and 2 real words.
- Step 5, **Load the character**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 6, **Show the picture to the model**:
  - a **Load CLIP Vision** node.
  - a **WanVideo ClipVision Encode** node.
  - `CLIP_VISION` of **Load CLIP Vision** into `clip_vision` of **WanVideo ClipVision Encode**.
  - `IMAGE` of **Load Image** into `image_1` of **WanVideo ClipVision Encode**.
  - `clip_name` of **Load CLIP Vision** holds clip_vision_h; such a file lies in `models/clip_vision`, for example `clip_vision_h.safetensors`.
- Step 7, **Add the UniAnimate LoRA**:
  - a **WanVideo Lora Select** node.
  - `lora` of **WanVideo Lora Select** into `lora` of **WanVideo Model Loader**.
  - `lora` of **WanVideo Lora Select** holds the UniAnimate LoRA; such a file lies in `models/loras`, for example `UniAnimate-Wan2.1-14B-Lora-12000-fp16.safetensors`.
- Step 8, **Load the video with the movement**:
  - a **Load Video** node.
  - a **Get Video Components** node.
  - `VIDEO` of **Load Video** into `video` of **Get Video Components**.
  - `file` of **Load Video**: a value is chosen.
- Step 9, **Take the pose out**:
  - a **WanVideo UniAnimate DWPose Detector** node.
  - `images` of **Get Video Components** into `pose_images` of **WanVideo UniAnimate DWPose Detector** (a Upscale Image or Resize Image or ImageResizeKJv2 or ImageFromBatch or GetImageRangeFromBatch in between is accepted).
  - `IMAGE` of **Load Image** into `reference_pose_image` of **WanVideo UniAnimate DWPose Detector** (a Upscale Image or Resize Image or ImageResizeKJv2 or ImageFromBatch or GetImageRangeFromBatch in between is accepted).
- Step 10, **Hand the skeleton to the model**:
  - a **WanVideo UniAnimate Pose Input** node.
  - `poses` of **WanVideo UniAnimate DWPose Detector** into `pose_images` of **WanVideo UniAnimate Pose Input**.
  - `reference_pose` of **WanVideo UniAnimate DWPose Detector** into `reference_pose_image` of **WanVideo UniAnimate Pose Input**.
  - `strength` of **WanVideo UniAnimate Pose Input** is from 0.5 to 1; **Do this for me** sets 1. Why: this is how strongly the skeleton leads the character. At 1 the character follows the poses fully.
- Step 11, **Prepare the start**:
  - a **WanVideo ImageToVideo Encode** node.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo ImageToVideo Encode**.
  - `IMAGE` of **Load Image** into `start_image` of **WanVideo ImageToVideo Encode**.
  - `WANVIDIMAGE_CLIPEMBEDS` of **WanVideo ClipVision Encode** into `clip_embeds` of **WanVideo ImageToVideo Encode**.
  - `num_frames` of **WanVideo ImageToVideo Encode** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
- Step 12, **Add the sampler**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** into `model` of **WanVideo Sampler**.
  - `text_embeds` of **WanVideo TextEncode** into `text_embeds` of **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` of **WanVideo ImageToVideo Encode** into `image_embeds` of **WanVideo Sampler**.
  - `unianimate_poses` of **WanVideo UniAnimate Pose Input** into `unianimate_poses` of **WanVideo Sampler**.
- Step 13, **Turn the result into frames**:
  - a **WanVideo Decode** node.
  - `samples` of **WanVideo Sampler** into `samples` of **WanVideo Decode**.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Decode**.
- Step 14, **Assemble the clip**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **WanVideo Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`. Why: wan draws 16 frames per second. With another number the clip runs faster or slower than it was meant to.

## Mistakes people make
- Video frames of another size than the clip: add a resize node with the same width and height.
- The character picture not connected to `reference_pose_image`: the character takes the build of the person in the video.

## See also
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
- [Pose animation](../concepts/Pose-Animation.md)
- [Lesson: Animation by pose: Wan Animate](Wrapper-Animate.md)
- [LoRA](../concepts/LoRA.md)
