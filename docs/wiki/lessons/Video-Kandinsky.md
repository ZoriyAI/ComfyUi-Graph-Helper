[Русский](Video-Kandinsky.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from text: Kandinsky 5 Lite

<!-- lesson: video-kandinsky -->
Lesson "video-kandinsky", in the group **Video** of the lesson list. Steps: 12.

## What you will be able to do
You build a light one-model graph that makes a five-second clip from a prompt.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `kandinsky5` and `t2v`;
  - for `clip_name1` of **DualCLIPLoader**: a file whose name has `qwen_2.5_vl`;
  - for `clip_name2` of **DualCLIPLoader**: a file whose name has `clip_l`;
  - for `vae_name` of **Load VAE**: a file whose name has `hunyuan_video_vae`.
- Nodes: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Kandinsky5ImageToVideo, KSampler, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What it costs, first** (reading)

   Kandinsky 5.0 Video Lite by Sber AI is a small video model, 2B, about 4 GB on disk. It reads the prompt with two text encoders and decodes with the VAE of HunyuanVideo.

   What you need: the `kandinsky5lite_t2v` file in `models/diffusion_models`; `qwen_2.5_vl_7b` (about 9 GB in `fp8`) and `clip_l` in `models/text_encoders`; `hunyuan_video_vae` in `models/vae`. The model itself fits modest cards; the text encoder is the largest file. 50 steps make the run long: expect many minutes.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the model**

   Add a **Load Diffusion Model** node and choose the `kandinsky5lite_t2v` file in `unet_name`.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "Kandinsky 5.0 Video Lite Text to Video" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the two text encoders**

   Add a **DualCLIPLoader** node. In `clip_name1` choose `qwen_2.5_vl_7b`, in `clip_name2` choose `clip_l`, and set `type` to `kandinsky5`.

4. **Load the VAE**

   Add a **Load VAE** node and choose `hunyuan_video_vae` in `vae_name`. Kandinsky 5 uses the VAE of HunyuanVideo 1.0.

5. **Write the prompt**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **DualCLIPLoader** to the `clip` input of each. In the `text` field of one, describe the clip: who or what is in the frame, what happens, how the camera moves. The other is the negative prompt: what must not be there.

   For video the action matters most. "A cat jumps onto a windowsill, the camera follows" works better than "a cat on a windowsill".

6. **Set the shift**

   Add a **ModelSamplingSD3** node and connect the `MODEL` output of the loader to its `model` input. Set `shift` to 5.

7. **Size and length**

   Add a **Kandinsky5ImageToVideo** node and connect to it the two prompts and the VAE. Set `width` to 768, `height` to 512 and `length` to 121.

   The Lite file of this lesson is made for five-second clips: 121 frames at 24 fps. Its `start_image` input stays empty for video from text.

8. **Add the sampler**

   Add a **KSampler** node. Its `model` input takes the output of **ModelSamplingSD3**; `positive`, `negative` and `latent_image` take the outputs of **Kandinsky5ImageToVideo** with the same names.

9. **Set up the sampler**

   Set `steps` to 50, `cfg` to 5, `sampler_name` to `euler_ancestral` and `scheduler` to `beta`, as in the template. With fewer steps the run is faster and the clip rougher.

10. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the sampler's output to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the clip in compressed form, the latent. This node unfolds it into frames.

11. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 24.

   Kandinsky 5 draws 24 fps. With another number the clip runs faster or slower than it was meant to.

12. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `kandinsky5` and `t2v` (capitals, dots and dashes do not matter).
- Step 3, **Load the two text encoders**:
  - a **DualCLIPLoader** node.
  - `clip_name1` of **DualCLIPLoader** holds a file whose name has `qwen_2.5_vl` (capitals, dots and dashes do not matter).
  - `clip_name2` of **DualCLIPLoader** is not the same file as `clip_name1` of **DualCLIPLoader**.
  - `type` of **DualCLIPLoader** is `kandinsky5`.
  - `clip_name2` of **DualCLIPLoader** holds a file whose name has `clip_l` (capitals, dots and dashes do not matter).
- Step 4, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds a file whose name has `hunyuan_video_vae` (capitals, dots and dashes do not matter).
- Step 5, **Write the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **DualCLIPLoader** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **DualCLIPLoader** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters.
- Step 6, **Set the shift**:
  - a **ModelSamplingSD3** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **ModelSamplingSD3** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `shift` of **ModelSamplingSD3** is from 3 to 8; **Do this for me** sets 5.
- Step 7, **Size and length**:
  - a **Kandinsky5ImageToVideo** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **Kandinsky5ImageToVideo**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **Kandinsky5ImageToVideo**.
  - `VAE` of **Load VAE** into `vae` of **Kandinsky5ImageToVideo**.
  - `width` of **Kandinsky5ImageToVideo** is from 512 to 1280; **Do this for me** sets 768.
  - `height` of **Kandinsky5ImageToVideo** is from 320 to 768; **Do this for me** sets 512.
  - `length` of **Kandinsky5ImageToVideo** is from 49 to 121; **Do this for me** sets 121.
- Step 8, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingSD3** into `model` of **KSampler** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **Kandinsky5ImageToVideo** into `positive` of **KSampler**.
  - `negative` of **Kandinsky5ImageToVideo** into `negative` of **KSampler**.
  - `latent` of **Kandinsky5ImageToVideo** into `latent_image` of **KSampler**.
- Step 9, **Set up the sampler**:
  - `steps` of **KSampler** is from 20 to 50; **Do this for me** sets 50.
  - `cfg` of **KSampler** is from 3 to 7; **Do this for me** sets 5.
  - `sampler_name` of **KSampler** is `euler_ancestral`.
  - `scheduler` of **KSampler** is `beta`.
- Step 10, **Turn the result into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode** or **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)**.
- Step 11, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `24`.

## See also
- [Video generation](../concepts/Video-Models.md)
- [Model families](../concepts/Model-Families.md)
- [How lessons work](How-Lessons-Work.md)
