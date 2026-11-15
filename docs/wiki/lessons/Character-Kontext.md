[Русский](Character-Kontext.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The same character in a new picture: FLUX.1 Kontext

<!-- lesson: character-kontext -->
Lesson "character-kontext", in the group **Faces and characters** of the lesson list. Steps: 13.

## Consent first
Obtain consent before using a real person's likeness, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who appears to be a minor. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You build a graph that draws your invented character again, in a new place or pose, with the same face and clothes.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `kontext`;
  - for `clip_name1` of **DualCLIPLoader**: a file whose name has `clip_l`;
  - for `vae_name` of **Load VAE**: a file whose name has `ae`;
  - for `clip_name2` of **DualCLIPLoader**: a file whose name has `t5xxl`.
- Nodes: Load Diffusion Model, DualCLIPLoader, Load VAE, Load Image, FluxKontextImageScale, VAE Encode, CLIP Text Encode (Prompt), ReferenceLatent, FluxGuidance, ConditioningZeroOut, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **First, about faces** (reading)

   FLUX.1 Kontext takes a picture and a sentence of what to change, and keeps the rest: the same face, the same clothes, the same style. That is how one character goes through a whole series of pictures.

   The example in this lesson is an invented character or yourself. Obtain consent before using a real person's likeness, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who appears to be a minor.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add a **Load Diffusion Model** node and choose the Kontext file in `unet_name`. The template uses `flux1-dev-kontext_fp8_scaled.safetensors` from models/diffusion_models.

   Only a Kontext model can do this. A plain FLUX.1 dev ignores the picture.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the template "Flux Kontext Dev Image Edit": it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the text readers and the decoder**

   Add a **DualCLIPLoader** node. Choose `clip_l.safetensors` in `clip_name1`, `t5xxl_fp8_e4m3fn_scaled.safetensors` in `clip_name2`, and set `type` to `flux`.

   Add a **Load VAE** node and choose `ae.safetensors` in `vae_name`.

   These are the same files FLUX.1 uses for pictures from text.

4. **Load the picture of the character**

   Add a **Load Image** node and choose the picture of your character in its `image` field.

   The face should be clear and large enough. This picture is the reference: everything the model keeps comes from it.

5. **Prepare the picture**

   Add a **FluxKontextImageScale** node and connect the picture from **Load Image** to its `image` input. Then add an **VAE Encode** node: its `pixels` input from **FluxKontextImageScale**, its `vae` input from **Load VAE**.

   The first node brings the picture to a size Kontext was trained on. The second turns it into the compressed form the model works in.

6. **Say what changes**

   Add a **CLIP Text Encode (Prompt)** node and connect the `CLIP` output of **DualCLIPLoader** to its `clip` input. In `text` write what is new and what stays. For example: the same woman with short red hair and a green coat, now standing on a rainy street at night, keep her face and clothes.

   Name the character by what is seen ("the woman with red hair"), not by a pronoun: the model then knows whom to keep.

7. **Give the picture to the prompt**

   Add a **ReferenceLatent** node. Connect the output of **CLIP Text Encode (Prompt)** to its `conditioning` input and the output of **VAE Encode** to its `latent` input.

   Then add a **FluxGuidance** node, connect **ReferenceLatent** to its `conditioning` input and set `guidance` to 2.5.

   The first node attaches the picture to the prompt. The second says how strongly the model follows them: the template uses 2.5.

8. **An empty negative**

   Add an **ConditioningZeroOut** node and connect the output of **CLIP Text Encode (Prompt)** to its `conditioning` input.

   Kontext is not told what to avoid. This node gives the sampler's `negative` input the same prompt set to zero.

9. **Add the sampler**

   Add a **KSampler** node and connect four inputs:
   - `model` from **Load Diffusion Model**;
   - `positive` from **FluxGuidance**;
   - `negative` from **ConditioningZeroOut**;
   - `latent_image` from **VAE Encode**.

   Set `steps` to 20 and `cfg` to 1. FLUX models take their guidance from **FluxGuidance**, so `cfg` stays at 1.

10. **Turn the result into a picture and save it**

   Add a **VAE Decode** node: `samples` from **KSampler**, `vae` from **Load VAE**. Then add a **Save Image** node and connect the picture of **VAE Decode** to its `images` input.

11. **A series with one character** (reading)

   To keep the character through a series:
   - start each new picture from the same reference, not from the last result: small changes add up;
   - change one thing at a time: the place, then the pose, then the light;
   - repeat in every prompt the features that make the character: hair, clothes, a mark;
   - fix `seed` in **KSampler** while you look for a good prompt.

   If the face drifts, lower `guidance` a little or say "keep the face" in the prompt.

12. **Other ways to keep a character** (reading)

   Other methods need more files and work only with their own family of models:
   - IP-Adapter FaceID (ComfyUI_IPAdapter_plus pack): SD 1.5 and SDXL, needs InsightFace in models/insightface and its own files in models/ipadapter;
   - PhotoMaker (nodes of ComfyUI itself): SDXL, a file in models/photomaker, several pictures of one face;
   - InfiniteYou (ComfyUI_InfiniteYou pack): FLUX, files in models/infinite_you and InsightFace, much video memory;
   - a LoRA trained on the character: the steadiest, but it has to be trained first.

   The same rule holds for all of them: an invented character or yourself, or a person who gave consent.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `kontext` (capitals, dots and dashes do not matter).
- Step 3, **Load the text readers and the decoder**:
  - a **DualCLIPLoader** node.
  - a **Load VAE** node.
  - `clip_name1` of **DualCLIPLoader** holds a file whose name has `clip_l` (capitals, dots and dashes do not matter).
  - `clip_name2` of **DualCLIPLoader** is not the same file as `clip_name1` of **DualCLIPLoader**.
  - `type` of **DualCLIPLoader** is `flux`.
  - `vae_name` of **Load VAE** holds a file whose name has `ae` and not `sdxl`, `wan`, `qwen`, `flux2`, `taesd` (capitals, dots and dashes do not matter).
  - `clip_name2` of **DualCLIPLoader** holds a file whose name has `t5xxl` (capitals, dots and dashes do not matter).
- Step 4, **Load the picture of the character**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 5, **Prepare the picture**:
  - a **FluxKontextImageScale** node.
  - a **VAE Encode** node.
  - `IMAGE` of **Load Image** into `image` of **FluxKontextImageScale** (a ImageStitch in between is accepted).
  - `IMAGE` of **FluxKontextImageScale** into `pixels` of **VAE Encode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Encode**.
- Step 6, **Say what changes**:
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **DualCLIPLoader** into `clip` of **CLIP Text Encode (Prompt)**.
  - `text` of **CLIP Text Encode (Prompt)** holds at least 20 characters.
- Step 7, **Give the picture to the prompt**:
  - a **ReferenceLatent** node.
  - a **FluxGuidance** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **ReferenceLatent**.
  - `LATENT` of **VAE Encode** into `latent` of **ReferenceLatent**.
  - `CONDITIONING` of **ReferenceLatent** into `conditioning` of **FluxGuidance**.
  - `guidance` of **FluxGuidance** is from 2 to 3.5; **Do this for me** sets 2.5.
- Step 8, **An empty negative**:
  - a **ConditioningZeroOut** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **ConditioningZeroOut**.
- Step 9, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **KSampler**.
  - `CONDITIONING` of **FluxGuidance** into `positive` of **KSampler**.
  - `CONDITIONING` of **ConditioningZeroOut** into `negative` of **KSampler**.
  - `LATENT` of **VAE Encode** into `latent_image` of **KSampler**.
  - `steps` of **KSampler** is from 20 to 30; **Do this for me** sets 20.
  - `cfg` of **KSampler** is `1`.
- Step 10, **Turn the result into a picture and save it**:
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## What next
These lessons go on from this one: [One character in many pictures](Character-Series.md).

## See also
- [Reference images: IP-Adapter, Redux, editing models](../concepts/Reference-Images.md)
- [Flux.1](../concepts/Family-Flux1.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
