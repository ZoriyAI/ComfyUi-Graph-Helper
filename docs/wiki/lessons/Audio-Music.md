[Русский](Audio-Music.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Music from text: ACE-Step 1.5

<!-- lesson: audio-music -->
Lesson "audio-music", in the group **Sound and speech** of the lesson list. Steps: 13.

## What you will be able to do
You build a graph that writes a song from a list of styles and your lyrics.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `ckpt_name` of **Load Checkpoint**: a file whose name has `ace_step`.
- Nodes: Load Checkpoint, ModelSamplingAuraFlow, TextEncodeAceStepAudio1.5, Empty Ace Step 1.5 Latent Audio, ConditioningZeroOut, KSampler, VAE Decode Audio, Save Audio (Advanced) / SaveAudio / SaveAudioMP3 / PreviewAudio.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What ACE-Step makes** (reading)

   ACE-Step 1.5 is a music model. You give it the style in a few words and, if you want singing, the lyrics. It returns a whole song with instruments and voice.

   The graph looks like the one for a picture: a model, a text, an empty blank, a sampler, a decoder. Only the blank and the decoder are made for sound.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add a **Load Checkpoint** node and choose the file in `ckpt_name`. The official template uses `ace_step_1.5_turbo_aio.safetensors` from the folder models/checkpoints.

   "aio" means all in one: the model, its text reader and its decoder are in one file, as in a picture checkpoint.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the template "ACE-Step 1.5 Music Generation AIO": it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Set the noise shift**

   Add a **ModelSamplingAuraFlow** node. Connect the `MODEL` output of **Load Checkpoint** to its `model` input and set `shift` to 3.

   The shift decides how much of the work goes to the rough shape of the song and how much to the details. The template uses 3. With a much smaller number the song comes out muddled.

4. **Describe the style**

   Add a **TextEncodeAceStepAudio1.5** node and connect the `CLIP` output of **Load Checkpoint** to its `clip` input. In the `tags` field write the style: genre, mood, instruments, the kind of voice. For example: calm acoustic folk, warm female vocals, soft guitar, light percussion.

   Short words separated by commas work best. The model learned on such lists.

5. **The lyrics** (reading)

   The `lyrics` field holds the words that are sung. Mark the parts of the song in square brackets on their own lines: [Verse 1], [Chorus], [Bridge]. The model sings the verses one way and the chorus another.

   Write your own words, or words you have the right to use. The field `language` says in which language they are sung.

   The official template fills this field with a whole song. Read it in ComfyUI to see the form.

6. **Set the tempo**

   In **TextEncodeAceStepAudio1.5** set `bpm`, the number of beats a minute, for example 120.

   Slow ballads sit near 70, dance music near 120 to 130. If the tempo argues with the style ("slow ballad" at 180), the model hears two different wishes and mixes them.

7. **Say how long the song is**

   Add a **Empty Ace Step 1.5 Latent Audio** node and set `seconds` to 120, two minutes. Then set `duration` in **TextEncodeAceStepAudio1.5** to the same number.

   The blank sets the real length, the text tells the model how long the song it plans is. When the two numbers differ, the song ends too early or breaks off.

8. **An empty negative**

   Add an **ConditioningZeroOut** node and connect the output of **TextEncodeAceStepAudio1.5** to its `conditioning` input.

   This model is not told what to avoid. The sampler still needs something in its `negative` input, and this node gives it the same prompt with everything set to zero.

9. **Add the sampler**

   Add a **KSampler** node and connect four inputs:
   - `model` from **ModelSamplingAuraFlow**;
   - `positive` from **TextEncodeAceStepAudio1.5**;
   - `negative` from **ConditioningZeroOut**;
   - `latent_image` from **Empty Ace Step 1.5 Latent Audio**.

   Set `steps` to 8 and `cfg` to 1. The turbo model is trained to finish in eight steps without the push of a high `cfg`. More steps make it no better, a high `cfg` makes the sound harsh.

10. **Turn the result into sound**

   Add a **VAE Decode Audio** node. Connect the output of **KSampler** to its `samples` input and the `VAE` output of **Load Checkpoint** to its `vae` input.

   The sampler works in a compressed form, as with pictures. This node unfolds it into a sound wave.

11. **Save the song**

   Add a **Save Audio (Advanced)** node and connect the output of **VAE Decode Audio** to its `audio` input.

   In ComfyUI it saves the file into the output/audio folder. Its `format` field chooses the kind of file: `flac` keeps all the quality, `mp3` is smaller and plays everywhere.

12. **When the song is bad** (reading)

   - The style is wrong: put the most important words first in `tags`, and remove words that pull different ways.
   - The voice mumbles: write the lyrics in short lines, one phrase a line, and check `language`.
   - The song stops in the middle: `duration` and `seconds` differ.
   - You like the song but want another take: change `seed` in **TextEncodeAceStepAudio1.5**. The same number gives the same song again.

   The template also comes in a form with separate files: a diffusion model, two text readers and a decoder. The graph is the same, only the loaders differ.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   On a strong graphics card a two-minute song takes seconds; on a weak one, minutes. The first run loads the model and takes longer.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint** holds a file whose name has `ace_step` (capitals, dots and dashes do not matter).
- Step 3, **Set the noise shift**:
  - a **ModelSamplingAuraFlow** node.
  - `MODEL` of **Load Checkpoint** into `model` of **ModelSamplingAuraFlow**.
  - `shift` of **ModelSamplingAuraFlow** is from 2 to 4; **Do this for me** sets 3.
- Step 4, **Describe the style**:
  - a **TextEncodeAceStepAudio1.5** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **TextEncodeAceStepAudio1.5**.
  - `tags` of **TextEncodeAceStepAudio1.5** holds at least 10 characters.
- Step 6, **Set the tempo**:
  - `bpm` of **TextEncodeAceStepAudio1.5** is from 60 to 200; **Do this for me** sets 120.
- Step 7, **Say how long the song is**:
  - a **Empty Ace Step 1.5 Latent Audio** node.
  - `seconds` of **Empty Ace Step 1.5 Latent Audio** is from 10 to 240; **Do this for me** sets 120.
  - `duration` of **TextEncodeAceStepAudio1.5** equals `seconds` of **Empty Ace Step 1.5 Latent Audio**.
- Step 8, **An empty negative**:
  - a **ConditioningZeroOut** node.
  - `CONDITIONING` of **TextEncodeAceStepAudio1.5** into `conditioning` of **ConditioningZeroOut**.
- Step 9, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingAuraFlow** into `model` of **KSampler**.
  - `CONDITIONING` of **TextEncodeAceStepAudio1.5** into `positive` of **KSampler**.
  - `CONDITIONING` of **ConditioningZeroOut** into `negative` of **KSampler**.
  - `LATENT` of **Empty Ace Step 1.5 Latent Audio** into `latent_image` of **KSampler**.
  - `steps` of **KSampler** is `8`.
  - `cfg` of **KSampler** is `1`.
- Step 10, **Turn the result into sound**:
  - a **VAE Decode Audio** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode Audio**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode Audio**.
- Step 11, **Save the song**:
  - a **Save Audio (Advanced)** or **SaveAudio** or **SaveAudioMP3** or **PreviewAudio** node.
  - `AUDIO` of **VAE Decode Audio** into `audio` of **Save Audio (Advanced)** or **SaveAudio** or **SaveAudioMP3** or **PreviewAudio**.

## See also
- [Audio](../concepts/Audio.md)
- [How lessons work](How-Lessons-Work.md)
