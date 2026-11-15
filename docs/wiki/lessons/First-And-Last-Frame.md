[Русский](First-And-Last-Frame.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Two anchors: first and last frame

<!-- lesson: video-flf -->
Lesson "video-flf", in the group **Video: the anchor picture** of the lesson list. Steps: 17.

## Consent first
Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You give two images, and the model draws the clip that goes from the first to the last.

## What you need
- It goes on from [The start picture is the anchor](Anchor-Start.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model** (first pass): a file whose name has `i2v` and `high`;
  - for `unet_name` of **Load Diffusion Model** (second pass): a file whose name has `i2v` and `low`;
  - for `clip_name` of **Load CLIP**: a file whose name has `umt5`;
  - for `vae_name` of **Load VAE**: a file whose name has `wan_2.1_vae`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, CLIP Text Encode (Prompt), ModelSamplingSD3, Load Image, WanFirstLastFrameToVideo, KSampler (Advanced), VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What it costs, first** (reading)

   Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. Exclude anyone under 18 or who appears underage; label synthetic depictions so they do not mislead others. The lessons teach technique in factual, non-graphic terms.

   The clip starts at one image and ends at another; the model invents the motion between them. It suits transformations, a turn of the camera, a day turning to night.

   This is the large Wan 2.2 pair: two 14B models in `i2v` files, about 14 GB each in `fp8`, plus the `umt5_xxl` text encoder and `wan_2.1_vae`. Comfortable with a 24 GB card; with less, ComfyUI moves parts to system memory and the run gets much slower. 81 frames at 20 steps take tens of minutes on a mid-range card. The "Fast video in four steps" lesson cuts that several times over and works on this graph too.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the two image-to-video models**

   Add two **Load Diffusion Model** nodes. In `unet_name` choose the `i2v` file with `high_noise` in its name in one, and the `i2v` file with `low_noise` in the other.

   The first lays out the motion, the second finishes the detail. The `t2v` files do not take images.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "Wan 2.2 14B First-Last Frame to Video" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the text encoder**

   Add a **Load CLIP** node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.

   The text encoder turns the prompt into what the model reads. The `fp8` version of the file takes half the memory of the full one and is what the templates use.

4. **Load the VAE**

   Add a **Load VAE** node and choose the `wan_2.1_vae` file in `vae_name`. The Wan 2.2 models of 14B use the VAE of version 2.1.

5. **Describe the way from one frame to the other**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load CLIP** to the `clip` input of each. In the `text` field of one, describe what happens between the two images: how one becomes the other, how the camera moves. The other is the negative prompt.

6. **Set the shift of both models**

   Add two **ModelSamplingSD3** nodes and pass each model through its own: the loader's `MODEL` output to the `model` input. Set `shift` to 8 in both.

7. **Load the two images**

   Add two **Load Image** nodes. In the `image` field of one choose the image the clip starts with, in the other the one it ends with.

   The two images should have the same proportions and show the same scene or subject. The more they differ, the stranger the motion between them.

8. **Prepare the start and the end**

   Add a **WanFirstLastFrameToVideo** node and connect to it:
   - to `positive` and `negative`, the two prompts;
   - to `vae`, the output of **Load VAE**;
   - to `start_image`, the first image, and to `end_image`, the last.

   Set `width` and `height` to 640 and `length` to 81. The size should have the proportions of your images.

9. **The first pass**

   Add a **KSampler (Advanced)** node. Its `model` input takes the `high_noise` model through its **ModelSamplingSD3** node; its `positive`, `negative` and `latent_image` inputs take the three outputs of **WanFirstLastFrameToVideo**.

10. **The second pass**

   Add a second **KSampler (Advanced)** node. Its `model` input takes the `low_noise` model through its own shift node; `positive` and `negative` take the same outputs of **WanFirstLastFrameToVideo**; `latent_image` takes the output of the first sampler.

11. **Split the steps between the two**

   In the first sampler: `add_noise` `enable`, `steps` 20, `cfg` 4, `start_at_step` 0, `end_at_step` 10, `return_with_leftover_noise` `enable`.

   In the second: `add_noise` `disable`, the same `steps` and `cfg`, `start_at_step` 10 (where the first one stopped), `return_with_leftover_noise` `disable`.

   The first does half of the twenty steps and hands over the noise that is left; the second goes on from that very step.

12. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the sampler's output to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the clip in compressed form, the latent. This node unfolds it into frames.

13. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **VAE Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 16.

   The 14B Wan models draw 16 fps. With another number the clip runs faster or slower than it was meant to.

14. **What the model invents between the anchors** (reading)

   Two anchors fix the first and the last frame. Everything between is the model's: the path of the motion, the turn of a head, what is hidden behind an object. The prompt is your only say in it, so describe the way, not the two pictures again.

   The closer the two images (same light, same proportions, a change one motion can make), the more believable the middle. Two images that differ in everything give a dissolve or a sudden jump instead of motion.

15. **A loop** (reading)

   Put the same image into both Load Image nodes, and describe a motion that comes back: a sway, a breath, waves, a turning wheel. The clip ends where it started and plays in a loop without a seam.

   The app asks for two different files in this lesson; for a loop, copy the image under a second name.

16. **When the result is not right** (reading)

   - The clip jumps to the last frame at the end: lengthen `length` to 121 or describe a slower change.
   - The middle is a blur: the two images differ too much; bring them closer or describe the way between them in more detail.
   - The colours drift: use images of the same light.

17. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the two image-to-video models**:
  - a **Load Diffusion Model** node.
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** (first pass) holds a file whose name has `i2v` and `high` (capitals, dots and dashes do not matter).
  - `unet_name` of **Load Diffusion Model** (second pass) is not the same file as `unet_name` of **Load Diffusion Model** (first pass).
  - `unet_name` of **Load Diffusion Model** (second pass) holds a file whose name has `i2v` and `low` (capitals, dots and dashes do not matter).
- Step 3, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `umt5` (capitals, dots and dashes do not matter).
  - `type` of **Load CLIP** is `wan`.
- Step 4, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds a file whose name has `wan_2.1_vae` (capitals, dots and dashes do not matter).
- Step 5, **Describe the way from one frame to the other**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters.
- Step 6, **Set the shift of both models**:
  - a **ModelSamplingSD3** node.
  - a **ModelSamplingSD3** node.
  - `MODEL` of **Load Diffusion Model** (first pass) into `model` of **ModelSamplingSD3** (shift of the first pass) (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `MODEL` of **Load Diffusion Model** (second pass) into `model` of **ModelSamplingSD3** (shift of the second pass) (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `shift` of **ModelSamplingSD3** (shift of the first pass) is from 5 to 8; **Do this for me** sets 8.
  - `shift` of **ModelSamplingSD3** (shift of the second pass) is from 5 to 8; **Do this for me** sets 8.
- Step 7, **Load the two images**:
  - a **Load Image** node.
  - a **Load Image** node.
  - `image` of **Load Image** (first frame): a value is chosen.
  - `image` of **Load Image** (last frame) is not the same file as `image` of **Load Image** (first frame).
- Step 8, **Prepare the start and the end**:
  - a **WanFirstLastFrameToVideo** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **WanFirstLastFrameToVideo**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **WanFirstLastFrameToVideo**.
  - `VAE` of **Load VAE** into `vae` of **WanFirstLastFrameToVideo**.
  - `IMAGE` of **Load Image** (first frame) into `start_image` of **WanFirstLastFrameToVideo** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `IMAGE` of **Load Image** (last frame) into `end_image` of **WanFirstLastFrameToVideo** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `width` of **WanFirstLastFrameToVideo** is from 480 to 1280; **Do this for me** sets 640.
  - `height` of **WanFirstLastFrameToVideo** is from 480 to 1280; **Do this for me** sets 640.
  - `length` of **WanFirstLastFrameToVideo** is from 49 to 121; **Do this for me** sets 81.
- Step 9, **The first pass**:
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the first pass) into `model` of **KSampler (Advanced)** (first pass) (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **WanFirstLastFrameToVideo** into `positive` of **KSampler (Advanced)** (first pass).
  - `negative` of **WanFirstLastFrameToVideo** into `negative` of **KSampler (Advanced)** (first pass).
  - `latent` of **WanFirstLastFrameToVideo** into `latent_image` of **KSampler (Advanced)** (first pass).
- Step 10, **The second pass**:
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the second pass) into `model` of **KSampler (Advanced)** (second pass) (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **WanFirstLastFrameToVideo** into `positive` of **KSampler (Advanced)** (second pass).
  - `negative` of **WanFirstLastFrameToVideo** into `negative` of **KSampler (Advanced)** (second pass).
  - `LATENT` of **KSampler (Advanced)** (first pass) into `latent_image` of **KSampler (Advanced)** (second pass).
- Step 11, **Split the steps between the two**:
  - `add_noise` of **KSampler (Advanced)** (first pass) is `enable`.
  - `steps` of **KSampler (Advanced)** (first pass) is from 10 to 40; **Do this for me** sets 20.
  - `cfg` of **KSampler (Advanced)** (first pass) is from 1 to 5; **Do this for me** sets 4.
  - `start_at_step` of **KSampler (Advanced)** (first pass) is `0`.
  - `end_at_step` of **KSampler (Advanced)** (first pass) is from 1 to 20; **Do this for me** sets 10.
  - `return_with_leftover_noise` of **KSampler (Advanced)** (first pass) is `enable`.
  - `add_noise` of **KSampler (Advanced)** (second pass) is `disable`.
  - `steps` of **KSampler (Advanced)** (second pass) equals `steps` of **KSampler (Advanced)** (first pass).
  - `cfg` of **KSampler (Advanced)** (second pass) equals `cfg` of **KSampler (Advanced)** (first pass).
  - `start_at_step` of **KSampler (Advanced)** (second pass) equals `end_at_step` of **KSampler (Advanced)** (first pass).
  - `return_with_leftover_noise` of **KSampler (Advanced)** (second pass) is `disable`.
- Step 12, **Turn the result into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler (Advanced)** (second pass) into `samples` of **VAE Decode** or **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)**.
- Step 13, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`.

## What next
These lessons go on from this one: [A reference for the whole clip: Wan VACE](Anchor-Reference.md), [A longer video in parts](Anchor-Parts.md).

## See also
- [First and last frame](../concepts/First-And-Last-Frame.md)
- [Wan 2.2](../concepts/Family-Wan22.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
