[Русский](Audio-Transcribe.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Speech to text: Whisper

<!-- lesson: audio-transcribe -->
Lesson "audio-transcribe", in the group **Sound and speech** of the lesson list. Steps: 7.

## What you will be able to do
You build a graph that writes down what is said in a recording and saves subtitles.

## What you need
- Node packs: **ComfyUI-Whisper**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Nodes: Load Audio, Apply Whisper, Preview as Text, Save SRT.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What Whisper does** (reading)

   Whisper listens to speech and writes it down, with the time of every phrase and word. From that come plain text and subtitles.

   The nodes of this lesson come from the ComfyUI-Whisper pack. A pack runs other people's code on your computer: install it yourself through ComfyUI's manager, and only a pack you trust. The pack downloads the model you choose to models/stt/whisper itself the first time it runs in ComfyUI.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the recording**

   Add a **Load Audio** node and choose the file in its `audio` field.

   The clearer the speech, the fewer mistakes. Music under the voice confuses the model.

3. **Add Whisper**

   Add a **Apply Whisper** node. Connect the output of **Load Audio** to its `audio` input and choose the model in `model`.

   The small models (`tiny`, `base`) are fast and make more mistakes; the large ones (`large-v3`, `turbo`) are slower and much more accurate. Names that end in `.en` know English only. `turbo` is a good start.

   In `language` choose the language of the speech, or leave `auto`. In `prompt` you can list names and rare words that occur in the recording.

4. **Show the text**

   Add a **Preview as Text** node and connect the `text` output of **Apply Whisper** to its `source` input.

   In ComfyUI the node shows the written text right on the canvas.

5. **Save the subtitles**

   Add a **Save SRT** node and connect the `segments_alignment` output of **Apply Whisper** to its `alignment` input. In its `name` field write the name of the file.

   The file goes into output/srt in the SRT format, which every video player and editor reads. The `words_alignment` output gives a line for every word, for subtitles that light up word by word.

6. **Video and mistakes** (reading)

   - To write down a video, load it with Load Video of Video Helper Suite: its `audio` output goes into the same input of **Apply Whisper**, as in the pack's example.
   - Names are spelled wrong: write them in `prompt`.
   - Text in another language: set `language` instead of `auto`.

   The pack's license allows no commercial use. Read it before you use the pack for work.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the recording**:
  - a **Load Audio** node.
  - `audio` of **Load Audio**: a value is chosen.
- Step 3, **Add Whisper**:
  - a **Apply Whisper** node.
  - `AUDIO` of **Load Audio** into `audio` of **Apply Whisper**.
  - `model` of **Apply Whisper**: a value is chosen.
- Step 4, **Show the text**:
  - a **Preview as Text** node.
  - `text` of **Apply Whisper** into `source` of **Preview as Text**.
- Step 5, **Save the subtitles**:
  - a **Save SRT** node.
  - `segments_alignment` of **Apply Whisper** into `alignment` of **Save SRT**.
  - `name` of **Save SRT**: a value is chosen.

## See also
- [Audio](../concepts/Audio.md)
- [How lessons work](How-Lessons-Work.md)
