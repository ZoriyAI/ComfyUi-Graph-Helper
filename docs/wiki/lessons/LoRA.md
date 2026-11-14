[Русский](LoRA.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# LoRA: add a style or a subject

<!-- lesson: lora -->
Lesson "lora": a LoRA in the path of both Wan 2.2 models, with its trigger words in the prompt.

## What you will be able to do
Put a LoRA loader into a model's path, choose the right file for each of the two Wan 2.2 models, set its strength, and find and use its trigger words.

## What you need
- The graph of [Video from text](Video-Text.md) or [Video from a picture](Video-Image.md): two Load Diffusion Model and two ModelSamplingSD3 nodes.
- A LoRA made for your Wan model, often a pair of files (`high` and `low`), in `models/loras`.
- Built-in node: LoraLoaderModelOnly (shown as "LoraLoaderModelOnly" or "Load LoRA (Model only)" depending on the ComfyUI version).

## The steps
1. **What a LoRA is** (reading): a small add-on that teaches one thing; made for its own model; Wan 2.2 LoRAs often come in pairs.
2. **A video graph is needed.**
3. **Add two LoRA nodes**: one per model.
4. **Put them into the model's path**: loader `MODEL` into the LoRA node, the LoRA node's `MODEL` into ModelSamplingSD3. For both models.
5. **Choose the files and the strength** (reading): `high` file for the `high_noise` path, `low` for `low_noise`; a single file goes into both; `strength_model` 1, lower to 0.6 to 0.8 if it overpowers; chain several.
6. **The words that switch a LoRA on** (reading): trigger words; the card of the file in the **Models** tab shows them when the author wrote them into the file.
7. **Put the LoRA's words into the description.**
8. **The LoRA is connected** (reading): compare with a clip without it; if nothing changed, check the file's family, the trigger words and the strength.

## What the lesson checks
A LoraLoaderModelOnly between each loader and its ModelSamplingSD3 (other LoRA loaders in between are allowed); the positive prompt holds one of the trigger words stored in the two LoRA files. If the files hold no words, the trigger step counts on its own.

## Mistakes people make
- A LoRA made for another family or size (SDXL, or Wan 1.3B with a 14B model): nothing happens, ComfyUI only logs warnings.
- The `low` file in the `high_noise` path.
- Strength 1.5 or more: the picture breaks.
- Forgetting the trigger words.

## What next
[Fast video in four steps](Video-Fast.md) uses this exact setup with a speed-up LoRA.

## See also
- [LoRA](../concepts/LoRA.md)
- [Speed-up LoRAs](../concepts/Speed-Up-LoRAs.md)
- [Why families do not mix](../concepts/Why-Families-Do-Not-Mix.md)
- [The model card](../interface/Model-Card.md)
