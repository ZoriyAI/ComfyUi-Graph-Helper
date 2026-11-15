[Русский](Audio-Speech.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Speech from text: Chatterbox

<!-- lesson: audio-speech -->
Lesson "audio-speech", in the group **Sound and speech** of the lesson list. Steps: 7.

## Consent first
Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain the speaker's consent and permission for the source material, and follow local law. Do not put a real person's voice into explicit content, and exclude anyone who is or appears to be a minor. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You build a graph that reads your text aloud in the voice of a short recording.

## What you need
- Node packs: **ComfyUI_Fill-ChatterBox**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Nodes: Load Audio, FL Chatterbox TTS, Save Audio (Advanced) / SaveAudio / SaveAudioMP3 / PreviewAudio.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **First, about voices** (reading)

   Chatterbox reads a text aloud. Given a recording of a voice, it speaks in that voice.

   Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain the speaker's consent and permission for the source material, and follow local law. Do not put a real person's voice into explicit content, and exclude anyone who is or appears to be a minor.

   The nodes of this lesson come from the ComfyUI_Fill-ChatterBox pack. A pack runs other people's code on your computer: install it yourself through ComfyUI's manager, and only a pack you trust. The pack itself downloads its models to models/chatterbox the first time the graph runs in ComfyUI.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the voice**

   Add a **Load Audio** node and choose the recording in its `audio` field. Your own voice is the simplest choice.

   The pack's authors advise at least 5 to 6 seconds of clean speech: one voice, no music, no echo. The model copies everything it hears, the noise too.

3. **Write what is said**

   Add a **FL Chatterbox TTS** node. Connect the output of **Load Audio** to its `audio_prompt` input and write the words in its `text` field.

   Without a recording the node speaks in its own voice. With one it imitates the recording.

   Write as people speak: punctuation sets the pauses. This node speaks English. For other languages the pack has a multilingual node with the same inputs.

4. **Set the manner of speech**

   Set three numbers in **FL Chatterbox TTS**:
   - `exaggeration`: 0.5, how lively the speech is; higher is more expressive and less steady;
   - `cfg_weight`: 0.5, how closely the model follows the recording; lower is slower and calmer;
   - `temperature`: 0.8, how much the readings differ from run to run.

   The template keeps all three at these values. Start there and move one number at a time.

5. **Save the speech**

   Add a **Save Audio (Advanced)** node and connect the `audio` output of **FL Chatterbox TTS** to its `audio` input. In ComfyUI the file goes into output/audio.

6. **When the speech is bad** (reading)

   - The voice is not alike: take a longer and cleaner recording.
   - Words are swallowed: split long sentences, add commas.
   - The speech sounds strained: lower `exaggeration` and `cfg_weight`.
   - A long text breaks: the pack's authors give about 40 seconds as the most per run; split the text into parts and join them with Concatenate Audio.

   Set `keep_model_loaded` to true when you make many lines in a row: the model stays in memory between runs.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If you publish the speech, say that the voice was made by a model.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the voice**:
  - a **Load Audio** node.
  - `audio` of **Load Audio**: a value is chosen.
- Step 3, **Write what is said**:
  - a **FL Chatterbox TTS** node.
  - `AUDIO` of **Load Audio** into `audio_prompt` of **FL Chatterbox TTS**.
  - `text` of **FL Chatterbox TTS** holds at least 10 characters.
- Step 4, **Set the manner of speech**:
  - `exaggeration` of **FL Chatterbox TTS** is from 0.25 to 1; **Do this for me** sets 0.5.
  - `cfg_weight` of **FL Chatterbox TTS** is from 0.2 to 1; **Do this for me** sets 0.5.
  - `temperature` of **FL Chatterbox TTS** is from 0.5 to 1.2; **Do this for me** sets 0.8.
- Step 5, **Save the speech**:
  - a **Save Audio (Advanced)** or **SaveAudio** or **SaveAudioMP3** or **PreviewAudio** node.
  - `audio` of **FL Chatterbox TTS** into `audio` of **Save Audio (Advanced)** or **SaveAudio** or **SaveAudioMP3** or **PreviewAudio**.

## See also
- [Audio](../concepts/Audio.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
