[Русский](Video-Hunyuan.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from text: HunyuanVideo 1.5

<!-- lesson: video-hunyuan -->
Lesson "video-hunyuan", in the group **Video** of the lesson list. Steps: 14.

## What you will be able to do
You build the HunyuanVideo 1.5 graph with a custom sampler and get a five-second 720p clip.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `hunyuanvideo1.5` and `t2v`;
  - for `clip_name1` of **DualCLIPLoader**: a file whose name has `qwen_2.5_vl`;
  - for `clip_name2` of **DualCLIPLoader**: a file whose name has `byt5`;
  - for `vae_name` of **Load VAE**: a file whose name has `hunyuanvideo15_vae`.
- Nodes: Load Diffusion Model, DualCLIPLoader, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Empty Hunyuan Video 1.5 Latent, RandomNoise, KSamplerSelect, BasicScheduler, CFG Guider, SamplerCustomAdvanced, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What it costs, first** (reading)

   HunyuanVideo 1.5 by Tencent is an 8B video model, between the small and the large Wan in size. Its graph uses the custom sampler: noise, a guider, a sampler and a list of steps as separate nodes.

   What you need: the `720p_t2v` model, about 17 GB in `fp16`, in `models/diffusion_models`; two text encoders (`qwen_2.5_vl_7b` in `fp8` and the small `byt5` for lettering) in `models/text_encoders`; `hunyuanvideo15_vae` in `models/vae`. A card with 16 GB or more is comfortable; 121 frames at 1280 × 720 take a long time, a smaller size much less.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the model**

   Add a **Load Diffusion Model** node and choose the `hunyuanvideo1.5_720p_t2v` file in `unet_name`.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "Hunyuan Video 1.5 Text to Video" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the two text encoders**

   Add a **DualCLIPLoader** node. In `clip_name1` choose `qwen_2.5_vl_7b`, in `clip_name2` choose `byt5_small_glyphxl`, and set `type` to `hunyuan_video_15`.

   The first reads the prompt, the second helps with text written in the picture.

4. **Load the VAE**

   Add a **Load VAE** node and choose `hunyuanvideo15_vae` in `vae_name`. The VAE of HunyuanVideo 1.0 does not fit version 1.5.

5. **Write the prompt**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **DualCLIPLoader** to the `clip` input of each. In the `text` field of one, describe the clip: who or what is in the frame, what happens, how the camera moves. The other is the negative prompt: what must not be there.

   For video the action matters most. "A cat jumps onto a windowsill, the camera follows" works better than "a cat on a windowsill".

6. **Set the shift**

   Add a **ModelSamplingSD3** node and connect the `MODEL` output of the loader to its `model` input. Set `shift` to 7.

7. **Size and length**

   Add a **Empty Hunyuan Video 1.5 Latent** node. Set `width` to 1280, `height` to 720 and `length` to 121.

   121 frames at 24 fps make five seconds; the number of frames is of the form 4n + 1. For a lighter run take the 480p model and 848 × 480.

8. **Noise, sampler and steps**

   Add **RandomNoise**, **KSamplerSelect** and **BasicScheduler**.
   - In `sampler_name` of **KSamplerSelect** choose `euler`.
   - Connect the model to the `model` input of **BasicScheduler**, set `scheduler` to `simple` and `steps` to 20.

   The scheduler works out the list of noise levels for the twenty steps; the noise node holds the seed.

9. **The guider**

   Add a **CFG Guider** node. Its `model` input takes the output of **ModelSamplingSD3**; its `positive` and `negative` inputs take the two prompts. Set `cfg` to 6.

10. **The sampler**

   Add a **SamplerCustomAdvanced** node and connect to it: `noise` from **RandomNoise**, `guider` from **CFG Guider**, `sampler` from **KSamplerSelect**, `sigmas` from **BasicScheduler**, `latent_image` from **Empty Hunyuan Video 1.5 Latent**.

11. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the `output` of **SamplerCustomAdvanced** to its `samples` input and the VAE to its `vae` input. With little memory take VAE Decode (Tiled) instead.

12. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 24.

   HunyuanVideo 1.5 draws 24 fps. With another number the clip runs faster or slower than it was meant to.

13. **What else the template does** (reading)

   The official template adds two things on top of this graph:
   - EasyCache between the loader and the shift: it skips work on steps that change little, faster with a small loss of detail;
   - a second stage that enlarges the clip to 1080p with its own model and latent upscaler.

   Both can be added later; the app accepts EasyCache on the way of the model.

14. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `hunyuanvideo1.5` and `t2v` (capitals, dots and dashes do not matter).
- Step 3, **Load the two text encoders**:
  - a **DualCLIPLoader** node.
  - `clip_name1` of **DualCLIPLoader** holds a file whose name has `qwen_2.5_vl` (capitals, dots and dashes do not matter).
  - `clip_name2` of **DualCLIPLoader** is not the same file as `clip_name1` of **DualCLIPLoader**.
  - `type` of **DualCLIPLoader** is `hunyuan_video_15`.
  - `clip_name2` of **DualCLIPLoader** holds a file whose name has `byt5` (capitals, dots and dashes do not matter).
- Step 4, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds a file whose name has `hunyuanvideo15_vae` (capitals, dots and dashes do not matter).
- Step 5, **Write the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **DualCLIPLoader** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **DualCLIPLoader** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters.
- Step 6, **Set the shift**:
  - a **ModelSamplingSD3** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **ModelSamplingSD3** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `shift` of **ModelSamplingSD3** is from 5 to 9; **Do this for me** sets 7.
- Step 7, **Size and length**:
  - a **Empty Hunyuan Video 1.5 Latent** node.
  - `width` of **Empty Hunyuan Video 1.5 Latent** is from 640 to 1280; **Do this for me** sets 1280.
  - `height` of **Empty Hunyuan Video 1.5 Latent** is from 368 to 720; **Do this for me** sets 720.
  - `length` of **Empty Hunyuan Video 1.5 Latent** is from 33 to 121; **Do this for me** sets 121.
- Step 8, **Noise, sampler and steps**:
  - a **RandomNoise** node.
  - a **KSamplerSelect** node.
  - a **BasicScheduler** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **BasicScheduler** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `sampler_name` of **KSamplerSelect** is `euler`.
  - `scheduler` of **BasicScheduler** is `simple`.
  - `steps` of **BasicScheduler** is from 8 to 50; **Do this for me** sets 20.
- Step 9, **The guider**:
  - a **CFG Guider** node.
  - `MODEL` of **ModelSamplingSD3** into `model` of **CFG Guider** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **CFG Guider**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **CFG Guider**.
  - `cfg` of **CFG Guider** is from 1 to 8; **Do this for me** sets 6.
- Step 10, **The sampler**:
  - a **SamplerCustomAdvanced** node.
  - `NOISE` of **RandomNoise** into `noise` of **SamplerCustomAdvanced**.
  - `GUIDER` of **CFG Guider** into `guider` of **SamplerCustomAdvanced**.
  - `SAMPLER` of **KSamplerSelect** into `sampler` of **SamplerCustomAdvanced**.
  - `SIGMAS` of **BasicScheduler** into `sigmas` of **SamplerCustomAdvanced**.
  - `LATENT` of **Empty Hunyuan Video 1.5 Latent** into `latent_image` of **SamplerCustomAdvanced**.
- Step 11, **Turn the result into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `output` of **SamplerCustomAdvanced** into `samples` of **VAE Decode** or **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)**.
- Step 12, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `24`.

## See also
- [HunyuanVideo](../concepts/Family-HunyuanVideo.md)
- [Video generation](../concepts/Video-Models.md)
- [How lessons work](How-Lessons-Work.md)
