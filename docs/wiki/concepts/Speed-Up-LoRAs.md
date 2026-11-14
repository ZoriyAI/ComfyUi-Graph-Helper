[Русский](Speed-Up-LoRAs.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Speed-up LoRAs

LoRAs that let a model finish in 4 to 8 steps instead of 20 to 50.

## In plain words
A **speed-up LoRA** (also called a distill, lightning, turbo, hyper or LCM LoRA) was trained to imitate in a few steps what the model normally does in many. It also learns the effect of CFG, so it runs at cfg 1, which halves the time of each step again. Together the clip or picture is ready several times sooner.

The price: less variety, sometimes slower or stiffer motion in video, and a negative prompt that does nothing (cfg 1).

## Where you meet it
- **Wan 2.2**: `lightx2v` LoRAs (the Wan 2.2 Lightning family), one for the `high_noise` and one for the `low_noise` model, with separate files for `t2v` and `i2v`. Set 4 steps, hand over at step 2, cfg 1. Some fine-tuned Wan models have the speed-up built in (names with `light`, `fast`, `4steps`).
- **Wan 2.1**: `lightx2v` and CausVid LoRAs.
- **Qwen-Image**: Lightning LoRAs for 4 or 8 steps.
- **SDXL**: Lightning, Hyper-SD, LCM and DMD2 LoRAs (each with its own sampler, scheduler and step count from its page).
- Models that are distilled by themselves (Flux.1 schnell, Z-Image Turbo, SDXL Turbo) need no LoRA.

## Values
Take step count, cfg, sampler and scheduler from the LoRA's page. Usual: `strength_model` 1, cfg 1, 4 to 8 steps.

## Typical mistakes
- cfg left at a normal value: burnt, noisy results.
- `t2v` speed-up files with `i2v` models.
- 20 steps with a speed-up LoRA: no gain.
- Expecting the negative prompt to act.

## How the app helps
The lesson [Fast video in four steps](../lessons/Video-Fast.md) checks steps 4, the hand-over at 2 and cfg 1. **Check** says when cfg 1 silences a negative prompt.

## See also
- [LoRA](LoRA.md)
- [CFG and guidance](CFG.md)
- [Steps](Steps.md)
- [Wan 2.2 two passes](Wan-Two-Passes.md)
