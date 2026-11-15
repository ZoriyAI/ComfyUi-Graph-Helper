[Русский](SDXL.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# SDXL done properly

<!-- lesson: sdxl -->
Lesson "sdxl", in the group **Pictures: models** of the lesson list. Steps: 9.

## What you will be able to do
You set an SDXL graph to the size and the settings the family was trained for.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - an SDXL checkpoint (SDXL, Pony, Illustrious), not SD 1.5, Flux or a diffusion-only file: `models/checkpoints`, for example `sd_xl_base_1.0.safetensors`.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What SDXL is** (reading)

   SDXL by Stability AI is a family of one base model and thousands of models trained further from it: Juggernaut XL, RealVis XL and many more. Each is one checkpoint file with the model, two text encoders and the VAE.

   SDXL was trained at about one megapixel. At 512 by 512, the size of SD 1.5, it draws badly: repeated objects, broken faces. This lesson sets the graph to its own numbers, as ComfyUI's template "SDXL1.0: Text to Image (Simple)" does.

2. **A picture graph is needed**

   This lesson goes on from the graph of the lesson "A first picture from text". The canvas must have **Load Checkpoint**, two **CLIP Text Encode (Prompt)** nodes, **Empty Latent Image**, **KSampler**, **VAE Decode** and **Save Image** with their links.

   If they are not there, do that lesson first.

3. **Choose an SDXL model**

   In the `ckpt_name` field of **Load Checkpoint** choose an SDXL model: the base `sd_xl_base_1.0.safetensors` or one trained further from it. The files lie in models/checkpoints.

   An SDXL file is about 6.5 GB; an SD 1.5 one is 2 to 4 GB. Pony and Illustrious are SDXL too, and have a lesson of their own.

4. **Set the size of SDXL**

   In **Empty Latent Image** set `width` and `height` to 1024.

   Other sizes of the same area: 896 by 1152, 832 by 1216, 768 by 1344, and the same turned on its side. Keep near one megapixel and both sides divisible by 64.

5. **Set the sampler**

   In **KSampler** set:
   - `steps`: 25;
   - `cfg`: 7;
   - `sampler_name`: `dpmpp_2m`;
   - `scheduler`: `karras`.

   These are the numbers of ComfyUI's template. A model trained further may ask for others on its page: then its page wins.

6. **Both texts work**

   Write the prompt in the `text` field of **CLIP Text Encode (Prompt)**, and in the `text` field of the other text node what is not wanted: blurry, low quality, watermark.

   SDXL works with cfg above 1, so its negative is read. It understands short sentences and comma lists equally; the models trained further on tags have their own lesson.

7. **Two encoders, one text** (reading)

   SDXL reads the prompt with two encoders, CLIP-L and the larger OpenCLIP-G. The usual text node gives the same text to both, as the template does, and this is right for nearly every case.

   The node CLIP Text Encode (SDXL) has a field for each, `text_g` and `text_l`, and fields for the size. Few people need it.

8. **The refiner: a piece of history** (reading)

   SDXL 1.0 came with a second model, the refiner, which finished the last steps. ComfyUI's template "SDXL Simple" still shows it: the base does 20 of 25 steps and hands the rest over.

   Models trained further do not need it and it can spoil their faces. Today a second pass is done by redrawing with any model you like: the lesson "Refining with a second model".

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the result is bad:
   - doubled people or objects: the size is far from one megapixel;
   - burnt, oversharp colours: `cfg` too high, try 5;
   - a washed-out picture: the model may need a VAE file of its own; its page says so.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
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
- Step 3, **Choose an SDXL model**:
  - `ckpt_name` of **Load Checkpoint** holds an SDXL checkpoint (SDXL, Pony, Illustrious), not SD 1.5, Flux or a diffusion-only file; such a file lies in `models/checkpoints`, for example `sd_xl_base_1.0.safetensors`.
- Step 4, **Set the size of SDXL**:
  - `width` of **Empty Latent Image** is from 640 to 1536; **Do this for me** sets 1024. Why: SDXL was trained near one megapixel; at 512 it repeats objects.
  - `height` of **Empty Latent Image** is from 640 to 1536; **Do this for me** sets 1024. Why: SDXL was trained near one megapixel; at 512 it repeats objects.
- Step 5, **Set the sampler**:
  - `steps` of **KSampler** is from 20 to 40; **Do this for me** sets 25. Why: the SDXL template uses 25 steps.
  - `cfg` of **KSampler** is from 4 to 9; **Do this for me** sets 7. Why: a cfg that is too high burns the colors; the SDXL template uses 7.
  - `sampler_name` of **KSampler** is `dpmpp_2m`.
  - `scheduler` of **KSampler** is `karras`.
- Step 6, **Both texts work**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 20 characters.
  - `text` of **CLIP Text Encode (Prompt)** (negative prompt) holds at least 5 characters.

## What next
These lessons go on from this one: [Pony and Illustrious: tags instead of sentences](Pony-And-Illustrious.md), [SD 3.5: one file and a new empty latent](SD35.md).

## See also
- [SDXL](../concepts/Family-SDXL.md)
- [Resolution and aspect ratio](../concepts/Resolution.md)
- [Checkpoint](../concepts/Checkpoint.md)
- [How lessons work](How-Lessons-Work.md)
