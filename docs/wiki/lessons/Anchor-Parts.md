[Русский](Anchor-Parts.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A longer video in parts

<!-- lesson: anchor-parts -->
Lesson "anchor-parts", in the group **Video: the anchor picture** of the lesson list. Steps: 12.

## Consent first
Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Two parts of a clip join through a shared anchor frame into one longer video.

## What you need
- It goes on from [Two anchors: first and last frame](First-And-Last-Frame.md). The card says so; it is a hint, not a lock.
- Nodes: ModelSamplingSD3, CLIP Text Encode (Prompt), Load VAE, Load Image, WanFirstLastFrameToVideo, KSampler (Advanced), VAE Decode / VAE Decode (Tiled), Create Video, Batch Images.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Before you start** (reading)

   Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. Exclude anyone under 18 or who appears underage; label synthetic depictions so they do not mislead others. The lessons teach technique in factual, non-graphic terms.

   A video model makes a few seconds at a time. A longer clip is made in parts, and the frame that ends one part is the anchor that starts the next. This lesson adds a second part to the graph of "Two anchors: first and last frame", as the official template with six key frames does.

   What it costs: each part costs as much as the whole graph before, so two parts take twice the time. The memory stays the same: the parts run one after the other.

2. **The first part is needed**

   The canvas must hold the graph of "Two anchors: first and last frame": the two shift nodes, the prompts, **Load VAE**, the image **Load Image** at the end of the clip, **WanFirstLastFrameToVideo**, the two samplers **KSampler (Advanced)** and **KSampler (Advanced)**, **VAE Decode** and **Create Video**. If it is not there, do that lesson first.

3. **Load the next key frame**

   Add a **Load Image** node and choose in `image` the picture the second part ends with. The last picture of the first part is where the second one starts.

4. **The start of the second part**

   Add a second **WanFirstLastFrameToVideo** node. Connect the prompts and the VAE as for the first; connect **Load Image** to its `start_image` and **Load Image** to its `end_image`. Set `width`, `height` and `length` the same as in the first.

   The shared picture is the seam: the first part ends on it and the second starts on it, so the joint does not jump.

5. **Two passes for the second part**

   Add two more **KSampler (Advanced)** nodes. The first takes the `high_noise` model through its shift node and the three outputs of **WanFirstLastFrameToVideo**; the second takes the `low_noise` model through its own shift node, the prompts of **WanFirstLastFrameToVideo** and the output of the first. The models are loaded once and serve both parts.

6. **The same split of steps**

   Give the new pair the settings of the first part: `add_noise` `enable` and `disable`, the same `steps` and `cfg`, the first stops at the same `end_at_step` where the second has its `start_at_step`, `return_with_leftover_noise` `enable` and `disable`.

7. **The same seed**

   Set `noise_seed` of **KSampler (Advanced)** to the same number as in **KSampler (Advanced)**.

   With the same seed and settings the parts start from the same kind of noise, and colour and texture change less at the seam. A part that went wrong can still be redone with another seed.

8. **Turn the second part into frames**

   Add a **VAE Decode** node. Connect the output of the second new sampler to its `samples` input and the VAE to its `vae` input.

9. **Join the parts**

   Add a **Batch Images** node. Connect the frames of **VAE Decode** to its `image1` input and those of **VAE Decode** to `image2`. Then connect its output to the `images` input of **Create Video** in place of the first part alone.

   The template joins its parts with Batch Images in the same way. The shared key frame appears twice at the seam, which at 16 fps is not seen.

10. **Why colour and face drift from part to part, and what holds them** (reading)

   - Each part only sees its two anchors. Anything they do not show (the back of a head, a hand) is invented again in each part, a little differently.
   - What holds: the same reference for every part (key frames made from one picture, or the same character LoRA), the same prompt words for the subject, the same seed and settings.
   - Colour: a colour-match node after decoding brings every part to the colours of one reference frame. The Color Match node of KJNodes does this; the official SCAIL extension template matches each part to the last frame of the one before.
   - Detail: a light detail pass on the frames, or an upscale of the joined clip (the lesson "A larger, sharper video: SeedVR2"), evens out small differences.

11. **Without key frames: the last frame as the next anchor** (reading)

   When you have no picture for the end of each part, take the last frame of the finished part as the start image of the next one: Image From Batch with `batch_index` -1 and `length` 1 picks it. The next part is plain image to video from that frame.

   Each handover passes through a decoded frame, so small losses add up: after a few parts the face and the colours drift more than with key frames. Keep the chain short, or save each part with Save Video and join the files afterwards in a video editor.

12. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The first part is needed**:
  - a **ModelSamplingSD3** node.
  - a **ModelSamplingSD3** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **Load VAE** node.
  - a **Load Image** node.
  - a **WanFirstLastFrameToVideo** node.
  - a **KSampler (Advanced)** node.
  - a **KSampler (Advanced)** node.
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - a **Create Video** node.
  - `IMAGE` of **Load Image** (last frame of the first part) into `end_image` of **WanFirstLastFrameToVideo** (start of the first part) (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `latent` of **WanFirstLastFrameToVideo** (start of the first part) into `latent_image` of **KSampler (Advanced)** (first part, first pass).
  - `LATENT` of **KSampler (Advanced)** (first part, first pass) into `latent_image` of **KSampler (Advanced)** (first part, second pass).
  - `LATENT` of **KSampler (Advanced)** (first part, second pass) into `samples` of **VAE Decode** or **VAE Decode (Tiled)** (first part).
- Step 3, **Load the next key frame**:
  - a **Load Image** node.
  - `image` of **Load Image** (next key frame) is not the same file as `image` of **Load Image** (last frame of the first part).
- Step 4, **The start of the second part**:
  - a **WanFirstLastFrameToVideo** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **WanFirstLastFrameToVideo** (start of the second part).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **WanFirstLastFrameToVideo** (start of the second part).
  - `VAE` of **Load VAE** into `vae` of **WanFirstLastFrameToVideo** (start of the second part).
  - `IMAGE` of **Load Image** (last frame of the first part) into `start_image` of **WanFirstLastFrameToVideo** (start of the second part) (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `IMAGE` of **Load Image** (next key frame) into `end_image` of **WanFirstLastFrameToVideo** (start of the second part) (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `width` of **WanFirstLastFrameToVideo** (start of the second part) equals `width` of **WanFirstLastFrameToVideo** (start of the first part).
  - `height` of **WanFirstLastFrameToVideo** (start of the second part) equals `height` of **WanFirstLastFrameToVideo** (start of the first part).
  - `length` of **WanFirstLastFrameToVideo** (start of the second part) equals `length` of **WanFirstLastFrameToVideo** (start of the first part).
- Step 5, **Two passes for the second part**:
  - a **KSampler (Advanced)** node.
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the first pass) into `model` of **KSampler (Advanced)** (second part, first pass) (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **WanFirstLastFrameToVideo** (start of the second part) into `positive` of **KSampler (Advanced)** (second part, first pass).
  - `negative` of **WanFirstLastFrameToVideo** (start of the second part) into `negative` of **KSampler (Advanced)** (second part, first pass).
  - `latent` of **WanFirstLastFrameToVideo** (start of the second part) into `latent_image` of **KSampler (Advanced)** (second part, first pass).
  - `MODEL` of **ModelSamplingSD3** (shift of the second pass) into `model` of **KSampler (Advanced)** (second part, second pass) (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **WanFirstLastFrameToVideo** (start of the second part) into `positive` of **KSampler (Advanced)** (second part, second pass).
  - `negative` of **WanFirstLastFrameToVideo** (start of the second part) into `negative` of **KSampler (Advanced)** (second part, second pass).
  - `LATENT` of **KSampler (Advanced)** (second part, first pass) into `latent_image` of **KSampler (Advanced)** (second part, second pass).
- Step 6, **The same split of steps**:
  - `add_noise` of **KSampler (Advanced)** (second part, first pass) is `enable`.
  - `steps` of **KSampler (Advanced)** (second part, first pass) equals `steps` of **KSampler (Advanced)** (first part, first pass).
  - `cfg` of **KSampler (Advanced)** (second part, first pass) equals `cfg` of **KSampler (Advanced)** (first part, first pass).
  - `end_at_step` of **KSampler (Advanced)** (second part, first pass) equals `end_at_step` of **KSampler (Advanced)** (first part, first pass).
  - `return_with_leftover_noise` of **KSampler (Advanced)** (second part, first pass) is `enable`.
  - `add_noise` of **KSampler (Advanced)** (second part, second pass) is `disable`.
  - `steps` of **KSampler (Advanced)** (second part, second pass) equals `steps` of **KSampler (Advanced)** (first part, first pass).
  - `cfg` of **KSampler (Advanced)** (second part, second pass) equals `cfg` of **KSampler (Advanced)** (first part, first pass).
  - `start_at_step` of **KSampler (Advanced)** (second part, second pass) equals `end_at_step` of **KSampler (Advanced)** (second part, first pass).
  - `return_with_leftover_noise` of **KSampler (Advanced)** (second part, second pass) is `disable`.
- Step 7, **The same seed**:
  - `noise_seed` of **KSampler (Advanced)** (second part, first pass) equals `noise_seed` of **KSampler (Advanced)** (first part, first pass).
- Step 8, **Turn the second part into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler (Advanced)** (second part, second pass) into `samples` of **VAE Decode** or **VAE Decode (Tiled)** (second part).
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)** (second part).
- Step 9, **Join the parts**:
  - a **Batch Images** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** (first part) into `image1` of **Batch Images**.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** (second part) into `image2` of **Batch Images**.
  - `IMAGE` of **Batch Images** into `images` of **Create Video**.

## See also
- [First and last frame](../concepts/First-And-Last-Frame.md)
- [Video length and frame rate](../concepts/Video-Length-And-Frame-Rate.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
