[Русский](Pony-And-Illustrious.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Pony and Illustrious: tags instead of sentences

<!-- lesson: tags -->
Lesson "tags", in the group **Pictures: models** of the lesson list. Steps: 10.

## What you will be able to do
You write a tag prompt with the quality words of the model's page and set the size and sampler such models are used with.

## What you need
- It goes on from [SDXL done properly](SDXL.md), [The prompt: how a model reads it](Prompt.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a checkpoint of the Pony, Illustrious or NoobAI line: `models/checkpoints`, for example `ponyDiffusionV6XL.safetensors`.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Families trained on tags** (reading)

   Pony Diffusion V6 XL, Illustrious XL and NoobAI XL are SDXL models trained further on pictures described with tags: short words and phrases separated by commas.

   They load exactly like SDXL. What changes is how you write for them: tags instead of sentences, the quality words of the model's page, a fitting size, and a note on "clip skip". LoRAs made for one line work best within that line.

   The examples here are neutral. The source of truth is the page of your model.

2. **An SDXL graph is needed**

   This lesson goes on from the graph of the lesson "SDXL done properly". The canvas must have **Load Checkpoint**, two **CLIP Text Encode (Prompt)** nodes, **Empty Latent Image**, **KSampler**, **VAE Decode** and **Save Image** with their links.

   If they are not there, do that lesson first.

3. **Choose the model**

   In `ckpt_name` choose a Pony, Illustrious or NoobAI model, or one trained further from them. Its page names its line.

   The file is an SDXL checkpoint in models/checkpoints.

4. **Quality words come from the model's page** (reading)

   These models learned special tags for quality. They stand at the start of the prompt:
   - Pony: `score_9, score_8_up, score_7_up`;
   - Illustrious and NoobAI: `masterpiece, best quality`.

   They also learned rating tags for the kind of content; for neutral pictures Pony uses `rating_safe`, Illustrious and NoobAI `general`.

   Copy these words from your model's page: a model trained further from Pony may need none of them.

5. **Write the prompt in tags**

   In the `text` field of **CLIP Text Encode (Prompt)** write tags separated by commas: the quality words first, then what is in the picture, then the style and light. For example: masterpiece, best quality, scenery, mountain lake, sunrise, pine trees, mist, no humans.

   Tags that name the same thing in different words add little. The ones that the model knows come from the site its pictures were tagged on; the model page often names it.

6. **Write the negative in tags**

   In the `text` field of the other text node write tags of what is not wanted: worst quality, low quality, blurry, watermark, signature.

   Pony also takes the low scores here; its page names them.

7. **Choose a portrait size**

   In **Empty Latent Image** set `width` to 832 and `height` to 1216.

   This is one of the SDXL sizes; such models are mostly used for upright pictures. For a landscape take 1216 by 832, for a square 1024 by 1024.

8. **Set the sampler**

   In **KSampler** set `steps` to 28, `cfg` to 6 and `sampler_name` to `euler_ancestral`.

   The pages of these models usually advise cfg from 5 to 7 and Euler Ancestral. Leave `scheduler` as the page says, `normal` or `karras`.

9. **Clip skip** (reading)

   The pages of these models often say "clip skip 2": read the prompt from the second-to-last layer of the text encoder. In ComfyUI the SDXL encoders already read that layer, so nothing needs to be added.

   If you put in a CLIP Set Last Layer node anyway, give its only field -2: with -1 it would switch to the last layer and change the picture. With anime models of SD 1.5 it is the other way round: ComfyUI reads the last layer, and the node with -2 is needed when the page asks for clip skip 2.

10. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the result is bad:
   - the picture is plain and flat: the quality words of the page are missing or misspelt;
   - the model does not obey a tag: look it up in the tag list of the site the page names; a sentence is read worse than tags;
   - burnt colours: `cfg` lower, 5.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **An SDXL graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **Empty Latent Image** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or ModelSamplingSD3 in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler**.
  - `LATENT` of **Empty Latent Image** into `latent_image` of **KSampler**.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 3, **Choose the model**:
  - `ckpt_name` of **Load Checkpoint** holds a checkpoint of the Pony, Illustrious or NoobAI line; such a file lies in `models/checkpoints`, for example `ponyDiffusionV6XL.safetensors`.
- Step 5, **Write the prompt in tags**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 30 characters, with `,`.
- Step 6, **Write the negative in tags**:
  - `text` of **CLIP Text Encode (Prompt)** (negative prompt) holds at least 15 characters, with `,`.
- Step 7, **Choose a portrait size**:
  - `width` of **Empty Latent Image** is from 768 to 896; **Do this for me** sets 832. Why: 832 by 1216 is an SDXL size: about one megapixel in portrait proportions.
  - `height` of **Empty Latent Image** is from 1152 to 1344; **Do this for me** sets 1216. Why: 832 by 1216 is an SDXL size: about one megapixel in portrait proportions.
- Step 8, **Set the sampler**:
  - `steps` of **KSampler** is from 20 to 35; **Do this for me** sets 28. Why: the model pages advise Euler Ancestral with cfg 5 to 7.
  - `cfg` of **KSampler** is from 4 to 7.5; **Do this for me** sets 6. Why: the model pages advise Euler Ancestral with cfg 5 to 7.
  - `sampler_name` of **KSampler** is `euler_ancestral`.

## See also
- [Pony](../concepts/Family-Pony.md)
- [Illustrious](../concepts/Family-Illustrious.md)
- [Prompt syntax and weights](../concepts/Prompt-Syntax.md)
- [How lessons work](How-Lessons-Work.md)
