[Русский](Wrapper-ReCam.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Another camera: ReCamMaster

<!-- lesson: wrapper-recam -->
Lesson "wrapper-recam", in the group **WanVideoWrapper** of the lesson list. Steps: 13.

## What you will be able to do
A finished video is drawn again as if the camera had moved another way.

## What you need
- Model files the lesson checks:
  - the ReCamMaster model: `models/diffusion_models`, for example `Wan2_1_kwai_recammaster_1_3B_step20000_bf16.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Video, Get Video Components, WanVideo Encode, WanVideo ReCamMaster Default Camera, WanVideo ReCamMaster Camera Embed, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What ReCamMaster does** (reading)

   ReCamMaster takes a finished video and draws the same scene again with another camera move: an orbit, a zoom or a turn. What happens in the scene stays.

   The model is small, based on Wan 2.1 1.3B. It was trained on clips of 81 frames sized 832 by 480 and works best with them.

   Take a video of your own or one you have the rights to.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add the node **WanVideo Model Loader** and choose in the field `model` the ReCamMaster model.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the ReCamMaster example graph from the `example_workflows` folder of the WanVideoWrapper pack: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text reader and the VAE**

   Add the nodes **WanVideo T5 Text Encoder Loader** and **WanVideo VAE Loader**. In the field `model_name` of the first choose the file `umt5-xxl-enc`, of the second the file `wan_2.1_vae`.

4. **Describe what is in the video**

   Add the node **WanVideo TextEncode** and connect the output of **WanVideo T5 Text Encoder Loader** to its input `t5`. In the field `positive_prompt` say what happens in the video: who, where, doing what.

   The camera needs no words; you set it apart.

5. **Load the video**

   Add the nodes **Load Video** and **Get Video Components**. In the field `file` of the first choose a video from the `input` folder, and connect its output to the input `video` of the second.

6. **Turn the video into its compressed form**

   Add the node **WanVideo Encode**. Connect the output of **WanVideo VAE Loader** to its input `vae`, and the output `images` of **Get Video Components** to the input `image`.

   If the video is longer than 81 frames or of another size, put the nodes `ImageFromBatch` and `ImageScale` between them. The first keeps 81 frames, the second brings the size to 832 by 480.

7. **Choose the camera move**

   Add the node **WanVideo ReCamMaster Default Camera** and connect the output of **WanVideo Encode** to its input `latents`.

   In the field `camera_type` choose the move:
   - `pan_right`, `pan_left`: a turn to the right and to the left;
   - `tilt_up`, `tilt_down`: a tilt up and down;
   - `zoom_in`, `zoom_out`: moving in and out;
   - `translate_up`, `translate_down`: rising and lowering;
   - `arc_left`, `arc_right`: an orbit from the left and from the right.

8. **Join the camera and the video**

   Add the node **WanVideo ReCamMaster Camera Embed**. Connect the output of **WanVideo ReCamMaster Default Camera** to its input `camera_poses`, and the output of **WanVideo Encode** to the input `latents`.

   The video comes here a second time: the model draws the scene from it and turns it along the camera's path.

9. **Add the sampler**

   Add the node **WanVideo Sampler** and connect to it:
   - the model to the input `model`;
   - the prompt to the input `text_embeds`;
   - the output `camera_embeds` of **WanVideo ReCamMaster Camera Embed** to the input `image_embeds`.

   Set `steps` to 20.

10. **Turn the result into frames**

   Add the node **WanVideo Decode**. Connect the output of the sampler to its input `samples`, and the output of **WanVideo VAE Loader** to the input `vae`.

11. **Assemble the clip**

   Add the nodes **Create Video** and **Save Video**: the frames into `images`, the clip into `video`. Set the field `fps` to 16.

12. **If the scene changed** (reading)

   What to check:
   - the clip shows another scene: the prompt does not fit the video. Describe what is really in it;
   - the picture is blurry: the video is of the wrong size. Bring it to 832 by 480;
   - an orbit by a set angle is needed: the pack has a separate node for it, WanVideo ReCamMaster Generate Orbit Camera. It stands in place of **WanVideo ReCamMaster Default Camera**.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   One run is one camera move. To compare two moves, run the graph twice.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **WanVideo Model Loader** node.
  - `model` of **WanVideo Model Loader** holds the ReCamMaster model; such a file lies in `models/diffusion_models`, for example `Wan2_1_kwai_recammaster_1_3B_step20000_bf16.safetensors`.
- Step 3, **The text reader and the VAE**:
  - a **WanVideo T5 Text Encoder Loader** node.
  - a **WanVideo VAE Loader** node.
  - `model_name` of **WanVideo T5 Text Encoder Loader** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - `model_name` of **WanVideo VAE Loader** holds the Wan 2.1 VAE (wan_2.1_vae); such a file lies in `models/vae`, for example `wan_2.1_vae.safetensors`.
- Step 4, **Describe what is in the video**:
  - a **WanVideo TextEncode** node.
  - `wan_t5_model` of **WanVideo T5 Text Encoder Loader** into `t5` of **WanVideo TextEncode**.
  - `positive_prompt` of **WanVideo TextEncode** holds at least 3 characters and 2 real words.
- Step 5, **Load the video**:
  - a **Load Video** node.
  - a **Get Video Components** node.
  - `VIDEO` of **Load Video** into `video` of **Get Video Components**.
  - `file` of **Load Video**: a value is chosen.
- Step 6, **Turn the video into its compressed form**:
  - a **WanVideo Encode** node.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Encode**.
  - `images` of **Get Video Components** into `image` of **WanVideo Encode** (a Upscale Image or Resize Image or ImageResizeKJv2 or ImageFromBatch or GetImageRangeFromBatch in between is accepted).
- Step 7, **Choose the camera move**:
  - a **WanVideo ReCamMaster Default Camera** node.
  - `samples` of **WanVideo Encode** into `latents` of **WanVideo ReCamMaster Default Camera**.
- Step 8, **Join the camera and the video**:
  - a **WanVideo ReCamMaster Camera Embed** node.
  - `camera_poses` of **WanVideo ReCamMaster Default Camera** into `camera_poses` of **WanVideo ReCamMaster Camera Embed**.
  - `samples` of **WanVideo Encode** into `latents` of **WanVideo ReCamMaster Camera Embed**.
- Step 9, **Add the sampler**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** into `model` of **WanVideo Sampler**.
  - `text_embeds` of **WanVideo TextEncode** into `text_embeds` of **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` of **WanVideo ReCamMaster Camera Embed** into `image_embeds` of **WanVideo Sampler**.
  - `steps` of **WanVideo Sampler** is from 20 to 30; **Do this for me** sets 20. Why: reCamMaster was trained with twenty steps.
- Step 10, **Turn the result into frames**:
  - a **WanVideo Decode** node.
  - `samples` of **WanVideo Sampler** into `samples` of **WanVideo Decode**.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Decode**.
- Step 11, **Assemble the clip**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **WanVideo Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`. Why: wan draws 16 frames per second. With another number the clip runs faster or slower than it was meant to.

## Mistakes people make
- A prompt that does not match the video: another scene appears.
- A video of another size: a blurry result.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Video to video](../concepts/Video-To-Video.md)
- [Video models](../concepts/Video-Models.md)
- [Content rules](../trust/Content-Rules.md)
