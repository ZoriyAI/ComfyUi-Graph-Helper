[Русский](Video-LTX.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video with sound: LTX-2.5

<!-- lesson: video-ltx -->
Lesson "video-ltx", in the group **Video** of the lesson list. Steps: 16.

## What you will be able to do
One run draws a clip and its sound together, from a prompt.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `ltx-2`;
  - for `clip_name` of **Load CLIP**: a file whose name has `gemma`;
  - for `vae_name` of **Load VAE** (VAE of the video): a file whose name has `ltx` and `video`;
  - for `vae_name` of **Load VAE** (sound VAE): a file whose name has `ltx` and `audio`;
  - for `model_name` of **Load Latent Upscale Model**: a file whose name has `ltx` and `upscaler`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), LTXVConditioning, EmptyLTXVLatentVideo, Empty LTXV Latent Audio, LTXVConcatAVLatent, RandomNoise, KSamplerSelect, ManualSigmas, LTXVDualCFGGuider, SamplerCustomAdvanced, LTXVSeparateAVLatent, Load Latent Upscale Model, LTXVLatentUpsampler, VAE Decode (Tiled) / VAE Decode, LTXV Audio VAE Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What it costs, first** (reading)

   LTX-2.5 by Lightricks draws the picture and the sound in one go: steps, rain, a voice. The graph works in two stages: the first draws the clip at half size, a latent upscaler doubles it, and the second stage finishes the detail.

   What you need: the distilled model (over 20 GB) in `models/diffusion_models`; the Gemma text encoder (about 12 GB) in `models/text_encoders`; two VAE files, one for the video and one for the sound, in `models/vae`; the upscaler in `models/latent_upscale_models`. A card with 24 GB is comfortable; with less, ComfyUI moves parts to system memory and the run is slower. The distilled model needs only eight steps and three, so a five-second clip takes minutes.

   The graph is the largest of these lessons. If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the model**

   Add a **Load Diffusion Model** node and choose the `ltx-2.5` distilled file in `unet_name`.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "LTX-2.5: Text to Video" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text encoder and the two VAEs**

   Add **Load CLIP**, **Load VAE** and a second **Load VAE**.
   - In `clip_name` of **Load CLIP** choose the Gemma file made for LTX-2.5 and set `type` to `ltxv`.
   - In `vae_name` of **Load VAE** choose the `video-vae` file.
   - In `vae_name` of the second VAE loader choose the `audio-vae` file.

   The picture and the sound have their own VAE; mixing them up gives noise in place of sound.

4. **Write the prompt with its sound**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load CLIP** to each. In the `text` field of one, describe the scene in several sentences, and say what is heard: "rain drums on a tin roof", "she says quietly: we are late". The other is the negative prompt.

   LTX reads long, detailed prompts best.

5. **Tell the model the frame rate**

   Add a **LTXVConditioning** node. Connect the two prompts to its `positive` and `negative` inputs and set `frame_rate` to 24.

   The model needs to know how fast time runs in the clip, for the motion and for the sound to keep pace.

6. **Size and length of the first stage**

   Add a **EmptyLTXVLatentVideo** node. Set `width` to 768, `height` to 512 and `length` to 121.

   This is half the final size: the upscaler doubles it. For LTX the number of frames is of the form 8n + 1 (97, 121) and the sides are multiples of 32. 121 frames at 24 fps make five seconds.

7. **A blank for the sound, joined to the video**

   Add **Empty LTXV Latent Audio** and **LTXVConcatAVLatent**.
   - Connect the output of the sound VAE loader to the `audio_vae` input of **Empty LTXV Latent Audio**. Set `frames_number` to 121 and `frame_rate` to 24, as for the video.
   - Connect the output of **EmptyLTXVLatentVideo** to `video_latent` of **LTXVConcatAVLatent**, and the output of **Empty LTXV Latent Audio** to `audio_latent`.

   The model draws picture and sound in one latent, so the two blanks travel together.

8. **Noise, sampler and steps**

   Add **RandomNoise**, **KSamplerSelect** and **ManualSigmas**.
   - In `sampler_name` of **KSamplerSelect** choose `euler_ancestral`.
   - In `sigmas` of **ManualSigmas** write: `1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0`.

   This custom sampler is built of parts. The list of numbers is the noise left after each step: the distilled model was trained for exactly these eight steps.

9. **The guider**

   Add a **LTXVDualCFGGuider** node. Connect the model to its `model` input, and the `positive` and `negative` outputs of **LTXVConditioning** to its inputs. Set `video_cfg` and `audio_cfg` to 1.

   The distilled model needs no extra push from the prompt; a higher value burns the picture.

10. **The first stage**

   Add a **SamplerCustomAdvanced** node and connect to it: `noise` from **RandomNoise**, `guider` from **LTXVDualCFGGuider**, `sampler` from **KSamplerSelect**, `sigmas` from **ManualSigmas**, and `latent_image` from **LTXVConcatAVLatent**.

11. **Double the size of the video**

   Add **LTXVSeparateAVLatent**, **Load Latent Upscale Model**, **LTXVLatentUpsampler** and a second **LTXVConcatAVLatent**.
   - The `output` of the first stage goes into `av_latent` of **LTXVSeparateAVLatent**: it parts the video and the sound.
   - In `model_name` of **Load Latent Upscale Model** choose the LTX-2.5 spatial upscaler file. Its output goes into `upscale_model` of **LTXVLatentUpsampler**, the video VAE into `vae`, and `video_latent` of **LTXVSeparateAVLatent** into `samples`.
   - The output of **LTXVLatentUpsampler** goes into `video_latent` of the new join, and `audio_latent` of **LTXVSeparateAVLatent** into its `audio_latent`.

   Only the video is enlarged; the sound goes on as it is.

12. **The second stage**

   Add a second **ManualSigmas** with `sigmas` `0.85, 0.7250, 0.4219, 0.0`, and a second **SamplerCustomAdvanced**. Connect to the new sampler the same noise, guider and sampler choice, the new list of steps, and the output of the second join to `latent_image`.

   Three short steps finish the detail of the larger clip. The template has a copy of the noise, the guider and the sampler choice for each stage, with the same settings; one of each serves both.

13. **Turn the result into frames and sound**

   Add a second **LTXVSeparateAVLatent**, a **VAE Decode (Tiled)** and a **LTXV Audio VAE Decode**.
   - The `output` of the second stage goes into `av_latent` of the new separating node.
   - Its `video_latent` goes into `samples` of **VAE Decode (Tiled)**, with the video VAE into `vae`.
   - Its `audio_latent` goes into `samples` of **LTXV Audio VAE Decode**, with the sound VAE into `audio_vae`.

   The tiled decoder turns a large clip into frames piece by piece, so the end of the run needs less memory.

14. **Make the clip with its sound**

   Add **Create Video** and **Save Video**: the frames into `images`, the sound into `audio`, the clip into `video`. Set `fps` to 24, as in **LTXVConditioning**.

15. **When the result is not right** (reading)

   - The sound does not fit the picture: describe the sound in the prompt as clearly as the picture.
   - The clip is still: describe one clear action and the camera's motion.
   - It does not fit in memory: lower `length` to 97, or the size to 640 × 384.

16. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `ltx-2` (capitals, dots and dashes do not matter).
- Step 3, **The text encoder and the two VAEs**:
  - a **Load CLIP** node.
  - a **Load VAE** node.
  - a **Load VAE** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `gemma` (capitals, dots and dashes do not matter).
  - `type` of **Load CLIP** is `ltxv`.
  - `vae_name` of **Load VAE** (VAE of the video) holds a file whose name has `ltx` and `video` (capitals, dots and dashes do not matter).
  - `vae_name` of **Load VAE** (sound VAE) is not the same file as `vae_name` of **Load VAE** (VAE of the video).
  - `vae_name` of **Load VAE** (sound VAE) holds a file whose name has `ltx` and `audio` (capitals, dots and dashes do not matter).
- Step 4, **Write the prompt with its sound**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 40 characters.
- Step 5, **Tell the model the frame rate**:
  - a **LTXVConditioning** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **LTXVConditioning**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **LTXVConditioning**.
  - `frame_rate` of **LTXVConditioning** is `24`.
- Step 6, **Size and length of the first stage**:
  - a **EmptyLTXVLatentVideo** node.
  - `width` of **EmptyLTXVLatentVideo** is from 512 to 960; **Do this for me** sets 768.
  - `height` of **EmptyLTXVLatentVideo** is from 288 to 544; **Do this for me** sets 512.
  - `length` of **EmptyLTXVLatentVideo** is from 49 to 121; **Do this for me** sets 121.
- Step 7, **A blank for the sound, joined to the video**:
  - a **Empty LTXV Latent Audio** node.
  - a **LTXVConcatAVLatent** node.
  - `VAE` of **Load VAE** (sound VAE) into `audio_vae` of **Empty LTXV Latent Audio**.
  - `LATENT` of **EmptyLTXVLatentVideo** into `video_latent` of **LTXVConcatAVLatent** (join, first stage).
  - `LATENT` of **Empty LTXV Latent Audio** into `audio_latent` of **LTXVConcatAVLatent** (join, first stage).
  - `frames_number` of **Empty LTXV Latent Audio** equals `length` of **EmptyLTXVLatentVideo**.
  - `frame_rate` of **Empty LTXV Latent Audio** equals `frame_rate` of **LTXVConditioning**.
- Step 8, **Noise, sampler and steps**:
  - a **RandomNoise** node.
  - a **KSamplerSelect** node.
  - a **ManualSigmas** node.
  - `sampler_name` of **KSamplerSelect** is `euler_ancestral`.
  - `sigmas` of **ManualSigmas** (first stage) is `1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0`.
- Step 9, **The guider**:
  - a **LTXVDualCFGGuider** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **LTXVDualCFGGuider** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **LTXVConditioning** into `positive` of **LTXVDualCFGGuider**.
  - `negative` of **LTXVConditioning** into `negative` of **LTXVDualCFGGuider**.
  - `video_cfg` of **LTXVDualCFGGuider** is `1`.
  - `audio_cfg` of **LTXVDualCFGGuider** is `1`.
- Step 10, **The first stage**:
  - a **SamplerCustomAdvanced** node.
  - `NOISE` of **RandomNoise** into `noise` of **SamplerCustomAdvanced** (first stage).
  - `GUIDER` of **LTXVDualCFGGuider** into `guider` of **SamplerCustomAdvanced** (first stage).
  - `SAMPLER` of **KSamplerSelect** into `sampler` of **SamplerCustomAdvanced** (first stage).
  - `SIGMAS` of **ManualSigmas** (first stage) into `sigmas` of **SamplerCustomAdvanced** (first stage).
  - `LATENT` of **LTXVConcatAVLatent** (join, first stage) into `latent_image` of **SamplerCustomAdvanced** (first stage).
- Step 11, **Double the size of the video**:
  - a **LTXVSeparateAVLatent** node.
  - a **Load Latent Upscale Model** node.
  - a **LTXVLatentUpsampler** node.
  - a **LTXVConcatAVLatent** node.
  - `output` of **SamplerCustomAdvanced** (first stage) into `av_latent` of **LTXVSeparateAVLatent** (after the first stage).
  - `video_latent` of **LTXVSeparateAVLatent** (after the first stage) into `samples` of **LTXVLatentUpsampler**.
  - `LATENT_UPSCALE_MODEL` of **Load Latent Upscale Model** into `upscale_model` of **LTXVLatentUpsampler**.
  - `VAE` of **Load VAE** (VAE of the video) into `vae` of **LTXVLatentUpsampler**.
  - `LATENT` of **LTXVLatentUpsampler** into `video_latent` of **LTXVConcatAVLatent** (join, second stage).
  - `audio_latent` of **LTXVSeparateAVLatent** (after the first stage) into `audio_latent` of **LTXVConcatAVLatent** (join, second stage).
  - `model_name` of **Load Latent Upscale Model** holds a file whose name has `ltx` and `upscaler` (capitals, dots and dashes do not matter).
- Step 12, **The second stage**:
  - a **ManualSigmas** node.
  - a **SamplerCustomAdvanced** node.
  - `NOISE` of **RandomNoise** into `noise` of **SamplerCustomAdvanced** (second stage).
  - `GUIDER` of **LTXVDualCFGGuider** into `guider` of **SamplerCustomAdvanced** (second stage).
  - `SAMPLER` of **KSamplerSelect** into `sampler` of **SamplerCustomAdvanced** (second stage).
  - `SIGMAS` of **ManualSigmas** (second stage) into `sigmas` of **SamplerCustomAdvanced** (second stage).
  - `LATENT` of **LTXVConcatAVLatent** (join, second stage) into `latent_image` of **SamplerCustomAdvanced** (second stage).
  - `sigmas` of **ManualSigmas** (second stage) is `0.85, 0.7250, 0.4219, 0.0`.
- Step 13, **Turn the result into frames and sound**:
  - a **LTXVSeparateAVLatent** node.
  - a **VAE Decode (Tiled)** or **VAE Decode** node.
  - a **LTXV Audio VAE Decode** node.
  - `output` of **SamplerCustomAdvanced** (second stage) into `av_latent` of **LTXVSeparateAVLatent** (after the second stage).
  - `video_latent` of **LTXVSeparateAVLatent** (after the second stage) into `samples` of **VAE Decode (Tiled)** or **VAE Decode**.
  - `VAE` of **Load VAE** (VAE of the video) into `vae` of **VAE Decode (Tiled)** or **VAE Decode**.
  - `audio_latent` of **LTXVSeparateAVLatent** (after the second stage) into `samples` of **LTXV Audio VAE Decode**.
  - `VAE` of **Load VAE** (sound VAE) into `audio_vae` of **LTXV Audio VAE Decode**.
- Step 14, **Make the clip with its sound**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode (Tiled)** or **VAE Decode** into `images` of **Create Video**.
  - `AUDIO` of **LTXV Audio VAE Decode** into `audio` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `24`.

## See also
- [LTX-2](../concepts/Family-LTX2.md)
- [Audio](../concepts/Audio.md)
- [Video generation](../concepts/Video-Models.md)
- [How lessons work](How-Lessons-Work.md)
