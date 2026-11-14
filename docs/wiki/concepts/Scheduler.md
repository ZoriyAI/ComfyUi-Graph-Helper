[Русский](Scheduler.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Scheduler

How the noise is removed over the steps: big steps first, small ones at the end, or evenly.

## In plain words
The **scheduler** decides how much noise is left after each step. Picture a staircase from "all noise" down to "no noise": the scheduler sets the height of each stair. Most schedulers take big stairs at the start (where the composition forms) and small ones at the end (where fine detail forms). The list of noise levels is called the **sigmas**.

## Where you meet it in a graph
- The `scheduler` field of KSampler and KSampler (Advanced).
- **BasicScheduler**, KarrasScheduler, BetaSamplingScheduler and similar nodes give `SIGMAS` to SamplerCustom or SamplerCustomAdvanced.
- **ModelSamplingSD3**, ModelSamplingFlux and ModelSamplingAuraFlow change the model's own noise curve with a `shift` value. Wan graphs use ModelSamplingSD3 with `shift` 5 to 8: a higher shift spends more steps at high noise, which helps large layout and motion. The node's name is historical; Wan uses it too.

## Values in practice
| Name | Typical use |
|---|---|
| `normal` | The default; fine for most models. |
| `simple` | The default of many Flux, Wan, Qwen-Image templates. |
| `karras` | With `dpmpp_2m` and SDE samplers on SD 1.5 and SDXL; good detail at 20 to 30 steps. |
| `exponential`, `sgm_uniform` | Specific models and turbo or lightning versions ask for them. |
| `beta`, `linear_quadratic`, `kl_optimal`, `ddim_uniform` | Newer or special cases; use when a template names them. |

## Typical mistakes
- **Changing the scheduler of a distilled or turbo model**: these are trained for one schedule (often `simple` or `sgm_uniform`); others give blur or noise.
- **Forgetting shift on Wan**: sluggish motion, detail that falls apart.

## How the app helps
The video lessons check `shift` between 5 and 8 on both ModelSamplingSD3 nodes. The node descriptions explain SIGMAS and BasicScheduler.

## See also
- [Sampler and sampler names](Sampler.md)
- [Steps](Steps.md)
- [Wan 2.2 two passes](Wan-Two-Passes.md)
- [Data types](Data-Types.md)
