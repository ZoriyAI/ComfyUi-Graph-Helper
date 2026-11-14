[Русский](VAE.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# VAE

The part that turns a latent into a picture and a picture into a latent.

## In plain words
A **VAE** (variational autoencoder) is a small model with two halves. The **encoder** squeezes a picture into a [latent](Latent.md). The **decoder** unfolds a latent back into pixels. The sampler only ever sees latents, so every graph that shows a result ends with a VAE decoding it, and every graph that starts from a picture begins with a VAE encoding it.

Each family has its own latent "language", so each family has its own VAE. SD 1.5 and SDXL VAEs differ; Flux.1, Chroma and Z-Image share `ae.safetensors`; Wan 2.1 and the Wan 2.2 14B models share `wan_2.1_vae`, while Wan 2.2 5B needs `wan2.2_vae`; Qwen-Image has `qwen_image_vae`.

## Where you meet it in a graph
- **Load VAE** (`VAELoader`) reads a file from `models/vae`; Load Checkpoint also has a `VAE` output.
- **VAE Decode** (`VAEDecode`): inputs `samples` (LATENT) and `vae`; output `IMAGE`.
- **VAE Encode** (`VAEEncode`): inputs `pixels` (IMAGE) and `vae`; output `LATENT`.
- **VAE Encode (for Inpainting)**, InpaintModelConditioning, WanImageToVideo and other start nodes take a `vae` input too.
- **Tiled** versions (VAE Decode (Tiled), VAE Encode (Tiled)) work in pieces to save memory on large pictures and long videos.

## Values and what they change
There are no strengths to set. What matters is the right file. Tiled nodes have `tile_size` and overlap fields: smaller tiles use less memory and take longer; too little overlap shows seams.

## Typical mistakes
- **VAE of another family**: washed-out or wrong colours, a grid pattern, noise, or an error about channels.
- **A broken VAE in an old checkpoint**: some early SDXL and SD 1.5 checkpoints have a VAE that gives black pictures in half precision (fp16). A separate fixed VAE in Load VAE cures it.
- **Out of memory at the very end**: decoding a big picture or a long clip needs a lot of memory. Use the tiled decode.
- **Decoding the latent of one model with the VAE of another** in a two-model graph: each picture is decoded by the VAE of the model that drew it.

## How the app helps
The descriptions of VAE nodes say what the VAE does and that it must match the family. **Check** names models of different families in one path. The lessons tell exactly which VAE file each video graph needs.

## See also
- [Latent](Latent.md)
- [Separate loaders](Separate-Loaders.md)
- [Checkpoint](Checkpoint.md)
- [Why families do not mix](Why-Families-Do-Not-Mix.md)
- [Graphics card memory](Graphics-Card-Memory.md)
