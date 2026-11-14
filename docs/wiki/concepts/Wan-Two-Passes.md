[Русский](Wan-Two-Passes.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Wan 2.2: the two passes

Why the large Wan 2.2 models come as a pair, and how two samplers share one generation.

## In plain words
Wan 2.2 14B is a "mixture of experts": two models of the same size trained for different stages of noise. The **high noise** expert works while the clip is still mostly noise and lays out the composition and the motion. The **low noise** expert takes over for the second half and finishes the detail. Only one is active at a time, so the pair costs the time of one model but needs both files on disk.

<!-- diagram: a bar of 20 steps; steps 0 to 10 coloured and labelled "high_noise model, sampler 1, adds noise, returns leftover noise"; steps 10 to 20 labelled "low_noise model, sampler 2, adds no noise" -->

## Where you meet it in a graph
- Two **Load Diffusion Model** nodes: `wan2.2_..._high_noise_14B` and `wan2.2_..._low_noise_14B` (`t2v` or `i2v` versions).
- Each model goes through its own **ModelSamplingSD3** (`shift`, 8 in the 20-step templates) and its own LoRAs.
- Two **KSampler (Advanced)** nodes:

| Field | First (high noise) | Second (low noise) |
|---|---|---|
| `add_noise` | enable | disable |
| `steps` | 20 | 20 (the same) |
| `cfg` | 3.5 | 3.5 |
| `start_at_step` | 0 | 10 |
| `end_at_step` | 10 | 10000 (to the end) |
| `return_with_leftover_noise` | enable | disable |

The first sampler's `LATENT` goes into the second's `latent_image`. Both get the same positive and negative conditioning. With speed-up LoRAs: 4 steps, hand-over at 2, cfg 1.

The **Wan 2.2 5B** model is one model, not a pair, with its own VAE (`wan2.2_vae`) and one ordinary sampler. In WanVideoWrapper the same split is made with `start_step` and `end_step` of two WanVideo Sampler nodes.

## Typical mistakes
- The same file in both loaders, or high and low swapped.
- Leftover noise not returned: the second pass has nothing to do and the clip looks unfinished.
- Hand-over steps that do not match: lost or doubled steps.
- Noise added in the second sampler: a noisy clip.

## How the app helps
The video lessons build this exact graph and check every field of the table (`cfg` 1 to 4, hand-over 1 to 15). The lesson names the samplers "first pass" and "second pass".

## See also
- [Wan 2.2](Family-Wan22.md)
- [Sampler and sampler names](Sampler.md)
- [Steps](Steps.md)
- [Speed-up LoRAs](Speed-Up-LoRAs.md)
- [Lesson: Video from text](../lessons/Video-Text.md)
