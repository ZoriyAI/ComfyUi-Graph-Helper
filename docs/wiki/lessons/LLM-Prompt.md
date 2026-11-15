[Русский](LLM-Prompt.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A language model writes the prompt

<!-- lesson: llm-prompt -->
Lesson "llm-prompt", in the group **Packs and tools** of the lesson list. Steps: 10.

## What you will be able to do
You let a language model inside ComfyUI turn a short idea into a detailed prompt, and compare it with your own by the switch.

## What you need
- It goes on from [Two versions of a prompt with one switch](Prompt-Switch.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `clip_name` of **Load CLIP**: a file whose name has `qwen` or `gemma`.
- Nodes: CLIP Text Encode (Prompt), If/Else Switch, Text (Multiline), Load CLIP, Generate Text / TextGenerate, Preview as Text.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **A language model in the graph** (reading)

   A language model can turn a short idea into a detailed prompt: light, composition, materials, style. ComfyUI does it with its own Generate Text node, on your graphics card, without another program and without a cloud service.

   This lesson goes on from "Two versions of a prompt with one switch": your idea stays on one side of the switch, and the model's version goes to the other.

   It needs a language model file in ComfyUI/models/text_encoders: one that ComfyUI's text generation templates name, such as Qwen 3 4B, Qwen 3.5 or Gemma 4. Take it from the model's official page; the app downloads nothing.

2. **The switch graph is needed**

   The canvas must have the graph of "Two versions of a prompt with one switch": **If/Else Switch** with its output in **CLIP Text Encode (Prompt)**, and the **Text (Multiline)** node with your prompt on its `on_false` input.

   If it is not there, do that lesson first.

3. **Load the language model**

   Add a **Load CLIP** node and choose the language model file in its `clip_name` field. Leave `type` as the template of that model sets it; the official Qwen 3.5 and Gemma 4 templates leave `stable_diffusion`.

   A language model is loaded like a text encoder: in ComfyUI the two are the same kind of file. This node is not linked to the text encoder of the picture model: it feeds only Generate Text.

4. **Generate Text**

   Add a **Generate Text** node. Connect the output of **Load CLIP** to its `clip` input and the output of **Text (Multiline)** to its `prompt` input. Set `max_length` to 512.

   The model now reads your idea. `max_length` is the longest answer in tokens, pieces of words; a prompt needs far fewer, the limit only stops a model that talks on. Leave `thinking` off: the answer is then the prompt itself.

5. **The model's version into the switch**

   Connect the `generated_text` output of **Generate Text** to the `on_true` input of **If/Else Switch**. The link from the second version is replaced.

   Now `true` sends the model's prompt to the picture and `false` your own. The second text node is free: the next step gives it a new job.

6. **The instruction**

   Connect a **Text (Multiline)** node (the free one, or a new one) to the `system_prompt` input of **Generate Text** and write the instruction into its `value` field. For example: Rewrite the idea as one detailed image prompt in English: subject, setting, light, camera, style. Answer with the prompt only.

   The instruction says what to do with the idea; the idea says what about. "Answer with the prompt only" keeps greetings and explanations out of the picture.

7. **See what the model wrote**

   Add a **Preview as Text** node and connect the `generated_text` output of **Generate Text** to its `source` input.

   After a run the text shows on the node. Read it: if the model adds things you did not want, say so in the instruction.

8. **Memory and time** (reading)

   The language model is a model like any other: a 4B file takes about 8 GB in 16 bits, less in fp8. ComfyUI loads it, writes the text, and moves it away when the picture model needs the room.

   With a fixed `seed` and an unchanged idea ComfyUI keeps the written text and does not run the language model again. Change the idea, and only then is a new text written.

9. **Other ways** (reading)

   - comfyui-ollama: sends the idea to an Ollama server you run yourself; Ollama Generate gives the text from its result output.
   - ComfyUI-QwenVL: Qwen vision-language models that describe a picture; the pack downloads them into models/LLM on the first run.
   - comfyui_LLM_party: agents and cloud models with your API key.
   - Partner nodes of ComfyUI (OpenAI, Gemini and others) run in the cloud.

   Cloud models cost money and send your text to that company. Generate Text runs on your own card.

10. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Run once with `true` and once with `false` on the switch, with the same `seed`. Keep what works: the short idea, the long prompt, or the model's prompt edited by hand.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The switch graph is needed**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **If/Else Switch** node.
  - a **Text (Multiline)** node.
  - `output` of **If/Else Switch** into `text` of **CLIP Text Encode (Prompt)**.
  - `STRING` of **Text (Multiline)** (idea) into `on_false` of **If/Else Switch**.
- Step 3, **Load the language model**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `qwen` or `gemma` (capitals, dots and dashes do not matter).
- Step 4, **Generate Text**:
  - a **Generate Text** or **TextGenerate** node.
  - `CLIP` of **Load CLIP** into `clip` of **Generate Text** or **TextGenerate**.
  - `STRING` of **Text (Multiline)** (idea) into `prompt` of **Generate Text** or **TextGenerate**.
  - `max_length` of **Generate Text** or **TextGenerate** is from 256 to 1024; **Do this for me** sets 512.
- Step 5, **The model's version into the switch**:
  - `generated_text` of **Generate Text** or **TextGenerate** into `on_true` of **If/Else Switch**.
- Step 6, **The instruction**:
  - a **Text (Multiline)** node.
  - `STRING` of **Text (Multiline)** (instruction) into `system_prompt` of **Generate Text** or **TextGenerate**.
  - `value` of **Text (Multiline)** (instruction) holds at least 30 characters.
- Step 7, **See what the model wrote**:
  - a **Preview as Text** node.
  - `generated_text` of **Generate Text** or **TextGenerate** into `source` of **Preview as Text**.

## See also
- [The prompt: how models read text](../concepts/Prompt.md)
- [Text encoders: CLIP, T5 and others](../concepts/Text-Encoders.md)
- [How lessons work](How-Lessons-Work.md)
