[Русский](Sampler.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Sampler and sampler names

The node that turns noise into a picture step by step, and what the names in its `sampler_name` list mean in practice.

## In plain words
Generation starts from pure noise. At each **step** the model looks at the noisy latent and predicts what noise is in it; the **sampler** removes part of that noise and moves on. After the last step a clean latent remains, and VAE Decode turns it into a picture.

The **sampler node** is where everything meets: the model, the positive and negative conditioning, the starting latent and the settings. The **sampling algorithm** (`sampler_name`) is the rule for how each step moves; the [scheduler](Scheduler.md) decides how big each step is.

<!-- diagram: five small squares from left to right, from pure noise to a clear picture of a lake, labelled step 0, 5, 10, 15, 20 -->

## Where you meet it in a graph
- **KSampler**: inputs `model`, `positive`, `negative`, `latent_image`; fields `seed`, `control_after_generate`, `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise`; output `LATENT`.
- **KSampler (Advanced)**: adds `add_noise`, `start_at_step`, `end_at_step`, `return_with_leftover_noise`, to split one generation between two samplers (base and refiner, or the two Wan 2.2 models).
- **SamplerCustom** and **SamplerCustomAdvanced**: assembled from parts: `NOISE` (RandomNoise), `GUIDER` (CFGGuider, BasicGuider), `SAMPLER` (KSamplerSelect), `SIGMAS` (BasicScheduler and others). Flux and many newer templates use this form.
- Packs have their own samplers (for example WanVideo Sampler).

## Sampler names in practice
| Name | What people use it for |
|---|---|
| `euler` | Simple and dependable. The default in many Flux, Wan, Qwen-Image and Z-Image templates. A good first choice. |
| `euler_ancestral` (`_a`) | Adds fresh noise every step: more variety, softer look; the picture keeps changing as you change steps. |
| `dpmpp_2m` | Popular with SDXL and SD 1.5, usually with the `karras` scheduler; sharp at 20 to 30 steps. |
| `dpmpp_2m_sde`, `dpmpp_sde`, `dpmpp_3m_sde` | Stochastic: more fine detail and variation; slower per step. |
| `uni_pc`, `uni_pc_bh2` | Converge in few steps; used in some video graphs. |
| `ddim` | The classic; mostly for old graphs. |
| `lcm` | Only for LCM models and LCM LoRAs, at 4 to 8 steps and cfg about 1 to 2. |
| `res_multistep`, `er_sde`, `gradient_estimation` and others | Newer methods; use them when a template or model page names them. |

Names ending in `_ancestral` or `_sde` add noise during sampling, so the same seed gives slightly different results with different step counts. Names ending in `_gpu` do the same work with noise made on the graphics card.

## Typical mistakes
- **Changing sampler and scheduler at random**: on a well-trained model the difference is small next to the prompt and the seed. Start from the model's page.
- **An ancestral sampler when comparing settings**: results jump. Use `euler` for comparisons.
- **`lcm` on an ordinary model**: a blurry, unfinished picture.

## How the app helps
The node description of every sampler explains its inputs. In KSampler (Advanced) graphs the video lessons check that the two samplers hand over at the same step.

## See also
- [Scheduler](Scheduler.md)
- [Steps](Steps.md)
- [CFG and guidance](CFG.md)
- [Seed](Seed.md)
- [Denoise](Denoise.md)
- [Wan 2.2 two passes](Wan-Two-Passes.md)
