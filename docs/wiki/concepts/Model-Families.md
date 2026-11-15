[Русский](Model-Families.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Model families

SD 1.5, SDXL, Pony, Flux, Wan and the rest: what a family is, and the ones the app knows.

## In plain words
A **family** (or base model) is a model architecture and its original training: SD 1.5, SDXL, Flux.1, Wan 2.2. Thousands of fine-tuned models and LoRAs are built on top of a few families. Everything inside one family shares the same latent format, the same text encoders and the same VAE, which is why its parts fit together, and why parts of different families do not (see [Why families do not mix](Why-Families-Do-Not-Mix.md)).

The family of a file tells you:
- which loader nodes it needs (one checkpoint, or separate model, text encoder and VAE files);
- which empty latent node and sizes;
- which CFG and steps;
- how to write the prompt (tags or sentences);
- which LoRAs, ControlNets and VAEs fit.

## The families the app knows
| Family | Kind | Loading | Prompt style |
|---|---|---|---|
| [SD 1.5](Family-SD15.md) | Pictures, 512 px | Checkpoint | Tags |
| [SDXL](Family-SDXL.md) | Pictures, 1024 px | Checkpoint | Tags, short phrases |
| [Pony](Family-Pony.md) | Pictures, SDXL-based | Checkpoint | Tags with score tags |
| [Illustrious](Family-Illustrious.md) | Pictures, SDXL-based, anime | Checkpoint | Booru tags |
| [SD 3 / 3.5](Family-SD3.md) | Pictures | Checkpoint or separate, three encoders | Sentences |
| [Flux.1](Family-Flux1.md) | Pictures | Separate: model, clip_l + t5xxl, ae VAE | Sentences |
| [Krea 2](Family-Krea.md) | Pictures, its own architecture (FLUX.1 Krea [dev] is Flux.1) | Separate: model, qwen3vl_4b, qwen_image_vae | See the template |
| [Flux.2](Family-Flux2.md) | Pictures and editing | Separate, its own encoder and VAE | Sentences |
| [Chroma](Family-Chroma.md) | Pictures, from Flux.1 schnell | Separate, T5 only | Sentences |
| [Qwen-Image](Family-Qwen-Image.md) | Pictures, text in pictures, editing | Separate, Qwen2.5-VL encoder | Sentences |
| [Z-Image](Family-Z-Image.md) | Pictures, fast | Separate, Qwen3 encoder | Sentences |
| [Kolors](Family-Kolors.md) | Pictures | Its own loaders (ChatGLM) | Sentences |
| [AuraFlow](Family-AuraFlow.md) | Pictures | Checkpoint | Sentences |
| [Stable Cascade](Family-Stable-Cascade.md) | Pictures, in stages | Stage checkpoints | Tags or phrases |
| [Wan 2.1](Family-Wan21.md) | Video | Separate, umt5 encoder | Sentences |
| [Wan 2.2](Family-Wan22.md) | Video | Separate; 14B as a pair of experts | Sentences |
| [HunyuanVideo](Family-HunyuanVideo.md) | Video | Separate, clip_l + LLaVA-Llama3 | Sentences |
| [LTX-2](Family-LTX2.md) | Video with sound | Its own template | Sentences |

The app also recognises SD 2.x and PixArt files by name, without built-in texts about them.

## How to tell a file's family
The file's name often says it (`sdxl`, `flux1-dev`, `wan2.2`). Many `.safetensors` files also carry metadata that names the base model. Download pages name it too.

## How the app helps
The **Models** tab shows each file's **Family** (read from its header, or guessed from its name and marked as a guess); it can filter by family, and the card of a LoRA lists which of your models it fits. **Check** warns when files of different families meet in one path.

## See also
- [Why families do not mix](Why-Families-Do-Not-Mix.md)
- [Checkpoint](Checkpoint.md)
- [Separate loaders](Separate-Loaders.md)
- [Resolution and aspect ratio](Resolution.md)
- [The model library](../interface/Model-Library.md)
