[Русский](Why-Families-Do-Not-Mix.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Why files of different families do not mix

Why an SDXL LoRA does nothing on Flux, and a Flux VAE breaks an SDXL picture.

## In plain words
Each family speaks its own internal language:
- **Its latent** has its own number of channels and its own meaning for each number. An SDXL latent fed to Flux is like a page in a language Flux never learned.
- **Its text encoder** turns words into numbers in its own way. The drawing model learned to follow exactly those numbers.
- **Its weights** have their own layers and shapes. A LoRA is a set of small changes to named layers of one model; on another model those layers do not exist or mean something else.
- **Its VAE** encodes and decodes its own latent format.

Fine-tuned models stay inside their family. So Pony and Illustrious are SDXL inside: SDXL LoRAs load on them, though LoRAs trained for Pony or Illustrious fit best.

## What you see when you mix
| Mixed | What happens |
|---|---|
| LoRA of another family | Loads with "lora key not loaded" warnings in the log; no visible change, or a damaged picture |
| VAE of another family | An error about channels or shapes, or wrong colours and noise |
| Text encoder of another family, or the wrong `type` | An error about sizes, or pictures that ignore the prompt |
| Latent passed between families | Noise, a mess, or an error |
| ControlNet of another family | An error or no effect |
| Wan 1.3B LoRA on Wan 14B (sizes within a family) | Does not load properly |

## What does work between families
A **picture**. Pixels mean the same to every model. Decode with the first family's VAE, encode with the second's, and go on. That is how a picture model can make the first frame of a Wan video, or how one model refines another's picture.

Within a family, some versions share parts: Wan 2.2 14B uses the Wan 2.1 VAE, and many Wan 2.1 14B LoRAs work on Wan 2.2 14B (test them, results vary).

## How the app helps
The **Models** tab shows each file's family; a LoRA's card says which of your models it fits, and when you have none of its family. **Check** reports "Models from different families" in one path, naming both files.

## See also
- [Model families](Model-Families.md)
- [LoRA](LoRA.md)
- [VAE](VAE.md)
- [Latent](Latent.md)
- [Lesson: Two models in one graph](../lessons/Two-Models.md)
