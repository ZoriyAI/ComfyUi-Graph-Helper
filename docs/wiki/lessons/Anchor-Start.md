[Русский](Anchor-Start.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The start picture is the anchor

<!-- lesson: anchor-start -->
Lesson "anchor-start", in the group **Video: the anchor picture** of the lesson list. Steps: 9.

## Consent first
Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Your picture becomes the first frame of the clip, and you know how to trade motion for likeness.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `ti2v` and `5b`.
- Nodes: Load Diffusion Model, Wan22ImageToVideoLatent, CLIP Text Encode (Prompt), KSampler, Load Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Before you start** (reading)

   Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. Exclude anyone under 18 or who appears underage; label synthetic depictions so they do not mislead others. The lessons teach technique in factual, non-graphic terms.

   The first lesson of the thread "the anchor picture": how to keep a person or a scene the same through a video. The simplest anchor is the start image. It goes on the graph of "Video on a modest graphics card" and costs the same: a card with 8 GB with offloading, minutes per five-second clip.

2. **The graph of the small model is needed**

   The canvas must hold the graph of "Video on a modest graphics card": **Load Diffusion Model**, **Wan22ImageToVideoLatent**, the prompt **CLIP Text Encode (Prompt)** and **KSampler**. If it is not there, do that lesson first.

3. **Connect the anchor picture**

   Add a **Load Image** node, choose your image in `image`, and connect its `IMAGE` output to the `start_image` input of **Wan22ImageToVideoLatent**.

   The template has this very node, switched off. Connected, it makes the first frame of the clip.

4. **What the anchor holds, and what it does not** (reading)

   It holds the first frame exactly: the face, the clothes, the light, the place. It also sets the look of the whole clip, because every later frame grows out of it.

   It does not hold identity by itself. The further the clip moves from the first frame (a head turning away, a walk out of the frame, many seconds), the more the model draws from its own idea of a person, and the face drifts. This is called identity drift.

5. **A shorter clip keeps the likeness**

   In **Wan22ImageToVideoLatent** set `length` to 81: about three and a half seconds at 24 fps.

   Drift grows with every frame. A short clip that stays close to the anchor keeps the person; a long one is better made in parts (the lesson "A longer video in parts").

6. **Motion against likeness** (reading)

   Three things trade motion for likeness:
   - the length of the clip, as in the last step;
   - the shift of the model: the template has 8; a lower value, such as 5, usually gives calmer motion that stays nearer to the picture. Compare on your own image;
   - the motion you ask for: a turn of the head or a smile keeps a face, a dance or a run lets it drift.

   Some families have a strength for the image conditioning; Wan has none, so these three are the levers here.

7. **Describe the motion, not the picture**

   In the `text` field of **CLIP Text Encode (Prompt)** describe what happens: who moves, how, what the camera does. "She turns her head to the window and smiles, the camera slowly moves closer."

   The picture already says what is in the frame. Describing it again pulls the model towards drawing that prompt, and the clip may jump away from your image or stay still.

8. **A character LoRA together with the anchor** (reading)

   A LoRA trained on a character holds the face where the anchor alone lets it drift. It goes between the model loader and the shift, as in the lesson "LoRA: add a style or a subject".

   With the small model there is one LoRA file. With the large Wan 2.2 pair a character LoRA comes as two files: the `high` one goes into the path of the `high_noise` model, which lays out the composition and the motion; the `low` one into the path of the `low_noise` model, which draws the detail, and the face with it. If only one file exists, the likeness comes mostly from the low-noise pass.

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Next in the thread: "Two anchors: first and last frame".

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The graph of the small model is needed**:
  - a **Load Diffusion Model** node.
  - a **Wan22ImageToVideoLatent** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - `LATENT` of **Wan22ImageToVideoLatent** into `latent_image` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **KSampler**.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `ti2v` and `5b` (capitals, dots and dashes do not matter).
- Step 3, **Connect the anchor picture**:
  - a **Load Image** node.
  - `IMAGE` of **Load Image** into `start_image` of **Wan22ImageToVideoLatent** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `image` of **Load Image**: a value is chosen.
- Step 5, **A shorter clip keeps the likeness**:
  - `length` of **Wan22ImageToVideoLatent** is from 49 to 121; **Do this for me** sets 81.
- Step 7, **Describe the motion, not the picture**:
  - `text` of **CLIP Text Encode (Prompt)** holds at least 40 characters.

## What next
These lessons go on from this one: [Two anchors: first and last frame](First-And-Last-Frame.md).

## See also
- [Wan 2.2](../concepts/Family-Wan22.md)
- [Video generation](../concepts/Video-Models.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
