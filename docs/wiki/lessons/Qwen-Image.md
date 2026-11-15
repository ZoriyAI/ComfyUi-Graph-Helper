[Русский](Qwen-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Qwen-Image: words inside the picture

<!-- lesson: qwen-image -->
Lesson "qwen-image", in the group **Pictures: models** of the lesson list. Steps: 14.

## What you will be able to do
You build a Qwen-Image graph with a real negative prompt, the shift of the family and its own size.

## What you need
- It goes on from [Z-Image Turbo: a picture in eight steps](Z-Image-Turbo.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a Qwen-Image model: `models/diffusion_models`, for example `qwen_image_fp8_e4m3fn.safetensors`;
  - qwen_2.5_vl_7b: `models/text_encoders`, for example `qwen_2.5_vl_7b_fp8_scaled.safetensors`;
  - qwen_image_vae: `models/vae`, for example `qwen_image_vae.safetensors`.
- Nodes: Load Diffusion Model, Load CLIP, Load VAE, ModelSamplingAuraFlow, CLIP Text Encode (Prompt), EmptySD3LatentImage, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **A model that writes** (reading)

   Qwen-Image by Alibaba Qwen is a large model known for lettering: signs, posters and labels in English and Chinese come out readable. Its newer version is Qwen-Image 2512.

   Unlike the turbo models it works with cfg above 1, so its negative prompt is read and works.

   The graph is the one of ComfyUI's templates "Qwen-Image" and "Qwen Image 2512".

2. **Which files your family needs** (reading)

   - the model: `qwen_image_fp8_e4m3fn.safetensors` or `qwen_image_2512_fp8_e4m3fn.safetensors` in models/diffusion_models (about 20 GB);
   - the text encoder: `qwen_2.5_vl_7b_fp8_scaled.safetensors` in models/text_encoders, a language model that also sees pictures;
   - the VAE: `qwen_image_vae.safetensors` in models/vae.

   The edit models of the family (Qwen-Image-Edit) take the same encoder and VAE, but their graph is another one.

   If a file is not in the list, your ComfyUI does not have it. The app downloads nothing. Open the template "Qwen-Image" in ComfyUI itself: it shows which files are missing and where to put them. Take files only from the model's official page. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the model**

   Add a **Load Diffusion Model** node and choose the Qwen-Image file in `unet_name`.

   The file is large. If it does not fit into the video card, ComfyUI moves part of it to the main memory and works slower, or a GGUF file of the model helps.

4. **Load the text encoder**

   Add a **Load CLIP** node. Choose the Qwen 2.5 VL file in `clip_name` and set `type` to `qwen_image`.

   The type tells ComfyUI which family the encoder serves. The same file with another type gives a picture that does not follow the prompt.

5. **Load the VAE**

   Add a **Load VAE** node and choose `qwen_image_vae.safetensors` in `vae_name`.

   Qwen-Image has a VAE of its own; the VAE of Flux does not fit it.

6. **Set the shift**

   Add a **ModelSamplingAuraFlow** node and connect the `MODEL` output of **Load Diffusion Model** to its `model` input. Set `shift` to 3.1, the number of ComfyUI's template.

   The shift says where the steps are spent: a higher one gives more of them to the large shapes, a lower one to fine detail. If small letters come out blurred, try a little lower.

7. **Write the prompt and the negative**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the output of **Load CLIP** to the `clip` input of each.

   In the `text` field of the first, describe the picture in detail, in sentences. Put the words to be written in quotes and say where they stand: a bakery shop window at dusk, a hand-painted sign above the door reads "FRESH BREAD", warm light inside.

   In the second write what is not wanted: blurry, low resolution, distorted letters. At cfg 4 the model reads it and steers away.

8. **Add the empty latent in the size of the family**

   Add a **EmptySD3LatentImage** node. Set `width` and `height` to 1328.

   Qwen-Image was trained at about 1.7 megapixels; at 1024 it draws, but small letters suffer. The model's page also gives 1664 by 928 and 928 by 1664 for wide and tall pictures; this step asks for the square.

9. **Add the sampler**

   Add a **KSampler** node and connect:
   - to `model`, the output of **ModelSamplingAuraFlow**;
   - to `positive` and `negative`, the two text nodes;
   - to `latent_image`, the output of **EmptySD3LatentImage**.

10. **Set the sampler**

   In **KSampler** set:
   - `steps`: 20;
   - `cfg`: 4;
   - `sampler_name`: `euler`;
   - `scheduler`: `simple`.

   These are the numbers of the template "Qwen-Image". The template of 2512 gives 50 steps for the most detail; it takes longer.

11. **Turn the result into a picture**

   Add a **VAE Decode** node. Connect the output of **KSampler** to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the picture in its compressed form, the latent. The VAE of the same family unfolds it into pixels.

12. **Save the picture**

   Add a **Save Image** node and connect the output of **VAE Decode** to its `images` input.

   Without it ComfyUI works the picture out and puts it nowhere.

13. **Faster: the Lightning LoRA** (reading)

   The family has speed-up LoRAs (Lightning) that make it a few-step model. In ComfyUI's template the LoRA stands in a Load LoRA node for the model only, between **Load Diffusion Model** and **ModelSamplingAuraFlow**, at strength 1. Then the sampler takes 8 steps and `cfg` 1 (with the four-step LoRA, 4 steps).

   At cfg 1 the negative prompt is no longer read: this is the price of speed. The LoRA must be made for your version: those of Qwen-Image and of 2512 differ.

14. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the result is bad:
   - the letters are wrong: shorter words, each in its own quotes, said where they stand; a size from the model's page;
   - the picture ignores the prompt: `type` is not `qwen_image`;
   - colours go off: the VAE is not the one of Qwen-Image.

   The same graph serves the base Z-Image: model `z_image_bf16.safetensors`, encoder `qwen_3_4b.safetensors` with type `lumina2`, VAE `ae.safetensors`, shift 3, size 1024, 25 steps, `cfg` 4, `res_multistep`.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 3, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a Qwen-Image model; such a file lies in `models/diffusion_models`, for example `qwen_image_fp8_e4m3fn.safetensors`.
- Step 4, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds qwen_2.5_vl_7b; such a file lies in `models/text_encoders`, for example `qwen_2.5_vl_7b_fp8_scaled.safetensors`.
  - `type` of **Load CLIP** is `qwen_image`. Why: a text encoder of the wrong type reads the prompt wrongly, and the model gets nonsense.
- Step 5, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds qwen_image_vae; such a file lies in `models/vae`, for example `qwen_image_vae.safetensors`.
- Step 6, **Set the shift**:
  - a **ModelSamplingAuraFlow** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **ModelSamplingAuraFlow** (a LoraLoaderModelOnly in between is accepted).
  - `shift` of **ModelSamplingAuraFlow** is from 1 to 10; **Do this for me** sets 3.1. Why: the Qwen-Image template shifts the noise by 3.1: where the steps are spent.
- Step 7, **Write the prompt and the negative**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 40 characters.
- Step 8, **Add the empty latent in the size of the family**:
  - a **EmptySD3LatentImage** node.
  - `width` of **EmptySD3LatentImage** is from 512 to 2048; **Do this for me** sets 1328. Why: qwen-Image was trained near 1.7 megapixels; small letters suffer at 1024.
  - `height` of **EmptySD3LatentImage** is from 512 to 2048; **Do this for me** sets 1328. Why: qwen-Image was trained near 1.7 megapixels; small letters suffer at 1024.
- Step 9, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingAuraFlow** into `model` of **KSampler** (a LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler**.
  - `LATENT` of **EmptySD3LatentImage** into `latent_image` of **KSampler**.
- Step 10, **Set the sampler**:
  - `steps` of **KSampler** is from 15 to 50; **Do this for me** sets 20. Why: without a speed-up LoRA the Qwen-Image template uses 20 steps.
  - `cfg` of **KSampler** is from 2.5 to 5; **Do this for me** sets 4. Why: at cfg 4 the negative prompt is read; the template uses 4 without a speed-up LoRA.
  - `sampler_name` of **KSampler** is `euler`.
  - `scheduler` of **KSampler** is `simple`.
- Step 11, **Turn the result into a picture**:
  - a **VAE Decode** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode**.
- Step 12, **Save the picture**:
  - a **Save Image** or **Preview Image** node.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## What next
These lessons go on from this one: [Editing a picture by words](Edit-By-Words.md).

## See also
- [Qwen-Image](../concepts/Family-Qwen-Image.md)
- [Text encoders: CLIP, T5 and others](../concepts/Text-Encoders.md)
- [How lessons work](How-Lessons-Work.md)
