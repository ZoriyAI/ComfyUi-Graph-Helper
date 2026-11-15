[Русский](Data-Types.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Data types

MODEL, CLIP, VAE, LATENT, IMAGE, CONDITIONING and the other kinds of data a link carries.

## In plain words
Every link carries one kind of data, its **type**. The type decides which input can take the link. This page lists the types a newcomer meets in built-in nodes. Packs add their own.

## The common types

| Type | What it carries | Comes from | Goes to |
|---|---|---|---|
| `MODEL` | The diffusion model, the part that removes noise and draws | Load Checkpoint, Load Diffusion Model, LoRA loaders, model tuning nodes | Samplers, LoRA loaders, ModelSampling nodes |
| `CLIP` | The text encoder, the part that reads the prompt | Load Checkpoint, Load CLIP, DualCLIPLoader, Load LoRA | CLIP Text Encode and other text nodes |
| `VAE` | The model that turns pixels into a latent and back | Load Checkpoint, Load VAE | VAE Decode, VAE Encode, inpainting and video start nodes |
| `CONDITIONING` | An encoded prompt plus any hints attached to it (ControlNet, area, guidance) | Text nodes, ControlNet, guidance and combine nodes | `positive` and `negative` inputs of samplers |
| `LATENT` | A picture or video in compressed form; a video latent is compressed in time too | Empty latent nodes (a video one has a `length`), VAE Encode, video start nodes, samplers | Samplers, latent upscale, VAE Decode |
| `IMAGE` | Ordinary pictures in pixels, always a batch (one or more) | Load Image, VAE Decode, image nodes | Save Image, Preview Image, VAE Encode, upscalers, ControlNet |
| `MASK` | A black and white map of what to change | Load Image, mask nodes, the mask editor | Inpainting nodes, SetLatentNoiseMask |
| `CONTROL_NET` | A loaded ControlNet model | Load ControlNet Model | Apply ControlNet |
| `UPSCALE_MODEL` | A loaded upscale model | Load Upscale Model | Upscale Image (using Model) |
| `CLIP_VISION`, `CLIP_VISION_OUTPUT` | An image encoder, and one picture encoded by it | Load CLIP Vision, CLIP Vision Encode | Style, unCLIP and image to video nodes |
| `SIGMAS`, `SAMPLER`, `GUIDER`, `NOISE` | The parts of an assembled sampler: the noise schedule, the algorithm, the guidance, the starting noise | BasicScheduler, KSamplerSelect, CFGGuider or BasicGuider, RandomNoise | SamplerCustom, SamplerCustomAdvanced |
| `VIDEO`, `AUDIO` | A finished clip, a sound | Create Video, Load Video, Load Audio | Save Video, Get Video Components, audio nodes |
| `INT`, `FLOAT`, `STRING`, `BOOLEAN`, `COMBO` | Field values: whole number, decimal, text, yes or no, a choice from a list | Primitive and math nodes | Any field of that type turned into an input |

## Typical mistakes
- Trying to save a `LATENT`: decode it first with VAE Decode.
- Feeding a video sampler the empty latent of a picture: the type is the same `LATENT`, so the link attaches, but a video needs a latent with a length. Use the empty latent or start node of the video family.
- Plugging a `CONDITIONING` meant for `negative` into `positive`: the sampler then moves away from what you asked for.
- Expecting a pack's type to fit a built-in input: `WANVIDEOMODEL` is not `MODEL`.

## How the app helps
Select a link on the canvas and the **Explain** tab describes its type in plain words. **Check** names any link whose types do not match.

## See also
- [Nodes, inputs, outputs and links](Nodes-And-Links.md)
- [Latent](Latent.md)
- [VAE](VAE.md)
- [Conditioning](Conditioning.md)
- [Node reference](../interface/Node-Card.md)
