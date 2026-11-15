[Русский](Refine.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Refining with a second model

<!-- lesson: refine -->
Lesson "refine", in the group **Pictures: first steps** of the lesson list. Steps: 11.

## What you will be able to do
A second model redraws a finished picture: the composition comes from the first, the texture and style from the second.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model: `models/checkpoints`, for example `juggernautXL_v9.safetensors`.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, VAE Encode.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What refining is** (reading)

   One model follows a prompt better and builds the composition. Another is better at skin, cloth or a style of its own. Refining takes the best of both: the first model draws a picture, the second redraws it on top.

   The second model does not start from pure noise. Some noise is added to the finished picture, and the model removes it in its own way. The more noise is added, the more the picture changes.

   In this lesson you build a second model onto a picture graph.

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have **Load Checkpoint**, **KSampler**, **VAE Decode** and **Save Image** with the links between them.

   The graph of "Two models in one graph" will do as well: it has the same part with the picture.

   If these nodes are not there, do the first lesson first.

3. **Add the second model**

   Add a second **Load Checkpoint** node and choose another model in `ckpt_name`: the one whose texture or style you want.

   The models may be of different families. A picture will pass between them, and any model understands a picture.

4. **Give the second model texts of its own**

   Add two new **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of the second model to the `clip` input of each. In the `text` field of one describe the same picture in the manner the second model understands.

   The texts of the first model must not be connected here: another model read them. The prompt can be copied when both models read alike, and must be rewritten when they do not.

5. **Translate the picture for the second model**

   Add an **VAE Encode** node. Connect the `IMAGE` output of **VAE Decode** to its `pixels` input and the `VAE` output of the second model to its `vae` input.

   Each model works with a compressed form of its own. This node compresses the finished picture the way the second model needs, which is why the VAE here is that model's.

6. **Add the second sampler**

   Add a second **KSampler** node and connect to it:
   - to `model`, the `MODEL` output of the second model;
   - to `positive` and `negative`, its two texts;
   - to `latent_image`, the output of **VAE Encode**.

   The second sampler gets not an empty blank but your picture in compressed form.

7. **Set the strength of refining**

   Set `denoise` of the second sampler to 0.5.

   This number says how much of the picture the model redraws. At 1 it draws from nothing and the first picture is lost. At 0.2 only fine detail changes. From 0.3 to 0.5 the composition stays, while texture and faces become the way the second model draws them.

   Set `steps` and `cfg` to what the author of the second model advises.

8. **Save the result**

   Add one more **VAE Decode** and one more **Save Image**. Connect the output of the second sampler to the `samples` input of **VAE Decode** and the `VAE` output of the second model to its `vae` input. Its output goes into the `images` input of the new **Save Image**.

   The graph now saves two pictures: before refining and after. Compare them while you look for the right `denoise`.

9. **When the models are of one family** (reading)

   Models of one family work with the same compressed form of a picture. Then there is no need to unfold it and compress it again: the `LATENT` output of the first sampler goes straight into the `latent_image` input of the second. Less detail is lost this way.

   One family is, for example, SDXL and the models built on it: Pony, Illustrious. Or two SD 1.5 models. The family of a file is shown by its card in the "Models" tab.

   Between different families this must not be done: the second model gets numbers it does not understand and gives noise or an error. Going through a picture, as in this lesson, always works.

10. **LoRA in a graph with two models** (reading)

   Each model has LoRAs of its own. A LoRA of the first model goes between the first **Load Checkpoint** node and the first sampler, a LoRA of the second between the second **Load Checkpoint** node and the second sampler.

   The words of a LoRA go into the prompt of the model in whose path it stands.

   If a LoRA sets the subject in the first pass and the second pass blurs it, lower `denoise`, or put into the second path a LoRA of the same subject made for the second model.

11. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try:
   - `denoise` 0.3 and 0.5: how much the second model changes the picture;
   - swap the models: which one builds the composition better, and which one finishes.

   If a video follows the picture, connect the `IMAGE` output of the new **VAE Decode** to the `start_image` input: the clip then starts from the refined picture.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** (first model) into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** (first model) into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** (first model) into `model` of **KSampler** (sampler) (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (sampler).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (sampler).
  - `LATENT` of **KSampler** (sampler) into `samples` of **VAE Decode** (decoder).
  - `IMAGE` of **VAE Decode** (decoder) into `images` of **Save Image** or **Preview Image** (saver).
- Step 3, **Add the second model**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint** (second model) is not the same file as `ckpt_name` of **Load Checkpoint** (first model).
  - `ckpt_name` of **Load Checkpoint** (second model) holds a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model; such a file lies in `models/checkpoints`, for example `juggernautXL_v9.safetensors`.
- Step 4, **Give the second model texts of its own**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load Checkpoint** (second model) into `clip` of **CLIP Text Encode (Prompt)** (prompt of the second model) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** (second model) into `clip` of **CLIP Text Encode (Prompt)** (negative prompt of the second model) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `text` of **CLIP Text Encode (Prompt)** (prompt of the second model) holds at least 3 characters.
- Step 5, **Translate the picture for the second model**:
  - a **VAE Encode** node.
  - `IMAGE` of **VAE Decode** (decoder) into `pixels` of **VAE Encode**.
  - `VAE` of **Load Checkpoint** (second model) into `vae` of **VAE Encode**.
- Step 6, **Add the second sampler**:
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** (second model) into `model` of **KSampler** (sampler of the second model) (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt of the second model) into `positive` of **KSampler** (sampler of the second model).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt of the second model) into `negative` of **KSampler** (sampler of the second model).
  - `LATENT` of **VAE Encode** into `latent_image` of **KSampler** (sampler of the second model).
- Step 7, **Set the strength of refining**:
  - `denoise` of **KSampler** (sampler of the second model) is from 0.2 to 0.5; **Do this for me** sets 0.5. Why: this is how much of the picture the second model redraws. At 0.5 the composition stays and the texture changes.
- Step 8, **Save the result**:
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `LATENT` of **KSampler** (sampler of the second model) into `samples` of **VAE Decode** (decoder of the second model).
  - `VAE` of **Load Checkpoint** (second model) into `vae` of **VAE Decode** (decoder of the second model).
  - `IMAGE` of **VAE Decode** (decoder of the second model) into `images` of **Save Image** or **Preview Image** (saver of the second model).

## Mistakes people make
- Encoding with the first model's VAE: the second model gets a latent it cannot read.
- Reusing the first model's text nodes for the second sampler.
- `denoise` 1: the first picture is lost completely.
- Passing a `LATENT` between different families: noise or an error.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Image to image](../concepts/Image-To-Image.md)
- [Denoise](../concepts/Denoise.md)
- [Why families do not mix](../concepts/Why-Families-Do-Not-Mix.md)
- [LoRA](../concepts/LoRA.md)
