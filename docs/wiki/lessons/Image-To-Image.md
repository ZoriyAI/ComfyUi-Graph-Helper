[Русский](Image-To-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A picture from a picture

<!-- lesson: img2img -->
Lesson "img2img", in the group **Pictures: techniques** of the lesson list. Steps: 9.

## What you will be able to do
A picture you already have becomes a new one: the same composition, drawn again by the model as the prompt says.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load Image, Scale Image to Total Pixels, VAE Encode.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What image-to-image is** (reading)

   Image-to-image starts not from empty noise but from your picture. The picture is turned into the compressed form the model works in, the latent; some noise is added to it, and the sampler removes that noise by your prompt.

   How much noise is added is set by `denoise`. At 1 nothing of your picture is left. At 0.3 only fine detail changes. In between, the composition stays and the rest is drawn again.

   The lesson adds three nodes to the graph of "A first picture from text".

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have **Load Checkpoint**, the two texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** and **Save Image** with the links between them.

   If they are not there, do that lesson first.

3. **Load your picture**

   Add a **Load Image** node and choose the picture in its `image` field. ComfyUI takes pictures from its `input` folder; the button on the node uploads one there.

   The composition, the colours and the light of the result come from this picture.

4. **Bring the picture to a size the model knows**

   Add a **Scale Image to Total Pixels** node and connect the `IMAGE` output of **Load Image** to its `image` input. Set `megapixels` to 1.

   A model draws best at the size it was trained at. One megapixel is about 1024 × 1024, right for SDXL and newer models. For an SD 1.5 model set 0.25, that is 512 × 512. A photo from a phone is many times larger, and the model would repeat parts of it.

5. **Turn the picture into a latent**

   Add a **VAE Encode** node. Connect the output of **Scale Image to Total Pixels** to its `pixels` input and the `VAE` output of **Load Checkpoint** to its `vae` input.

   The sampler works not with pixels but with their compressed form. This node compresses the picture with the VAE of the same model that will draw.

6. **Give the sampler your picture**

   Connect the output of **VAE Encode** to the `latent_image` input of **KSampler**. The link from the empty latent is replaced: an input takes one link.

   The empty latent is not needed any more. Leave it or delete it: ComfyUI does not run a node whose output goes nowhere.

7. **Set how much to draw again**

   Set `denoise` of **KSampler** to 0.6.

   At 0.6 the composition and the large shapes stay, while textures, faces and the style follow the prompt. Lower it to 0.4 when the result must stay close to the original. Raise it to 0.8 when only the layout matters.

   Describe what should be in the picture, not what to change: the model does not compare, it draws.

8. **Compare variants fairly** (reading)

   To see what one setting does, change only that setting. Under `seed` of **KSampler** set "control after generate" to `fixed`: the noise then stays the same from run to run, and only what you changed makes the difference. With `randomize` every run starts from new noise, and you compare luck, not settings.

   Several variants in one run: in a graph from text, `batch_size` of the empty latent; here, a Repeat Latent Batch node between **VAE Encode** and **KSampler**. Each picture of a batch gets its own noise from the same `seed`.

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: `denoise` 0.4 and 0.8 on the same `seed`; a drawing or a sketch as the picture, with a prompt of a photo.

   Save Image writes the whole graph, prompts included, into the PNG it saves: the picture dragged into ComfyUI opens the graph again. Before you share a picture whose graph must stay private, convert it to another format or start ComfyUI with the `--disable-metadata` option, which writes no graph into the files.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 3, **Load your picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 4, **Bring the picture to a size the model knows**:
  - a **Scale Image to Total Pixels** node.
  - `IMAGE` of **Load Image** into `image` of **Scale Image to Total Pixels**.
  - `megapixels` of **Scale Image to Total Pixels** is from 0.2 to 2; **Do this for me** sets 1.
- Step 5, **Turn the picture into a latent**:
  - a **VAE Encode** node.
  - `IMAGE` of **Scale Image to Total Pixels** into `pixels` of **VAE Encode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Encode**.
- Step 6, **Give the sampler your picture**:
  - `LATENT` of **VAE Encode** into `latent_image` of **KSampler**.
- Step 7, **Set how much to draw again**:
  - `denoise` of **KSampler** is from 0.3 to 0.9; **Do this for me** sets 0.6.

## What next
These lessons go on from this one: [Inpainting: redraw part of a picture](Inpainting.md).

## See also
- [Image to image](../concepts/Image-To-Image.md)
- [Denoise](../concepts/Denoise.md)
- [How lessons work](How-Lessons-Work.md)
