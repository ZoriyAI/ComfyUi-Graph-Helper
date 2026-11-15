[Русский](Edit-By-Words.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Editing a picture by words

<!-- lesson: edit-words -->
Lesson "edit-words", in the group **Pictures: techniques** of the lesson list. Steps: 13.

## What you will be able to do
A model made for editing changes a picture as an instruction says: "make the sofa green", "remove the cup".

## What you need
- It goes on from [Qwen-Image: words inside the picture](Qwen-Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, ModelSamplingAuraFlow, Load Image, FluxKontextImageScale, Text Encode Qwen Image Edit Plus, VAE Encode, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What an editing model does** (reading)

   An editing model gets a picture and an instruction and changes only what the instruction is about. Unlike inpainting there is no mask: the model understands itself what to change.

   This lesson builds Qwen-Image-Edit 2511 the way ComfyUI's official template does, from an empty canvas: "File ▸ New project". The model is large: the bf16 file is about 40 GB, the fp8 one about 20 GB.

2. **Load the three parts**

   Add **Load Diffusion Model**, **Load CLIP** and **Load VAE**.
   - In `unet_name` of **Load Diffusion Model**: the qwen_image_edit_2511 file, from `models/diffusion_models`.
   - In `clip_name` of **Load CLIP**: qwen_2.5_vl_7b, from `models/text_encoders`. Set `type` to `qwen_image`.
   - In `vae_name` of **Load VAE**: qwen_image_vae.

   The text reader of this model is itself a model that sees pictures: that is how it understands an instruction about a picture.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the official template of Qwen-Image-Edit: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Set the noise shift**

   Add a **ModelSamplingAuraFlow** node and pass the model through it: the output of **Load Diffusion Model** into its `model` input. Set `shift` to 3.1, as the template does.

   The number changes how much noise is left at each step; this family is set up with this node.

4. **Load the picture to edit**

   Add **Load Image** and **FluxKontextImageScale**. Choose the picture in `image` of **Load Image** and connect its output to `image` of **FluxKontextImageScale**.

   **FluxKontextImageScale** brings the picture to about one megapixel with sides the model takes. A picture of another size would be cut or distorted.

5. **Write the instruction**

   Add a **Text Encode Qwen Image Edit Plus** node and connect to it: `clip` from **Load CLIP**, `vae` from **Load VAE**, `image1` from **FluxKontextImageScale**. Write the instruction in its `prompt` field, in English or Chinese: "Change the color of the sofa to dark green."

   The node shows the picture to the text reader and to the model together with the words.

6. **The second text**

   Add a second **Text Encode Qwen Image Edit Plus** node with the same three links and leave its `prompt` empty.

   The sampler wants two prompts. An empty one with the same picture means "nothing in particular", as in the template.

7. **The starting latent**

   Add an **VAE Encode** node: the output of **FluxKontextImageScale** into `pixels`, the output of **Load VAE** into `vae`.

   The sampler starts from your picture, so the result keeps its size.

8. **The sampler**

   Add a **KSampler** node and connect: `model` from **ModelSamplingAuraFlow**, `positive` from **Text Encode Qwen Image Edit Plus**, `negative` from **Text Encode Qwen Image Edit Plus**, `latent_image` from **VAE Encode**. Set `steps` to 40 and `cfg` to 4, and leave `denoise` at 1.

   The picture is kept through the texts, which carry it; that is why `denoise` stays 1.

9. **Decode and save**

   Add **VAE Decode** and **Save Image**: the output of **KSampler** into `samples`, the output of **Load VAE** into `vae`, the picture into `images`.

10. **How to write instructions** (reading)

   - One change at a time: "replace the cup with a vase of tulips". Several changes at once often lose some.
   - Name what must stay: "keep the face and the pose unchanged".
   - Words on a sign go in quotes: change the sign to "OPEN".
   - `image2` and `image3` take more pictures: "put the jacket from image 2 on the man in image 1".

11. **Faster: four steps** (reading)

   The Lightning LoRA of this model, Qwen-Image-Edit-2511-Lightning-4steps, cuts the work to 4 steps. Put it into a LoraLoaderModelOnly node between **Load Diffusion Model** and **ModelSamplingAuraFlow**, then set `steps` to 4 and `cfg` to 1. The template has both ways behind one switch.

12. **Other editing models** (reading)

   ComfyUI's templates show several families:
   - Flux.1 Kontext dev: the picture goes in as a reference latent;
   - Flux.2 Klein: small and fast, edits by one or several pictures;
   - Qwen Image 2.1: the newest of the Qwen family, with a text node of its own.
   Each has its own nodes; open its template in ComfyUI to see the graph.

   The templates also have paid API nodes for editing. They cost money and send your picture and your words to a cloud service.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: the same instruction with two `seed` values; an instruction that names what must stay.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the three parts**:
  - a **Load Diffusion Model** node.
  - a **Load CLIP** node.
  - a **Load VAE** node.
  - `unet_name` of **Load Diffusion Model**: a value is chosen.
  - `clip_name` of **Load CLIP**: a value is chosen.
  - `type` of **Load CLIP** is `qwen_image`.
  - `vae_name` of **Load VAE**: a value is chosen.
- Step 3, **Set the noise shift**:
  - a **ModelSamplingAuraFlow** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **ModelSamplingAuraFlow** (a LoraLoaderModelOnly in between is accepted).
  - `shift` of **ModelSamplingAuraFlow** is from 2 to 4; **Do this for me** sets 3.1.
- Step 4, **Load the picture to edit**:
  - a **Load Image** node.
  - a **FluxKontextImageScale** node.
  - `IMAGE` of **Load Image** into `image` of **FluxKontextImageScale**.
  - `image` of **Load Image**: a value is chosen.
- Step 5, **Write the instruction**:
  - a **Text Encode Qwen Image Edit Plus** node.
  - `CLIP` of **Load CLIP** into `clip` of **Text Encode Qwen Image Edit Plus** (prompt).
  - `VAE` of **Load VAE** into `vae` of **Text Encode Qwen Image Edit Plus** (prompt).
  - `IMAGE` of **FluxKontextImageScale** into `image1` of **Text Encode Qwen Image Edit Plus** (prompt).
  - `prompt` of **Text Encode Qwen Image Edit Plus** (prompt) holds at least 5 characters.
- Step 6, **The second text**:
  - a **Text Encode Qwen Image Edit Plus** node.
  - `CLIP` of **Load CLIP** into `clip` of **Text Encode Qwen Image Edit Plus** (negative prompt).
  - `VAE` of **Load VAE** into `vae` of **Text Encode Qwen Image Edit Plus** (negative prompt).
  - `IMAGE` of **FluxKontextImageScale** into `image1` of **Text Encode Qwen Image Edit Plus** (negative prompt).
- Step 7, **The starting latent**:
  - a **VAE Encode** node.
  - `IMAGE` of **FluxKontextImageScale** into `pixels` of **VAE Encode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Encode**.
- Step 8, **The sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingAuraFlow** into `model` of **KSampler** (a CFGNorm or LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **Text Encode Qwen Image Edit Plus** (prompt) into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **Text Encode Qwen Image Edit Plus** (negative prompt) into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **VAE Encode** into `latent_image` of **KSampler**.
  - `steps` of **KSampler** is from 4 to 50; **Do this for me** sets 40.
  - `cfg` of **KSampler** is from 1 to 5; **Do this for me** sets 4.
- Step 9, **Decode and save**:
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## See also
- [Qwen-Image](../concepts/Family-Qwen-Image.md)
- [Paid API nodes (Partner Nodes)](../concepts/Paid-API-Nodes.md)
- [How lessons work](How-Lessons-Work.md)
