[Русский](Audio-Foley.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Sound for a silent video: MMAudio

<!-- lesson: audio-foley -->
Lesson "audio-foley", in the group **Sound and speech** of the lesson list. Steps: 10.

## What you will be able to do
You build a graph that listens to the frames of a silent clip and gives it a sound in time with them.

## What you need
- Node packs: **ComfyUI-MMAudio**, **ComfyUI-VideoHelperSuite**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Model files the lesson checks:
  - for `mmaudio_model` of **MMAudio ModelLoader**: a file whose name has `44k`;
  - for `vae_model` of **MMAudio FeatureUtilsLoader**: a file whose name has `44k`.
- Nodes: Load Video (Upload) 🎥🅥🅗🅢, MMAudio ModelLoader, MMAudio FeatureUtilsLoader, MMAudio Sampler, Video Combine 🎥🅥🅗🅢.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What MMAudio does** (reading)

   MMAudio watches a clip and makes the sound of what happens in it: steps, splashes, the engine of a passing car. The sound falls in time with the picture.

   This is how a clip made by a video model gets its sound. A short text can steer the result, but the frames lead.

   The nodes of this lesson come from the ComfyUI-MMAudio pack. A pack runs other people's code on your computer: install it yourself through ComfyUI's manager, and only a pack you trust. The frames are loaded and the clip is put together by the ComfyUI-VideoHelperSuite pack, as in the pack's own example.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the clip**

   Add a **Load Video (Upload) 🎥🅥🅗🅢** node and choose the clip in its `video` field.

   The model hears about 8 seconds best. For a longer clip, set `frame_load_cap` so that only the part you need is read.

3. **Load the model**

   Add a **MMAudio ModelLoader** node and choose the file in `mmaudio_model`. The pack's example uses `mmaudio_large_44k_v2_fp16.safetensors`.

   All the files of this lesson lie in the folder models/mmaudio, which the pack adds to ComfyUI. Take them from the model's official page, the one the pack's prompt names.

4. **Load the helper models**

   Add a **MMAudio FeatureUtilsLoader** node. It loads three small models in three fields:
   - `vae_model`: the decoder of the sound, `mmaudio_vae_44k_fp16.safetensors`;
   - `synchformer_model`: the one that matches the sound to the frames, `mmaudio_synchformer_fp16.safetensors`;
   - `clip_model`: the one that sees what is in the frames, `apple_DFN5B-CLIP-ViT-H-14-384_fp16.safetensors`.

   Set `mode` to `44k`. The large model and its decoder work at 44 kHz; with `16k` they do not fit together.

   Files in the old formats (.ckpt, .pt, .pth, .bin) can run code when they are loaded. Take them only from the model's official page.

5. **Add the sampler**

   Add a **MMAudio Sampler** node and connect three inputs:
   - `mmaudio_model` from **MMAudio ModelLoader**;
   - `feature_utils` from **MMAudio FeatureUtilsLoader**;
   - `images` from the `IMAGE` output of **Load Video (Upload) 🎥🅥🅗🅢**.

   The frames go straight from the loader into the sampler: the model watches them.

6. **Set the length and the steps**

   In **MMAudio Sampler** set:
   - `duration`: 8, the length of the sound in seconds; the clip and the sound must be equally long;
   - `steps`: 25;
   - `cfg`: 4.5.

   These are the pack's own values. In the example `duration` comes from a node that measures the clip; you may type it by hand.

7. **A prompt, if you want one** (reading)

   The `prompt` field may stay empty: the model hears the frames. A few words help when the frames say little: "rain on leaves", "crowd in a stadium". The `negative_prompt` field takes what must not be heard, for example "music, speech".

   `mask_away_clip` switches off the model's look at the frames. Leave it off unless you want sound from the text alone.

8. **Put the sound into the clip**

   Add a **Video Combine 🎥🅥🅗🅢** node. Connect the `IMAGE` output of **Load Video (Upload) 🎥🅥🅗🅢** to its `images` input and the `audio` output of **MMAudio Sampler** to its `audio` input.

   Set its `frame_rate` to the frame rate of your clip, otherwise the picture runs faster or slower than the sound. In ComfyUI the finished clip goes into the output folder.

9. **When the sound is bad** (reading)

   - The sound lags behind the picture: `frame_rate` in **Video Combine 🎥🅥🅗🅢** is not the frame rate of the clip.
   - The sound is wrong for the scene: write two or three words in `prompt`.
   - The sound stops before the clip ends: `duration` is shorter than the clip.
   - Not enough memory: shorter pieces, or `force_offload` left on.

   The ComfyUI-HunyuanVideo-Foley pack does the same job with a larger model. Its files go into models/foley.

10. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the clip**:
  - a **Load Video (Upload) 🎥🅥🅗🅢** node.
  - `video` of **Load Video (Upload) 🎥🅥🅗🅢**: a value is chosen.
- Step 3, **Load the model**:
  - a **MMAudio ModelLoader** node.
  - `mmaudio_model` of **MMAudio ModelLoader** holds a file whose name has `44k` (capitals, dots and dashes do not matter).
- Step 4, **Load the helper models**:
  - a **MMAudio FeatureUtilsLoader** node.
  - `vae_model` of **MMAudio FeatureUtilsLoader** holds a file whose name has `44k` (capitals, dots and dashes do not matter).
  - `synchformer_model` of **MMAudio FeatureUtilsLoader** is not the same file as `vae_model` of **MMAudio FeatureUtilsLoader**.
  - `clip_model` of **MMAudio FeatureUtilsLoader** is not the same file as `synchformer_model` of **MMAudio FeatureUtilsLoader**.
  - `mode` of **MMAudio FeatureUtilsLoader** is `44k`.
- Step 5, **Add the sampler**:
  - a **MMAudio Sampler** node.
  - `mmaudio_model` of **MMAudio ModelLoader** into `mmaudio_model` of **MMAudio Sampler**.
  - `mmaudio_featureutils` of **MMAudio FeatureUtilsLoader** into `feature_utils` of **MMAudio Sampler**.
  - `IMAGE` of **Load Video (Upload) 🎥🅥🅗🅢** into `images` of **MMAudio Sampler**.
- Step 6, **Set the length and the steps**:
  - `duration` of **MMAudio Sampler** is from 1 to 10; **Do this for me** sets 8.
  - `steps` of **MMAudio Sampler** is from 20 to 30; **Do this for me** sets 25.
  - `cfg` of **MMAudio Sampler** is from 3 to 6; **Do this for me** sets 4.5.
- Step 8, **Put the sound into the clip**:
  - a **Video Combine 🎥🅥🅗🅢** node.
  - `IMAGE` of **Load Video (Upload) 🎥🅥🅗🅢** into `images` of **Video Combine 🎥🅥🅗🅢**.
  - `audio` of **MMAudio Sampler** into `audio` of **Video Combine 🎥🅥🅗🅢**.

## See also
- [Audio](../concepts/Audio.md)
- [Video generation](../concepts/Video-Models.md)
- [How lessons work](How-Lessons-Work.md)
