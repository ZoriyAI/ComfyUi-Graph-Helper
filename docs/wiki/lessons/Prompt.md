[Русский](Prompt.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The description: how a model reads it

<!-- lesson: prompt -->
Lesson "prompt": what a model does with text, and how to steer a picture with words.

## What you will be able to do
Write a prompt in the manner your model reads (tags or sentences), put the main thing first, stress one thing with a weight, use the negative prompt correctly, and change one thing at a time with a fixed seed.

## What you need
The graph of [A first picture from text](Image.md) on the canvas: two CLIP Text Encode nodes connected to `positive` and `negative` of a KSampler. No new model files.

## The steps
Most steps are reading; four ask you to type.
1. **What a model does with text** (reading): captions, words that pull, what is left unsaid.
2. **A picture graph is needed**: the lesson looks for the two text nodes and the sampler.
3. **Two ways of reading** (reading): tag readers (SD 1.5, SDXL, Pony, Illustrious) and sentence readers (Flux, SD 3, Qwen-Image, Wan). The **Family** line of the model's card in the **Models** tab tells which.
4. **Order and length** (reading): the main thing first; CLIP reads 75-token chunks.
5. **Rewrite the description**: at least 40 characters in the positive text, main thing first.
6. **Weight** (reading): `(red coat:1.2)`; forms from other programs that do nothing; `embedding:name`, `{a|b}` and `\(`.
7. **Stress one thing**: put a weight between 0.5 and 1.5, other than 1, into the positive text.
8. **The second text** (reading): how the negative prompt works; why "no hat" adds a hat.
9. **Fill in the second text**: at least 5 characters in the negative text.
10. **cfg** (reading): how strictly to follow the text, with usual values per family.
11. **seed** (reading): one change at a time; `control_after_generate`.
12. **When the picture does not obey** (reading): what to check, in order.
13. **The app reads descriptions with you** (reading): the **Check** button and the model card.

## What the lesson checks
The positive text has at least 40 characters, then contains a weight `(words:number)` between 0.5 and 1.5 other than 1; the negative text has at least 5 characters.

## Mistakes people make
- A weight above 1.5 (the step refuses it) or exactly 1 (no effect).
- Writing `no hat` in the main prompt instead of `hat` in the negative.
- Expecting the negative prompt to act at cfg 1.
- On a sentence-reading model, expecting a strong effect from a weight.

## What next
[Refining with a second model](Refine.md), or the video lessons starting with [Video from text](Video-Text.md); for clips, [A description for video](Prompt-Video.md).

## See also
- [The prompt](../concepts/Prompt.md)
- [Prompt syntax and weights](../concepts/Prompt-Syntax.md)
- [The negative prompt](../concepts/Negative-Prompt.md)
- [CFG and guidance](../concepts/CFG.md)
- [Seed](../concepts/Seed.md)
- [The Check panel](../interface/Check-Panel.md)
