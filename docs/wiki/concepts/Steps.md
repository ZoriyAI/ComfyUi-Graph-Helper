[Русский](Steps.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Steps

How many steps a sampler takes, and what more of them changes.

## In plain words
`steps` is the number of times the sampler removes part of the noise. Each step costs about the same time, so 40 steps take twice as long as 20. More steps give a cleaner, more finished result up to a point; after that nothing improves and only the wait grows.

## Where you meet it in a graph
- `steps` on KSampler and KSampler (Advanced); `steps` on BasicScheduler for assembled samplers.
- In two-pass graphs, `start_at_step` and `end_at_step` split one run of `steps` between two samplers: both have the same `steps`, the first ends where the second starts.

## Values people use
| Model | Typical steps |
|---|---|
| SD 1.5, SDXL | 20 to 30 |
| Flux.1 dev | 20 to 30 |
| Flux.1 schnell | 4 |
| Z-Image Turbo | about 8 to 9 |
| Qwen-Image | 20 to 50 (fewer with its lightning LoRAs) |
| Wan 2.2 14B | 20, handed over at 10 |
| Wan 2.2 with lightx2v LoRAs | 4, handed over at 2 |
| LCM, lightning, turbo versions | 4 to 8 |

## Typical mistakes
- **Too few steps on a normal model**: a blurry, unfinished picture.
- **Many steps on a distilled model**: no gain, sometimes over-sharpened or burnt.
- **Mismatched hand-over in a two-pass graph**: steps lost or done twice; the second pass gets a clean or half-finished latent.
- **Comparing step counts with an ancestral sampler**: the picture changes for reasons other than steps.

## How the app helps
The video lessons check the step split (`end_at_step` of the first sampler equals `start_at_step` of the second, `steps` the same in both), and four steps with a speed-up LoRA. [The sampler's settings](../lessons/Sampler-Settings.md) explains the field. In **Properties**, a field with a built-in note has a button **What this field does** next to its name; it opens the note under the field: what the field does and what to put in it.

## See also
- [Sampler and sampler names](Sampler.md)
- [Scheduler](Scheduler.md)
- [CFG and guidance](CFG.md)
- [Speed-up LoRAs](Speed-Up-LoRAs.md)
- [Wan 2.2 two passes](Wan-Two-Passes.md)
