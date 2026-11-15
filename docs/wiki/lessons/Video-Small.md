[Русский](Video-Small.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video on a modest graphics card: Wan 2.2 5B

<!-- lesson: video-small -->
Lesson "video-small", in the group **Video** of the lesson list. Steps: 13.

## What you will be able to do
You build a one-model Wan 2.2 graph that makes a five-second 720p clip from a prompt, or from an image.

## What you need
- It goes on from [Video from text](Video-Text.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `ti2v` and `5b`;
  - for `clip_name` of **Load CLIP**: a file whose name has `umt5`;
  - for `vae_name` of **Load VAE**: a file whose name has `wan2.2_vae`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Wan22ImageToVideoLatent, KSampler, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What it costs, first** (reading)

   Wan 2.2 has a small model, 5B (five billion parameters), made for ordinary graphics cards. It draws 24 fps and takes a prompt, an image, or both.

   What you need:
   - the model file, about 10 GB, in `models/diffusion_models`;
   - the `umt5_xxl` text encoder, about 7 GB in its `fp8` form, in `models/text_encoders`;
   - the `wan2.2_vae` file in `models/vae`.

   Memory: with ComfyUI moving parts of the model to system memory as needed, a card with 8 GB can run it. Time: a five-second clip takes minutes, not seconds, and the first run is longer because the files are read from disk.

   The graph has one model and one sampler, not the pair of the large 14B models. If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the model**

   Add a **Load Diffusion Model** node and choose the `wan2.2_ti2v_5B` file in `unet_name`. `ti2v` means it takes text, an image, or both.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "Wan 2.2 5B Video Generation" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the text encoder**

   Add a **Load CLIP** node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.

   The text encoder turns the prompt into what the model reads. The `fp8` version of the file takes half the memory of the full one and is what the templates use.

4. **Load the VAE of the small model**

   Add a **Load VAE** node and choose the `wan2.2_vae` file in `vae_name`.

   The 5B model compresses video more strongly than the 14B models and has its own VAE. The `wan_2.1_vae` file of the large models gives broken frames here.

5. **Write the prompt**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load CLIP** to the `clip` input of each. In the `text` field of one, describe the clip: who or what is in the frame, what happens, how the camera moves. The other is the negative prompt: what must not be there.

   For video the action matters most. "A cat jumps onto a windowsill, the camera follows" works better than "a cat on a windowsill".

6. **Set the shift**

   Add a **ModelSamplingSD3** node and connect the `MODEL` output of the loader to its `model` input. Set `shift` to 8.

   Shift decides how much of the work goes to the early, noisy steps where the composition and the motion are laid out. With a small value Wan keeps the composition and the motion worse and the clip comes out sluggish.

   The SD3 in the node's name is left from another model: Wan uses the same node.

7. **Set the size and the length**

   Add a **Wan22ImageToVideoLatent** node and connect the output of **Load VAE** to its `vae` input. Set `width` to 1280, `height` to 704 and `length` to 121.

   121 frames at 24 fps make five seconds. For Wan the number of frames is of the form 4n + 1: 49, 81, 121. The model was trained at this 720p size; a smaller size is faster and less sharp.

8. **Starting from an image, if you like** (reading)

   The same node has a `start_image` input. Connect a Load Image node to it and the clip starts from your image; leave it empty and the clip is drawn from the prompt alone. In the template this node is there and switched off.

   With an image, the prompt describes what happens, not what is in the frame. Keep the proportions of the image close to 1280 × 704.

9. **Add the sampler**

   Add a **KSampler** node and connect to it:
   - to `model`, the output of **ModelSamplingSD3**;
   - to `positive` and `negative`, the two prompts;
   - to `latent_image`, the output of **Wan22ImageToVideoLatent**.

10. **Set up the sampler**

   In **KSampler** set `steps` to 20, `cfg` to 5, `sampler_name` to `uni_pc` and `scheduler` to `simple`.

   These are the numbers of the official template. Fewer steps are faster and blurrier; a `cfg` far above 5 burns the colours.

11. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the sampler's output to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the clip in compressed form, the latent. This node unfolds it into frames.

12. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 24.

   The 5B model draws 24 fps, the large Wan models 16. With another number the clip runs faster or slower than it was meant to.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the graphics card runs out of memory, the lesson "When a video does not fit in memory" goes on from this very graph.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `ti2v` and `5b` (capitals, dots and dashes do not matter).
- Step 3, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `umt5` (capitals, dots and dashes do not matter).
  - `type` of **Load CLIP** is `wan`.
- Step 4, **Load the VAE of the small model**:
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
- Step 7, **Set the size and the length**:
  - a **Wan22ImageToVideoLatent** node.
  - `VAE` of **Load VAE** into `vae` of **Wan22ImageToVideoLatent**.
  - `width` of **Wan22ImageToVideoLatent** is from 640 to 1280; **Do this for me** sets 1280.
  - `height` of **Wan22ImageToVideoLatent** is from 352 to 1280; **Do this for me** sets 704.
  - `length` of **Wan22ImageToVideoLatent** is from 49 to 121; **Do this for me** sets 121.
- Step 9, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingSD3** into `model` of **KSampler** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler**.
  - `LATENT` of **Wan22ImageToVideoLatent** into `latent_image` of **KSampler**.
- Step 10, **Set up the sampler**:
  - `steps` of **KSampler** is from 10 to 30; **Do this for me** sets 20.
  - `cfg` of **KSampler** is from 4 to 6; **Do this for me** sets 5.
  - `sampler_name` of **KSampler** is `uni_pc`.
  - `scheduler` of **KSampler** is `simple`.
- Step 11, **Turn the result into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode** or **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)**.
- Step 12, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `24`.

## What next
These lessons go on from this one: [When a video does not fit in memory](Video-Memory.md), [Video guided by another video: Wan 2.2 Fun Control](Video-Control.md), [Video with sound: LTX-2.5](Video-LTX.md), [Video from text: HunyuanVideo 1.5](Video-Hunyuan.md), [Video from text: Kandinsky 5 Lite](Video-Kandinsky.md), [Smoother motion: more frames between frames](Video-Interpolate.md), [The start picture is the anchor](Anchor-Start.md), [Load, cut and save video: VideoHelperSuite](VideoHelperSuite.md).

## See also
- [Wan 2.2](../concepts/Family-Wan22.md)
- [Video generation](../concepts/Video-Models.md)
- [Video length and frame rate](../concepts/Video-Length-And-Frame-Rate.md)
- [How lessons work](How-Lessons-Work.md)
