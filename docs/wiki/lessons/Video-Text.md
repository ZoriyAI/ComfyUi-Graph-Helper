[Русский](Video-Text.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from text

<!-- lesson: video-text -->
Lesson "video-text", in the group **Video** of the lesson list. Steps: 14.

## What you will be able to do
You build a Wan 2.2 graph that makes a five-second clip from a prompt.

## What you need
- Model files the lesson checks:
  - the high_noise half of Wan 2.2 text to video (t2v): `models/diffusion_models`, for example `wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors`;
  - the low_noise half of Wan 2.2 text to video (t2v): `models/diffusion_models`, for example `wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Empty Hunyuan Video 1.0 Latent, KSampler (Advanced), VAE Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What a video is to a model** (reading)

   To a model a video is a stack of frames. It draws them all at once so that the motion holds together.

   Wan 2.2 does this in two passes with two models. The first, `high_noise`, lays out the composition and the motion. The second, `low_noise`, finishes the detail. That is why the graph has two model loaders and two samplers.

   The graph is larger than for a picture: fourteen nodes. The steps are small, and the app ticks each one off.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load two models**

   Add two **Load Diffusion Model** nodes. In the `unet_name` field of one choose the file with `high_noise` in its name, in the other the file with `low_noise`. This lesson needs `t2v` files, that is "text to video".

   These are two halves of one model. The same file in both nodes will not work.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the ready Wan 2.2 "text to video" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the text reader**

   Add a **Load CLIP** node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.

   Video models keep their text reader in a separate file. The `type` field tells the node which model the text is for. With another value the model gets nonsense.

4. **Load the VAE**

   Add a **Load VAE** node and choose the `wan_2.1_vae` file in `vae_name`.

   The VAE turns the result into frames. The large Wan 2.2 models need the VAE of version 2.1. The `wan2.2_vae` file fits only the small 5B model.

5. **Write the prompt**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the output of **Load CLIP** to the `clip` input of each. In the `text` field of one describe the clip: what is in the frame, what happens, how the camera moves. The other is for what must not be there.

   For video the action matters. "A person walks along a beach, the camera follows from the side" works better than "a person on a beach".

6. **Set the noise shift**

   Add two **ModelSamplingSD3** nodes. Pass the first model through one and the second through the other: the loader's `MODEL` output to the `model` input. Set `shift` to 8 in both.

   This number changes how much noise is left at each step. With a small value Wan holds composition and motion worse, and the clip comes out sluggish.

   The SD3 in the node's name is left from another model: Wan is set up with the same node.

7. **Set the size and the length**

   Add a **Empty Hunyuan Video 1.0 Latent** node. Set `width` to 832, `height` to 480 and `length` to 81.

   `length` is the number of frames. 81 frames at 16 frames a second make five seconds. For Wan the number of frames must be of the form 4n + 1: 49, 81, 121.

   Size and length weigh most on time and on the memory of the graphics card. Start small.

   The Hunyuan in the node's name is left from another video model: Wan uses the same blank.

8. **The first pass**

   Add a **KSampler (Advanced)** node and connect to it:
   - to `model`, the output of the **ModelSamplingSD3** node that carries the `high_noise` model;
   - to `positive` and `negative`, the two texts;
   - to `latent_image`, the output of **Empty Hunyuan Video 1.0 Latent**.

   This sampler starts from pure noise and lays the clip out.

9. **The second pass**

   Add a second **KSampler (Advanced)** node and connect to it:
   - to `model`, the output of the **ModelSamplingSD3** node with the `low_noise` model;
   - to `positive` and `negative`, the same two texts;
   - to `latent_image`, the output of the first sampler.

   The second sampler receives the unfinished clip and finishes it.

10. **Set up the first sampler**

   In the first sampler set:
   - `add_noise`: `enable`;
   - `steps`: 20;
   - `cfg`: 3.5;
   - `start_at_step`: 0 and `end_at_step`: 10;
   - `return_with_leftover_noise`: `enable`.

   It does the first half of twenty steps and hands the clip over with the noise that is left. Without the last setting the second sampler gets a clip that is already clean and has nothing to finish.

11. **Set up the second sampler**

   In the second sampler set:
   - `add_noise`: `disable`;
   - `steps` and `cfg`: as in the first;
   - `start_at_step`: 10, the very step the first one stopped at;
   - `return_with_leftover_noise`: `disable`.

   The noise is already there and must not be added twice. If `start_at_step` differs from the first sampler's `end_at_step`, some steps are lost or done twice.

12. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the second sampler's output to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the clip in a compressed form. This node unfolds it into frames.

13. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 16.

   Wan draws 16 frames a second. With another number the clip runs faster or slower than it was meant to.

14. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The first run is long: the models are loaded into memory. If the graphics card runs out of memory, lower `width`, `height` or `length`.

   Next: "Video from a picture" brings a finished frame to life, and "Fast video in four steps" cuts the wait several times over.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load two models**:
  - a **Load Diffusion Model** node.
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** (first pass) holds the high_noise half of Wan 2.2 text to video (t2v); such a file lies in `models/diffusion_models`, for example `wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors`.
  - `unet_name` of **Load Diffusion Model** (second pass) is not the same file as `unet_name` of **Load Diffusion Model** (first pass).
  - `unet_name` of **Load Diffusion Model** (second pass) holds the low_noise half of Wan 2.2 text to video (t2v); such a file lies in `models/diffusion_models`, for example `wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors`.
- Step 3, **Load the text reader**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - `type` of **Load CLIP** is `wan`. Why: the `type` field tells the node which model the text is for. With another value Wan gets nonsense.
- Step 4, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds the Wan 2.1 VAE (wan_2.1_vae); such a file lies in `models/vae`, for example `wan_2.1_vae.safetensors`.
- Step 5, **Write the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters and 2 real words.
- Step 6, **Set the noise shift**:
  - a **ModelSamplingSD3** node.
  - a **ModelSamplingSD3** node.
  - `MODEL` of **Load Diffusion Model** (first pass) into `model` of **ModelSamplingSD3** (shift of the first pass) (a LoraLoaderModelOnly in between is accepted).
  - `MODEL` of **Load Diffusion Model** (second pass) into `model` of **ModelSamplingSD3** (shift of the second pass) (a LoraLoaderModelOnly in between is accepted).
  - `shift` of **ModelSamplingSD3** (shift of the first pass) is from 5 to 8; **Do this for me** sets 8. Why: with a small shift Wan holds composition and motion worse, and the clip comes out sluggish.
  - `shift` of **ModelSamplingSD3** (shift of the second pass) is from 5 to 8; **Do this for me** sets 8. Why: with a small shift Wan holds composition and motion worse, and the clip comes out sluggish.
- Step 7, **Set the size and the length**:
  - a **Empty Hunyuan Video 1.0 Latent** node.
  - `length` of **Empty Hunyuan Video 1.0 Latent** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
- Step 8, **The first pass**:
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the first pass) into `model` of **KSampler (Advanced)** (first pass) (a LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler (Advanced)** (first pass).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler (Advanced)** (first pass).
  - `LATENT` of **Empty Hunyuan Video 1.0 Latent** into `latent_image` of **KSampler (Advanced)** (first pass).
- Step 9, **The second pass**:
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the second pass) into `model` of **KSampler (Advanced)** (second pass) (a LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler (Advanced)** (second pass).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler (Advanced)** (second pass).
  - `LATENT` of **KSampler (Advanced)** (first pass) into `latent_image` of **KSampler (Advanced)** (second pass).
- Step 10, **Set up the first sampler**:
  - `add_noise` of **KSampler (Advanced)** (first pass) is `enable`. Why: the first sampler starts from pure noise, so it is the one that adds the noise.
  - `steps` of **KSampler (Advanced)** (first pass) is from 4 to 60; **Do this for me** sets 20. Why: twenty steps are split between two passes; with another number the hand-over moves.
  - `cfg` of **KSampler (Advanced)** (first pass) is from 1 to 4; **Do this for me** sets 3.5. Why: a high cfg burns a Wan 2.2 clip. The ComfyUI templates use 3.5.
  - `start_at_step` of **KSampler (Advanced)** (first pass) is `0`. Why: the first sampler starts at the very beginning, step 0.
  - `end_at_step` of **KSampler (Advanced)** (first pass) is from 1 to 15; **Do this for me** sets 10. Why: at this step the first model hands the clip to the second. The ComfyUI templates split twenty steps in half.
  - `end_at_step` of **KSampler (Advanced)** (first pass) is below `steps` of **KSampler (Advanced)** (first pass). Why: if the first sampler stops no earlier than its last step, it does everything itself and leaves the second nothing to finish.
  - `return_with_leftover_noise` of **KSampler (Advanced)** (first pass) is `enable`. Why: without the noise that is left, the second sampler gets a clip that is already clean and has nothing to finish.
- Step 11, **Set up the second sampler**:
  - `add_noise` of **KSampler (Advanced)** (second pass) is `disable`. Why: the clip already holds noise from the first sampler; adding it again breaks the clip.
  - `steps` of **KSampler (Advanced)** (second pass) equals `steps` of **KSampler (Advanced)** (first pass). Why: both samplers count the same steps, or the hand-over between them does not line up.
  - `cfg` of **KSampler (Advanced)** (second pass) is from 1 to 4; **Do this for me** sets 3.5. Why: a high cfg burns a Wan 2.2 clip. The ComfyUI templates use 3.5.
  - `start_at_step` of **KSampler (Advanced)** (second pass) equals `end_at_step` of **KSampler (Advanced)** (first pass). Why: the second sampler goes on from the step the first one stopped at. Otherwise some steps are lost or done twice.
  - `return_with_leftover_noise` of **KSampler (Advanced)** (second pass) is `disable`. Why: the second sampler finishes the clip; there is no one to hand leftover noise to.
- Step 12, **Turn the result into frames**:
  - a **VAE Decode** node.
  - `LATENT` of **KSampler (Advanced)** (second pass) into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
- Step 13, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`. Why: wan draws 16 frames per second. With another number the clip runs faster or slower than it was meant to.

## Mistakes people make
- `i2v` files in a text to video graph, or the same file in both loaders.
- Forgetting `return_with_leftover_noise` on the first sampler: the second gets a clean clip and has nothing to finish.
- `start_at_step` of the second not equal to `end_at_step` of the first: steps lost or done twice.
- `fps` other than 16: the clip runs too fast or too slow.

## What next
These lessons go on from this one: [A prompt for video](Prompt-Video.md), [Video from a picture](Video-Image.md), [LoRA: add a style or a subject](LoRA.md), [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md).

## See also
- [How lessons work](How-Lessons-Work.md)
- [Video models](../concepts/Video-Models.md)
- [Wan 2.2 two passes](../concepts/Wan-Two-Passes.md)
- [Video length and frame rate](../concepts/Video-Length-And-Frame-Rate.md)
- [Wan 2.2](../concepts/Family-Wan22.md)
- [Scheduler](../concepts/Scheduler.md)
