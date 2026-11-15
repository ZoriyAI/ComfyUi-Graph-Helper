[Русский](CFG.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# CFG and guidance

How strictly the model follows the prompt, and the separate "guidance" number of Flux.

## In plain words
**CFG** (classifier-free guidance) is the `cfg` field of a sampler. At each step the model predicts twice: once with your prompt, once with the negative prompt (or with nothing). The final step moves from the second prediction towards the first, multiplied by `cfg`. A larger number means the picture follows the prompt more strictly.

- Too low: a limp, washed-out picture that follows the prompt loosely.
- Too high: burnt colours, harsh outlines, artifacts.
- Exactly **1**: the second prediction is skipped. The step is twice as fast, and the negative prompt does nothing.

**Guidance** in Flux dev is a different number. Flux dev was distilled: it learned the effect of CFG and takes the desired strength as an input, written into the conditioning by the **FluxGuidance** node (`guidance`, around 3.5). The sampler's own `cfg` stays at 1. People call this "distilled CFG".

## Where you meet it in a graph
- `cfg` on KSampler, KSamplerAdvanced, SamplerCustom, CFGGuider, and the samplers of packs.
- `guidance` on FluxGuidance (Flux.1 dev and models built on it).
- Two-pass video graphs have a `cfg` on each sampler.

## Values people use
| Model | Typical `cfg` |
|---|---|
| SD 1.5 | 7 to 8 |
| SDXL, Pony, Illustrious | 5 to 7 (Pony often lower) |
| SD 3.5 | about 4 to 5 |
| Flux.1 dev, FLUX.1 Krea [dev] | 1, with FluxGuidance about 3.5 |
| Flux.1 schnell, Z-Image Turbo and other distilled models | 1 |
| Qwen-Image | about 2.5 to 4 |
| Wan 2.2 14B (20 steps) | 3.5 |
| Any model with a speed-up LoRA | 1 |

The model's page is the final word: authors give the values they tested.

## Typical mistakes
- **A burnt picture**: cfg too high for the model, or a speed-up LoRA with cfg above 1.
- **Raising both** FluxGuidance and cfg on Flux dev: harsh pictures and double time.
- **"The negative prompt does nothing"**: cfg is 1.

## How the app helps
The lessons check cfg ranges (1 to 4 for Wan's two passes, exactly 1 with a speed-up LoRA) and say why. **Check** says when cfg 1 leaves a negative prompt without effect. In **Properties**, a field with a built-in note has a button **What this field does** next to its name; it opens the note under the field: what the field does and what to put in it.

## See also
- [The negative prompt](Negative-Prompt.md)
- [Sampler and sampler names](Sampler.md)
- [Steps](Steps.md)
- [Speed-up LoRAs](Speed-Up-LoRAs.md)
- [Flux.1](Family-Flux1.md)
