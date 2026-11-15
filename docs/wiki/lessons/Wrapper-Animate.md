[Русский](Wrapper-Animate.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Animation by pose: Wan Animate

<!-- lesson: wrapper-animate -->
Lesson "wrapper-animate", in the group **WanVideoWrapper** of the lesson list. Steps: 14.

## Consent first
Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
The character from your picture repeats the moves and the face of the person in a video.

## What you need
- Model files the lesson checks:
  - the Wan 2.2 Animate model: `models/diffusion_models`, for example `Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`;
  - clip_vision_h: `models/clip_vision`, for example `clip_vision_h.safetensors`;
  - a ViTPose model: `models/detection`, for example `vitpose-l-wholebody.onnx`;
  - a YOLO model: `models/detection`, for example `yolov10m.onnx`.
- Nodes: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, Load Video, Get Video Components, ONNX Detection Model Loader, Pose and Face Detection, Draw ViT Pose, WanVideo Animate Embeds, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What Wan Animate does** (reading)

   Wan 2.2 Animate takes a picture of a character and a video of a person moving. Special nodes take the pose and the face out of every frame of the video, and the model draws your character in those poses with that face.

   Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law.

   This is a separate model in one file, not a pair of `high` and `low`. The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the Animate model**

   Add a **WanVideo Model Loader** node and choose the Wan 2.2 Animate file in its `model` field.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the Animate example graph from the `example_workflows` folder of the WanVideoWrapper pack: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text reader and the VAE**

   Add **WanVideo T5 Text Encoder Loader** and **WanVideo VAE Loader**. In the `model_name` field of the first choose the `umt5-xxl-enc` file, in the second the `wan_2.1_vae` file. These are the files of "Video on WanVideoWrapper".

4. **Describe the scene briefly**

   Add a **WanVideo TextEncode** node and connect the output of **WanVideo T5 Text Encoder Loader** to its `t5` input. In `positive_prompt` describe the character and the place in a couple of sentences.

   The video sets the motion here, so the prompt is shorter than usual.

5. **Load the picture of the character**

   Add a **Load Image** node and choose the picture of the character in its `image` field. A character seen whole or from the waist up, facing the camera, with no other people near, works best.

6. **Show the picture to the model**

   Add **Load CLIP Vision** and **WanVideo ClipVision Encode**. In the `clip_name` field of the first choose the `clip_vision_h` file. Connect its output to the `clip_vision` input of the second, and the picture to `image_1`.

   This way the model sees what the character looks like, not only reads about it.

7. **Load the video with the motion**

   Add **Load Video** and **Get Video Components**. In the `file` field choose a video of the person whose moves are to be repeated. Connect the output of **Load Video** to the `video` input of **Get Video Components**.

   The model draws 16 frames a second. If the video was shot at another rate, the motion in the clip runs faster or slower.

8. **Take out the pose and the face**

   Add three nodes of the ComfyUI-WanAnimatePreprocess pack: **ONNX Detection Model Loader**, **Pose and Face Detection** and **Draw ViT Pose**.
   - In **ONNX Detection Model Loader** choose the ViTPose pose model in `vitpose_model` and the YOLO person finder in `yolo_model`. Both lie in the `detection` folder.
   - Its `model` output to the `model` input of **Pose and Face Detection**, the frames to `images`.
   - The `pose_data` output of **Pose and Face Detection** to the `pose_data` input of **Draw ViT Pose**: it draws the poses as stick figures.

9. **Build the start of the clip**

   Add an **WanVideo Animate Embeds** node and connect to it:
   - to `vae`, the output of **WanVideo VAE Loader**;
   - to `ref_images`, the picture of the character;
   - to `pose_images`, the output of **Draw ViT Pose**;
   - to `face_images`, the `face_images` output of **Pose and Face Detection**;
   - to `clip_embeds`, the output of **WanVideo ClipVision Encode**.

   Set `num_frames` to 81, and `width` and `height` as in the clip.

10. **Add the sampler**

   Add a **WanVideo Sampler** node. Connect the model to `model`, the prompt to `text_embeds`, and the output of **WanVideo Animate Embeds** to `image_embeds`.

   There is one sampler here: one model, no split into two passes. Take `steps` and `cfg` from the model's page. With a speed-up LoRA `steps` 6 and `cfg` 1 are usual.

11. **Turn the result into frames**

   Add a **WanVideo Decode** node. Connect the sampler's output to its `samples` input and the output of **WanVideo VAE Loader** to its `vae` input.

12. **Save the clip**

   Add **Create Video** and **Save Video**, the frames into `images`, the clip into `video`. Set `fps` to 16.

13. **When the result is not right** (reading)

   What to change in **WanVideo Animate Embeds**:
   - the character repeats the pose too rigidly or breaks: lower `pose_strength` to 0.8;
   - the face is someone else's or frozen: change `face_strength`;
   - the colour changes from piece to piece: set `colormatch` to `mkl`;
   - a clip longer than 77 frames is made in pieces: `frame_window_size` sets their length.

   Keep the proportions of the picture, the clip and the sample video alike.

14. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The first run is long: besides the model itself, the pose models are loaded.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the Animate model**:
  - a **WanVideo Model Loader** node.
  - `model` of **WanVideo Model Loader** holds the Wan 2.2 Animate model; such a file lies in `models/diffusion_models`, for example `Wan2_2-Animate-14B_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 3, **The text reader and the VAE**:
  - a **WanVideo T5 Text Encoder Loader** node.
  - a **WanVideo VAE Loader** node.
  - `model_name` of **WanVideo T5 Text Encoder Loader** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - `model_name` of **WanVideo VAE Loader** holds the Wan 2.1 VAE (wan_2.1_vae); such a file lies in `models/vae`, for example `wan_2.1_vae.safetensors`.
- Step 4, **Describe the scene briefly**:
  - a **WanVideo TextEncode** node.
  - `wan_t5_model` of **WanVideo T5 Text Encoder Loader** into `t5` of **WanVideo TextEncode**.
  - `positive_prompt` of **WanVideo TextEncode** holds at least 3 characters and 2 real words.
- Step 5, **Load the picture of the character**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 6, **Show the picture to the model**:
  - a **Load CLIP Vision** node.
  - a **WanVideo ClipVision Encode** node.
  - `CLIP_VISION` of **Load CLIP Vision** into `clip_vision` of **WanVideo ClipVision Encode**.
  - `IMAGE` of **Load Image** into `image_1` of **WanVideo ClipVision Encode**.
  - `clip_name` of **Load CLIP Vision** holds clip_vision_h; such a file lies in `models/clip_vision`, for example `clip_vision_h.safetensors`.
- Step 7, **Load the video with the motion**:
  - a **Load Video** node.
  - a **Get Video Components** node.
  - `VIDEO` of **Load Video** into `video` of **Get Video Components**.
  - `file` of **Load Video**: a value is chosen.
- Step 8, **Take out the pose and the face**:
  - a **ONNX Detection Model Loader** node.
  - a **Pose and Face Detection** node.
  - a **Draw ViT Pose** node.
  - `model` of **ONNX Detection Model Loader** into `model` of **Pose and Face Detection**.
  - `images` of **Get Video Components** into `images` of **Pose and Face Detection**.
  - `pose_data` of **Pose and Face Detection** into `pose_data` of **Draw ViT Pose**.
  - `vitpose_model` of **ONNX Detection Model Loader** holds a ViTPose model; such a file lies in `models/detection`, for example `vitpose-l-wholebody.onnx`.
  - `yolo_model` of **ONNX Detection Model Loader** holds a YOLO model; such a file lies in `models/detection`, for example `yolov10m.onnx`.
- Step 9, **Build the start of the clip**:
  - a **WanVideo Animate Embeds** node.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Animate Embeds**.
  - `IMAGE` of **Load Image** into `ref_images` of **WanVideo Animate Embeds**.
  - `pose_images` of **Draw ViT Pose** into `pose_images` of **WanVideo Animate Embeds**.
  - `face_images` of **Pose and Face Detection** into `face_images` of **WanVideo Animate Embeds**.
  - `WANVIDIMAGE_CLIPEMBEDS` of **WanVideo ClipVision Encode** into `clip_embeds` of **WanVideo Animate Embeds**.
  - `num_frames` of **WanVideo Animate Embeds** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
- Step 10, **Add the sampler**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** into `model` of **WanVideo Sampler**.
  - `text_embeds` of **WanVideo TextEncode** into `text_embeds` of **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` of **WanVideo Animate Embeds** into `image_embeds` of **WanVideo Sampler**.
- Step 11, **Turn the result into frames**:
  - a **WanVideo Decode** node.
  - `samples` of **WanVideo Sampler** into `samples` of **WanVideo Decode**.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Decode**.
- Step 12, **Save the clip**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **WanVideo Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`. Why: wan draws 16 frames per second. With another number the clip runs faster or slower than it was meant to.

## Mistakes people make
- Different proportions for picture, clip and driving video.
- A driving video at another frame rate: motion too fast or too slow.
- Several people in the driving video: the detector mixes them.

## See also
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
- [Pose animation](../concepts/Pose-Animation.md)
- [Video to video](../concepts/Video-To-Video.md)
