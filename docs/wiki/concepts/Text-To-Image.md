[Русский](Text-To-Image.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Text to image

The basic graph: a prompt in, a picture out. Seven nodes.

## In plain words
Text to image starts from an empty latent full of noise and lets the model remove the noise step by step, guided by your prompt. Every other kind of graph is a variation of this one.

<!-- diagram: Load Checkpoint (MODEL, CLIP, VAE) → CLIP Text Encode positive and negative → KSampler ← Empty Latent Image; KSampler → VAE Decode (with VAE from the checkpoint) → Save Image -->

## The graph
1. **Load Checkpoint**: the model. Outputs `MODEL`, `CLIP`, `VAE`.
2. **CLIP Text Encode (Prompt)** twice: the prompt and the negative prompt, both fed by `CLIP`.
3. **Empty Latent Image**: the blank, with `width`, `height`, `batch_size`.
4. **KSampler**: `model`, `positive`, `negative`, `latent_image` in; `steps`, `cfg`, `seed`, `sampler_name`, `scheduler`, `denoise` 1.0.
5. **VAE Decode**: the sampler's `LATENT` and the checkpoint's `VAE` in, `IMAGE` out.
6. **Save Image**: the picture goes to the `output` folder.

For families with [separate loaders](Separate-Loaders.md) step 1 becomes three nodes (Load Diffusion Model, Load CLIP or DualCLIPLoader, Load VAE), step 3 uses the family's empty latent node, and Flux dev adds FluxGuidance. The shape stays the same.

## Values to start with
SD 1.5: 512×512, 25 steps, cfg 7, `euler` or `dpmpp_2m` with `karras`. SDXL: 1024×1024, 25 steps, cfg 6. Flux dev: 1024×1024, 20 steps, cfg 1 with guidance 3.5. See [Model families](Model-Families.md) for the rest.

## Typical mistakes
- positive and negative swapped; a missing Save Image; a size far from the family's; `denoise` left below 1.

## How the app helps
The lesson [A first picture from text](../lessons/Image.md) builds exactly this graph with you, step by step, and checks each link.

## See also
- [Image to image](Image-To-Image.md)
- [Checkpoint](Checkpoint.md)
- [Sampler and sampler names](Sampler.md)
- [Resolution and aspect ratio](Resolution.md)
- [Lesson: A first picture from text](../lessons/Image.md)
