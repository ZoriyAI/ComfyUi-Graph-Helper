[Русский](Anchor-Reference.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A reference for the whole clip: Wan VACE

<!-- lesson: anchor-reference -->
Lesson "anchor-reference", in the group **Video: the anchor picture** of the lesson list. Steps: 16.

## Consent first
Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
A person or an object from your picture stays itself in every frame, not only in the first.

## What you need
- It goes on from [Two anchors: first and last frame](First-And-Last-Frame.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `vace`;
  - for `lora_name` of **LoraLoaderModelOnly** or **Load LoRA**: a file whose name has `causvid`;
  - for `clip_name` of **Load CLIP**: a file whose name has `umt5`;
  - for `vae_name` of **Load VAE**: a file whose name has `wan_2.1_vae`.
- Nodes: Load Diffusion Model, LoraLoaderModelOnly / Load LoRA, ModelSamplingSD3, Load CLIP, Load VAE, CLIP Text Encode (Prompt), Load Image, WanVaceToVideo, KSampler, TrimVideoLatent, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Before you start** (reading)

   Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. Exclude anyone under 18 or who appears underage; label synthetic depictions so they do not mislead others. The lessons teach technique in factual, non-graphic terms.

   A start image fixes the first frame. A reference input is read by the model at every frame: the subject of the picture appears in the clip and keeps its look, while the scene, the pose and the camera may be quite different. Wan VACE does this on ComfyUI's own nodes.

   What it costs: the VACE 14B model, about 33 GB in `fp16` (an `fp8` file is half), in `models/diffusion_models`, with the CausVid LoRA in `models/loras`, `umt5_xxl` and `wan_2.1_vae`. Plan on 24 GB of graphics memory or a slow run with parts in system memory. With the LoRA, 4 steps are enough, and an 81-frame clip takes minutes on a large card.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the VACE model**

   Add a **Load Diffusion Model** node and choose the `wan2.1_vace_14B` file in `unet_name`.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "Wan VACE Reference to Video" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Add the CausVid LoRA**

   Add a **LoraLoaderModelOnly** node and connect the output of **Load Diffusion Model** to its `model` input. Choose the CausVid file in `lora_name` and set `strength_model` to 0.3.

   It lets the model finish in 4 steps; at full strength it flattens the motion.

4. **Set the shift**

   Add a **ModelSamplingSD3** node and connect the output of **LoraLoaderModelOnly** to its `model` input. Set `shift` to 8.

5. **Load the text encoder**

   Add a **Load CLIP** node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.

   The text encoder turns the prompt into what the model reads. The `fp8` version of the file takes half the memory of the full one and is what the templates use.

6. **Load the VAE**

   Add a **Load VAE** node and choose `wan_2.1_vae` in `vae_name`. VACE is built on Wan 2.1.

7. **Write the prompt**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load CLIP** to the `clip` input of each. In the `text` field of one, describe the clip: who or what is in the frame, what happens, how the camera moves. The other is the negative prompt: what must not be there.

   For video the action matters most. "A cat jumps onto a windowsill, the camera follows" works better than "a cat on a windowsill".

8. **Load the reference picture**

   Add a **Load Image** node and choose in `image` the picture of the subject: a person, a character, an object.

   A plain background works best: the model takes everything in the picture as part of the subject.

9. **Bring it together**

   Add a **WanVaceToVideo** node and connect to it the two prompts, the VAE, and the picture to `reference_image`. Set `width` and `height` to 768, `length` to 81 and `strength` to 1.

   `strength` is how firmly the reference holds. The other inputs (`control_video`, `control_masks`) stay empty here; in other lessons they carry motion.

10. **Add the sampler**

   Add a **KSampler** node. Its `model` input takes the output of **ModelSamplingSD3**; `positive`, `negative` and `latent_image` take the outputs of **WanVaceToVideo** with the same names.

11. **Set up the sampler**

   Set `steps` to 4, `cfg` to 1 and `sampler_name` to `uni_pc`, as in the template. Without the LoRA the model needs about 20 steps and a `cfg` near 6.

12. **Cut the reference off**

   Add a **TrimVideoLatent** node and connect the output of **KSampler** to its `samples` input. Connect the `trim_latent` output of **WanVaceToVideo** to its `trim_amount` input.

   VACE puts the reference at the start of the clip as extra frames; this node cuts them off, so the picture does not flash at the beginning.

13. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the output of **TrimVideoLatent** to its `samples` input and the VAE to its `vae` input.

14. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 16.

   Wan VACE draws 16 fps. With another number the clip runs faster or slower than it was meant to.

15. **What a reference keeps, and what else does the same** (reading)

   - It keeps the look of the subject: face, hair, clothes, colours. It does not keep the pose or the place of the picture, and it is not the first frame.
   - A face seen small in the reference comes out vague; a close, sharp picture holds better.
   - Other ways to hold a subject through all frames: Wan Animate takes a reference picture and the motion of a video (the lesson "Animation by pose: Wan Animate"); HuMo holds a person while they speak (the lesson "A portrait that speaks: HuMo").
   - The cost: a reference makes the model read more at every step, and the VACE model is large. A clip takes longer than plain image to video.

16. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Next in the thread: "A longer video in parts".

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the VACE model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `vace` (capitals, dots and dashes do not matter).
- Step 3, **Add the CausVid LoRA**:
  - a **LoraLoaderModelOnly** or **Load LoRA** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **LoraLoaderModelOnly** or **Load LoRA**.
  - `lora_name` of **LoraLoaderModelOnly** or **Load LoRA** holds a file whose name has `causvid` (capitals, dots and dashes do not matter).
  - `strength_model` of **LoraLoaderModelOnly** or **Load LoRA** is from 0.2 to 1; **Do this for me** sets 0.3.
- Step 4, **Set the shift**:
  - a **ModelSamplingSD3** node.
  - `MODEL` of **LoraLoaderModelOnly** or **Load LoRA** into `model` of **ModelSamplingSD3** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `shift` of **ModelSamplingSD3** is from 5 to 8; **Do this for me** sets 8.
- Step 5, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `umt5` (capitals, dots and dashes do not matter).
  - `type` of **Load CLIP** is `wan`.
- Step 6, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds a file whose name has `wan_2.1_vae` (capitals, dots and dashes do not matter).
- Step 7, **Write the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters.
- Step 8, **Load the reference picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 9, **Bring it together**:
  - a **WanVaceToVideo** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **WanVaceToVideo**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **WanVaceToVideo**.
  - `VAE` of **Load VAE** into `vae` of **WanVaceToVideo**.
  - `IMAGE` of **Load Image** into `reference_image` of **WanVaceToVideo** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `width` of **WanVaceToVideo** is from 480 to 1280; **Do this for me** sets 768.
  - `height` of **WanVaceToVideo** is from 480 to 1280; **Do this for me** sets 768.
  - `length` of **WanVaceToVideo** is from 49 to 121; **Do this for me** sets 81.
  - `strength` of **WanVaceToVideo** is from 0.5 to 1.5; **Do this for me** sets 1.
- Step 10, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingSD3** into `model` of **KSampler** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **WanVaceToVideo** into `positive` of **KSampler**.
  - `negative` of **WanVaceToVideo** into `negative` of **KSampler**.
  - `latent` of **WanVaceToVideo** into `latent_image` of **KSampler**.
- Step 11, **Set up the sampler**:
  - `steps` of **KSampler** is from 4 to 30; **Do this for me** sets 4.
  - `cfg` of **KSampler** is from 1 to 6; **Do this for me** sets 1.
  - `sampler_name` of **KSampler** is `uni_pc`.
- Step 12, **Cut the reference off**:
  - a **TrimVideoLatent** node.
  - `LATENT` of **KSampler** into `samples` of **TrimVideoLatent**.
  - `trim_latent` of **WanVaceToVideo** into `trim_amount` of **TrimVideoLatent**.
- Step 13, **Turn the result into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `LATENT` of **TrimVideoLatent** into `samples` of **VAE Decode** or **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)**.
- Step 14, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`.

## See also
- [Reference images: IP-Adapter, Redux, editing models](../concepts/Reference-Images.md)
- [LoRA](../concepts/LoRA.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
