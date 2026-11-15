[Русский](Audio-Sound.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A sound from text: Stable Audio

<!-- lesson: audio-sound -->
Lesson "audio-sound", in the group **Sound and speech** of the lesson list. Steps: 10.

## What you will be able to do
You build a graph that makes a sound effect or a short piece of music from a prompt.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `ckpt_name` of **Load Checkpoint**: a file whose name has `stable` and `audio`;
  - for `clip_name` of **Load CLIP**: a file whose name has `t5` and `base`.
- Nodes: Load Checkpoint, Load CLIP, CLIP Text Encode (Prompt), Empty Latent Audio, KSampler, VAE Decode Audio, Save Audio (Advanced) / SaveAudio / SaveAudioMP3 / PreviewAudio.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What Stable Audio makes** (reading)

   Stable Audio Open 1.0 makes short sounds from text: rain on a roof, footsteps in snow, a drum loop, a pad for a background. It does not sing and does not speak.

   The graph is the graph of a first picture with a separate text reader and a decoder for sound.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add a **Load Checkpoint** node and choose `stable-audio-open-1.0.safetensors` in `ckpt_name`. The file lies in models/checkpoints.

   This file holds the part that draws the sound and its decoder. The text reader is not inside: it comes from its own file in the next step.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the template "Stable Audio 1.0: Text to Audio": it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the text reader**

   Add a **Load CLIP** node. In `clip_name` choose `t5-base.safetensors` from models/text_encoders, and set `type` to `stable_audio`.

   The type tells ComfyUI how the reader is built. With another type the file loads, but the model gets a prompt it cannot use.

4. **Describe the sound**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load CLIP** to the `clip` input of each.

   In the `text` field of the first write what should be heard, in plain words: heavy rain on a tin roof, distant thunder. The second may stay empty or list what is not wanted.

   Say the kind of sound, the place and the mood. For music add the genre and the tempo, for example 120 BPM.

5. **Say how long the sound is**

   Add a **Empty Latent Audio** node and set `seconds`. For a sound effect 10 seconds is plenty.

   The model was trained on pieces of up to 47 seconds. A longer blank gives silence or noise at the end.

6. **Add the sampler**

   Add a **KSampler** node and connect four inputs:
   - `model` from **Load Checkpoint**;
   - `positive` and `negative` from the two text nodes;
   - `latent_image` from **Empty Latent Audio**.

   Set `steps` to 50 and `cfg` to 5. The official template uses 50 steps and a `cfg` near 5, with `sampler_name` set to `dpmpp_3m_sde_gpu` and `scheduler` to `exponential`. Set those two in ComfyUI as well if your list has them.

7. **Turn the result into sound**

   Add a **VAE Decode Audio** node. Connect the output of **KSampler** to its `samples` input and the `VAE` output of **Load Checkpoint** to its `vae` input.

8. **Save the sound**

   Add a **Save Audio (Advanced)** node and connect the output of **VAE Decode Audio** to its `audio` input. In ComfyUI the file goes into output/audio.

9. **When the sound is bad** (reading)

   - Mush instead of a clear sound: describe one sound, not a whole scene.
   - Noise at the end: the blank is longer than the sound you described; shorten `seconds`.
   - Too quiet or too thin: add words about the recording, such as close, studio, clean.

   The model makes sounds, not speech. For speech there is the lesson "Speech from text: Chatterbox".

10. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint** holds a file whose name has `stable` and `audio` (capitals, dots and dashes do not matter).
- Step 3, **Load the text reader**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `t5` and `base` (capitals, dots and dashes do not matter).
  - `type` of **Load CLIP** is `stable_audio`.
- Step 4, **Describe the sound**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 10 characters.
- Step 5, **Say how long the sound is**:
  - a **Empty Latent Audio** node.
  - `seconds` of **Empty Latent Audio** is from 1 to 47; **Do this for me** sets 10.
- Step 6, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler**.
  - `LATENT` of **Empty Latent Audio** into `latent_image` of **KSampler**.
  - `steps` of **KSampler** is from 25 to 100; **Do this for me** sets 50.
  - `cfg` of **KSampler** is from 3 to 7; **Do this for me** sets 5.
- Step 7, **Turn the result into sound**:
  - a **VAE Decode Audio** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode Audio**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode Audio**.
- Step 8, **Save the sound**:
  - a **Save Audio (Advanced)** or **SaveAudio** or **SaveAudioMP3** or **PreviewAudio** node.
  - `AUDIO` of **VAE Decode Audio** into `audio` of **Save Audio (Advanced)** or **SaveAudio** or **SaveAudioMP3** or **PreviewAudio**.

## See also
- [Audio](../concepts/Audio.md)
- [How lessons work](How-Lessons-Work.md)
