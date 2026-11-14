[Русский](Video-Fast.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Fast video in four steps

<!-- lesson: video-fast -->
Lesson "video-fast": a speed-up LoRA cuts twenty steps down to four.

## What you will be able to do
Put the `lightx2v` speed-up LoRAs into a Wan 2.2 graph and set the samplers for them: 4 steps, hand-over at step 2, cfg 1. And go back to full quality when the prompt is right.

## What you need
- The graph of [Video from text](Video-Text.md) or [Video from a picture](Video-Image.md), ideally after [LoRA: add a style or a subject](LoRA.md).
- The `lightx2v` (Wan 2.2 Lightning) LoRA files for your models: `high` and `low`, and the `t2v` or `i2v` version that matches your models, in `models/loras`.

## The steps
1. **Where the speed comes from** (reading): the LoRA teaches the model to do in four steps what usually takes twenty; less variety, slightly rougher motion.
2. **A video graph is needed.**
3. **Put a LoRA into both models**: two LoraLoaderModelOnly, each between its loader and its ModelSamplingSD3.
4. **Choose the speed-up files** (reading): `high` into the `high_noise` path, `low` into the `low_noise` path; `strength_model` 1.
5. **The two samplers**: the lesson finds them.
6. **Set four steps**: `steps` 4 in both; `end_at_step` 2 in the first, `start_at_step` 2 in the second.
7. **Set cfg to 1**: in both; with more, the clip burns. The negative prompt stops acting.
8. **Now it is fast** (reading): to return to quality, remove the LoRAs and set 20 steps, cfg 3.5, hand-over at 10.

## What the lesson checks
Both LoRA loaders in the model paths; `steps` exactly 4 in both samplers; `end_at_step` 2 and `start_at_step` 2; `cfg` exactly 1 in both. It does not check that the chosen files are speed-up LoRAs.

## Mistakes people make
- cfg left at 3.5: burnt, noisy clip.
- `t2v` speed-up files with `i2v` models, or the other way round.
- Leaving 20 steps: no speed gain, often over-cooked results.
- Counting on the negative prompt: at cfg 1 it does nothing.

## What next
The WanVideoWrapper lessons, starting with [Video on WanVideoWrapper](Wrapper.md), or [Two models in one graph](Two-Models.md).

## See also
- [Speed-up LoRAs](../concepts/Speed-Up-LoRAs.md)
- [CFG and guidance](../concepts/CFG.md)
- [Steps](../concepts/Steps.md)
- [Wan 2.2 two passes](../concepts/Wan-Two-Passes.md)
