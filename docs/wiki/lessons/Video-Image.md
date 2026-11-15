[Русский](Video-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from a picture

<!-- lesson: video-image -->
Lesson "video-image", in the group **Video** of the lesson list. Steps: 15.

## What you will be able to do
You bring a finished picture to life: it becomes the first frame of the clip.

## What you need
- It goes on from [Video from text](Video-Text.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - the high_noise half of Wan 2.2 image to video (i2v): `models/diffusion_models`, for example `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors`;
  - the low_noise half of Wan 2.2 image to video (i2v): `models/diffusion_models`, for example `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Load Image, WanImageToVideo, KSampler (Advanced), VAE Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What is different** (reading)

   Here the clip starts from your picture. The prompt no longer says what is in the frame but what happens in it.

   The graph is almost the one from "Video from text". If it is on your canvas, most steps are already done and the app goes straight to the new ones.

   Three things change: the model files, a node with the picture and a node that prepares the start.

2. **Choose the models for a picture**

   Two **Load Diffusion Model** nodes are needed. In the `unet_name` field of one choose the `i2v` file with `high_noise` in its name, in the other the `i2v` file with `low_noise`. `i2v` means "image to video".

   The `t2v` models of the last lesson do not take a picture.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the ready Wan 2.2 "image to video" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text reader**

   A **Load CLIP** node is needed, with the `umt5_xxl` file in `clip_name` and `wan` in `type`. It is the same as for video from text.

4. **The VAE**

   A **Load VAE** node is needed, with the `wan_2.1_vae` file in `vae_name`.

   Here it works twice: it reads your picture at the start and puts the frames together at the end.

5. **Describe the motion**

   Two **CLIP Text Encode (Prompt)** nodes are needed, with their `clip` input connected from **Load CLIP**. In the `text` field of one describe what happens: who moves and how, what the camera does.

   What the picture already shows need not be repeated.

6. **The noise shift**

   Two **ModelSamplingSD3** nodes are needed, one for each model, with `shift` from 5 to 8. The `MODEL` output of each loader goes into the `model` input of its node.

7. **Load the picture**

   Add a **Load Image** node and choose your picture in its `image` field. The list shows the files of the `input` folder of your ComfyUI.

   This picture becomes the first frame. The model keeps it best when the clip has the proportions of the picture.

8. **Prepare the start**

   Add a **WanImageToVideo** node and connect to it:
   - to `positive` and `negative`, the two texts;
   - to `vae`, the output of **Load VAE**;
   - to `start_image`, the `IMAGE` output of **Load Image**.

   Set `width` to 832, `height` to 480 and `length` to 81.

   This node puts your picture into the blank of the clip and into both texts. That is why the samplers take the texts from its outputs from here on, and not directly.

9. **The first pass**

   A **KSampler (Advanced)** node is needed. Its `model` input takes the `high_noise` model through its **ModelSamplingSD3** node. Its `positive`, `negative` and `latent_image` inputs take the three outputs of **WanImageToVideo**: `positive`, `negative` and `latent`.

   A sampler left connected to the texts directly does not learn of the picture and draws the clip from nothing.

   The node with the blank from "Video from text" is connected to nothing after this. It can be deleted.

10. **The second pass**

   A second **KSampler (Advanced)** node is needed. Its `model` input takes the `low_noise` model through **ModelSamplingSD3**. Its `positive` and `negative` inputs take the same outputs of **WanImageToVideo**, and `latent_image` takes the output of the first sampler.

11. **Set up the first sampler**

   In the first sampler set:
   - `add_noise`: `enable`;
   - `steps`: 20;
   - `cfg`: 3.5;
   - `start_at_step`: 0 and `end_at_step`: 10;
   - `return_with_leftover_noise`: `enable`.

   It does the first half of twenty steps and hands the clip over with the noise that is left. Without the last setting the second sampler gets a clip that is already clean and has nothing to finish.

12. **Set up the second sampler**

   In the second sampler set:
   - `add_noise`: `disable`;
   - `steps` and `cfg`: as in the first;
   - `start_at_step`: 10, the very step the first one stopped at;
   - `return_with_leftover_noise`: `disable`.

   The noise is already there and must not be added twice. If `start_at_step` differs from the first sampler's `end_at_step`, some steps are lost or done twice.

13. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the second sampler's output to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the clip in a compressed form. This node unfolds it into frames.

14. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 16.

   Wan draws 16 frames a second. With another number the clip runs faster or slower than it was meant to.

15. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the clip stands still, add action and camera motion to the prompt. If a figure or a face drifts towards the end, shorten `length` or describe a calmer motion.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Choose the models for a picture**:
  - a **Load Diffusion Model** node.
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** (first pass) holds the high_noise half of Wan 2.2 image to video (i2v); such a file lies in `models/diffusion_models`, for example `wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors`.
  - `unet_name` of **Load Diffusion Model** (second pass) is not the same file as `unet_name` of **Load Diffusion Model** (first pass).
  - `unet_name` of **Load Diffusion Model** (second pass) holds the low_noise half of Wan 2.2 image to video (i2v); such a file lies in `models/diffusion_models`, for example `wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors`.
- Step 3, **The text reader**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - `type` of **Load CLIP** is `wan`. Why: the `type` field tells the node which model the text is for. With another value Wan gets nonsense.
- Step 4, **The VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds the Wan 2.1 VAE (wan_2.1_vae); such a file lies in `models/vae`, for example `wan_2.1_vae.safetensors`.
- Step 5, **Describe the motion**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters and 2 real words.
- Step 6, **The noise shift**:
  - a **ModelSamplingSD3** node.
  - a **ModelSamplingSD3** node.
  - `MODEL` of **Load Diffusion Model** (first pass) into `model` of **ModelSamplingSD3** (shift of the first pass) (a LoraLoaderModelOnly in between is accepted).
  - `MODEL` of **Load Diffusion Model** (second pass) into `model` of **ModelSamplingSD3** (shift of the second pass) (a LoraLoaderModelOnly in between is accepted).
  - `shift` of **ModelSamplingSD3** (shift of the first pass) is from 5 to 8; **Do this for me** sets 8. Why: with a small shift Wan holds composition and motion worse, and the clip comes out sluggish.
  - `shift` of **ModelSamplingSD3** (shift of the second pass) is from 5 to 8; **Do this for me** sets 8. Why: with a small shift Wan holds composition and motion worse, and the clip comes out sluggish.
- Step 7, **Load the picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 8, **Prepare the start**:
  - a **WanImageToVideo** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **WanImageToVideo**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **WanImageToVideo**.
  - `VAE` of **Load VAE** into `vae` of **WanImageToVideo**.
  - `IMAGE` of **Load Image** into `start_image` of **WanImageToVideo**.
  - `length` of **WanImageToVideo** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
- Step 9, **The first pass**:
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the first pass) into `model` of **KSampler (Advanced)** (first pass) (a LoraLoaderModelOnly in between is accepted).
  - `positive` of **WanImageToVideo** into `positive` of **KSampler (Advanced)** (first pass).
  - `negative` of **WanImageToVideo** into `negative` of **KSampler (Advanced)** (first pass).
  - `latent` of **WanImageToVideo** into `latent_image` of **KSampler (Advanced)** (first pass).
- Step 10, **The second pass**:
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the second pass) into `model` of **KSampler (Advanced)** (second pass) (a LoraLoaderModelOnly in between is accepted).
  - `positive` of **WanImageToVideo** into `positive` of **KSampler (Advanced)** (second pass).
  - `negative` of **WanImageToVideo** into `negative` of **KSampler (Advanced)** (second pass).
  - `LATENT` of **KSampler (Advanced)** (first pass) into `latent_image` of **KSampler (Advanced)** (second pass).
- Step 11, **Set up the first sampler**:
  - `add_noise` of **KSampler (Advanced)** (first pass) is `enable`. Why: the first sampler starts from pure noise, so it is the one that adds the noise.
  - `steps` of **KSampler (Advanced)** (first pass) is from 4 to 60; **Do this for me** sets 20. Why: twenty steps are split between two passes; with another number the hand-over moves.
  - `cfg` of **KSampler (Advanced)** (first pass) is from 1 to 4; **Do this for me** sets 3.5. Why: a high cfg burns a Wan 2.2 clip. The ComfyUI templates use 3.5.
  - `start_at_step` of **KSampler (Advanced)** (first pass) is `0`. Why: the first sampler starts at the very beginning, step 0.
  - `end_at_step` of **KSampler (Advanced)** (first pass) is from 1 to 15; **Do this for me** sets 10. Why: at this step the first model hands the clip to the second. The ComfyUI templates split twenty steps in half.
  - `end_at_step` of **KSampler (Advanced)** (first pass) is below `steps` of **KSampler (Advanced)** (first pass). Why: if the first sampler stops no earlier than its last step, it does everything itself and leaves the second nothing to finish.
  - `return_with_leftover_noise` of **KSampler (Advanced)** (first pass) is `enable`. Why: without the noise that is left, the second sampler gets a clip that is already clean and has nothing to finish.
- Step 12, **Set up the second sampler**:
  - `add_noise` of **KSampler (Advanced)** (second pass) is `disable`. Why: the clip already holds noise from the first sampler; adding it again breaks the clip.
  - `steps` of **KSampler (Advanced)** (second pass) equals `steps` of **KSampler (Advanced)** (first pass). Why: both samplers count the same steps, or the hand-over between them does not line up.
  - `cfg` of **KSampler (Advanced)** (second pass) is from 1 to 4; **Do this for me** sets 3.5. Why: a high cfg burns a Wan 2.2 clip. The ComfyUI templates use 3.5.
  - `start_at_step` of **KSampler (Advanced)** (second pass) equals `end_at_step` of **KSampler (Advanced)** (first pass). Why: the second sampler goes on from the step the first one stopped at. Otherwise some steps are lost or done twice.
  - `return_with_leftover_noise` of **KSampler (Advanced)** (second pass) is `disable`. Why: the second sampler finishes the clip; there is no one to hand leftover noise to.
- Step 13, **Turn the result into frames**:
  - a **VAE Decode** node.
  - `LATENT` of **KSampler (Advanced)** (second pass) into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
- Step 14, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`. Why: wan draws 16 frames per second. With another number the clip runs faster or slower than it was meant to.

## Mistakes people make
- `t2v` files: the picture is ignored.
- Samplers still connected to the text nodes directly: the clip is drawn from nothing.
- A portrait picture into a landscape clip: cropped edges. Match proportions.
- Repeating the picture's description in the prompt: say what moves instead.

## What next
These lessons go on from this one: [Two models in one graph](Two-Models.md), [A portrait that speaks: HuMo](Video-Speech.md).

## See also
- [How lessons work](How-Lessons-Work.md)
- [Video models](../concepts/Video-Models.md)
- [Conditioning](../concepts/Conditioning.md)
- [Wan 2.2](../concepts/Family-Wan22.md)
- [A prompt for video](Prompt-Video.md)
