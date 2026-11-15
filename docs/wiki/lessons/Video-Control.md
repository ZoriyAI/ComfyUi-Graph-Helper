[Русский](Video-Control.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video guided by another video: Wan 2.2 Fun Control

<!-- lesson: video-control -->
Lesson "video-control", in the group **Video** of the lesson list. Steps: 16.

## Consent first
Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Your image comes to life with the motion of another video: its depth, its pose or its edges.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `fun` and `control` and `5b`;
  - for `clip_name` of **Load CLIP**: a file whose name has `umt5`;
  - for `vae_name` of **Load VAE**: a file whose name has `wan2.2_vae`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Load Video, Get Video Components, Load Image, Wan22FunControlToVideo, KSampler, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Before you start** (reading)

   Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. Exclude anyone under 18 or who appears underage; label synthetic depictions so they do not mislead others. The lessons teach technique in factual, non-graphic terms.

   The model takes two things: a reference image that says what is drawn, and a control video that says how it moves. A control video is a depth map, a skeleton of a pose, or the edges of the frames of an ordinary video.

   What it costs: the Fun Control 5B model, about 10 GB in `models/diffusion_models`, with the `umt5_xxl` text encoder and `wan2.2_vae`. A card with 8 GB can run it with ComfyUI moving parts to system memory; a five-second clip takes minutes.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the Fun Control model**

   Add a **Load Diffusion Model** node and choose the `wan2.2_fun_control_5B` file in `unet_name`.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "Wan 2.2 5B Fun Control" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the text encoder**

   Add a **Load CLIP** node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.

   The text encoder turns the prompt into what the model reads. The `fp8` version of the file takes half the memory of the full one and is what the templates use.

4. **Load the VAE**

   Add a **Load VAE** node and choose `wan2.2_vae` in `vae_name`: the 5B models have their own VAE.

5. **Write the prompt**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load CLIP** to the `clip` input of each. In the `text` field of one, describe the clip: who or what is in the frame, what happens, how the camera moves. The other is the negative prompt: what must not be there.

   For video the action matters most. "A cat jumps onto a windowsill, the camera follows" works better than "a cat on a windowsill".

6. **Set the shift**

   Add a **ModelSamplingSD3** node and connect the `MODEL` output of the loader to its `model` input. Set `shift` to 8.

   Shift decides how much of the work goes to the early, noisy steps where the composition and the motion are laid out. With a small value Wan keeps the composition and the motion worse and the clip comes out sluggish.

   The SD3 in the node's name is left from another model: Wan uses the same node.

7. **Load the control video**

   Add **Load Video** and **Get Video Components**. In `file` choose the video, and connect the output of **Load Video** to the `video` input of **Get Video Components**: it gives the frames, the sound and the frame rate separately.

   The video must lie in the `input` folder of ComfyUI.

8. **What makes a control video** (reading)

   - A video that is already a control (a depth map, a skeleton, edges): its frames go in as they are, as in the template.
   - An ordinary video: put a node between it and the model that makes a control of each frame. ComfyUI's own Canny draws edges; the comfyui_controlnet_aux pack draws depth (Depth Anything) and poses (DWPose, OpenPose).
   - Edges keep shapes most strictly, depth keeps the space, a pose moves only the body.

   The app accepts such a node on the way from **Get Video Components** to the model.

9. **Load the reference image**

   Add a **Load Image** node and choose in `image` the picture of what must move: a character, an object. It should have the proportions of the control video.

10. **Bring it together**

   Add a **Wan22FunControlToVideo** node and connect to it:
   - to `positive` and `negative`, the two prompts;
   - to `vae`, the output of **Load VAE**;
   - to `ref_image`, the reference image;
   - to `control_video`, the `images` output of **Get Video Components** (or of the node that makes the control).

   Set `width` and `height` to 704 and `length` to 121. The control video must have at least as many frames.

11. **Add the sampler**

   Add a **KSampler** node. Its `model` input takes the output of **ModelSamplingSD3**; `positive`, `negative` and `latent_image` take the three outputs of **Wan22FunControlToVideo**.

12. **Set up the sampler**

   In **KSampler** set `steps` to 20, `cfg` to 5 and `sampler_name` to `uni_pc`, as in the template.

13. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the sampler's output to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the clip in compressed form, the latent. This node unfolds it into frames.

14. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 24.

   The 5B model draws 24 fps. With another number the clip runs faster or slower than it was meant to.

15. **When the result is not right** (reading)

   - The motion is right but the character changes: the reference image and the control video differ too much in proportions or pose; bring them closer.
   - The clip copies the control too literally (edges of the original show): use depth or a pose instead of edges.
   - The motion is too fast or too slow: the control video was not at 24 fps. Load it at 24 fps (the VideoHelperSuite lesson shows how).

16. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the Fun Control model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `fun` and `control` and `5b` (capitals, dots and dashes do not matter).
- Step 3, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `umt5` (capitals, dots and dashes do not matter).
  - `type` of **Load CLIP** is `wan`.
- Step 4, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds a file whose name has `wan2.2_vae` (capitals, dots and dashes do not matter).
- Step 5, **Write the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters.
- Step 6, **Set the shift**:
  - a **ModelSamplingSD3** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **ModelSamplingSD3** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `shift` of **ModelSamplingSD3** is from 5 to 8; **Do this for me** sets 8.
- Step 7, **Load the control video**:
  - a **Load Video** node.
  - a **Get Video Components** node.
  - `VIDEO` of **Load Video** into `video` of **Get Video Components**.
  - `file` of **Load Video**: a value is chosen.
- Step 9, **Load the reference image**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 10, **Bring it together**:
  - a **Wan22FunControlToVideo** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **Wan22FunControlToVideo**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **Wan22FunControlToVideo**.
  - `VAE` of **Load VAE** into `vae` of **Wan22FunControlToVideo**.
  - `IMAGE` of **Load Image** into `ref_image` of **Wan22FunControlToVideo** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `images` of **Get Video Components** into `control_video` of **Wan22FunControlToVideo** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode or Detect Edges (Canny) or Canny Edge or Depth Anything V2 - Relative or DWPreprocessor or OpenPose Pose or LineArtPreprocessor in between is accepted).
  - `width` of **Wan22FunControlToVideo** is from 480 to 1280; **Do this for me** sets 704.
  - `height` of **Wan22FunControlToVideo** is from 480 to 1280; **Do this for me** sets 704.
  - `length` of **Wan22FunControlToVideo** is from 49 to 121; **Do this for me** sets 121.
- Step 11, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingSD3** into `model` of **KSampler** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **Wan22FunControlToVideo** into `positive` of **KSampler**.
  - `negative` of **Wan22FunControlToVideo** into `negative` of **KSampler**.
  - `latent` of **Wan22FunControlToVideo** into `latent_image` of **KSampler**.
- Step 12, **Set up the sampler**:
  - `steps` of **KSampler** is from 10 to 30; **Do this for me** sets 20.
  - `cfg` of **KSampler** is from 4 to 6; **Do this for me** sets 5.
  - `sampler_name` of **KSampler** is `uni_pc`.
- Step 13, **Turn the result into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode** or **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)**.
- Step 14, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `24`.

## See also
- [Video to video](../concepts/Video-To-Video.md)
- [Animation by pose](../concepts/Pose-Animation.md)
- [ControlNet and preprocessors](../concepts/ControlNet.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
