[Русский](Text-Encoders.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Text encoders: CLIP, T5 and others

The part of a model that reads the prompt, and why some models have two or three.

## In plain words
The drawing model does not read letters. A **text encoder** turns your prompt into numbers first, and the drawing model follows those numbers. In ComfyUI the text encoder travels along links of type `CLIP`, whatever kind it really is.

There are three generations of text encoders:
- **CLIP** (the text half of OpenAI's CLIP, in sizes `clip_l` and `clip_g`). It was trained on short image captions, reads up to 75 tokens at a time and understands words and short phrases better than grammar. SD 1.5 uses `clip_l`; SDXL uses both `clip_l` and `clip_g`.
- **T5** (Google's T5-XXL, and `umt5_xxl`, its many-language version). A language model that reads whole sentences, a few hundred tokens long. Flux.1 and SD3 use it next to CLIP; Wan uses `umt5_xxl` alone; Chroma uses T5 without CLIP.
- **Large language models**: Qwen2.5-VL for Qwen-Image, Qwen3 4B for Z-Image, a Mistral model for Flux.2 dev, Llama-based encoders for HunyuanVideo. They read long, detailed prompts and follow who does what and where.

**Why two?** A model trained with two encoders was taught to use both views of the prompt at once: CLIP for style and look, T5 for meaning and layout. Both must be loaded. SD3 even uses three (`clip_l`, `clip_g`, `t5xxl`).

## Where you meet it in a graph
- **Load Checkpoint** gives `CLIP` for SD 1.5 and SDXL.
- **Load CLIP** (`CLIPLoader`) loads one encoder; **DualCLIPLoader** loads two; **TripleCLIPLoader** loads three. Each has a `type` field naming the family.
- **CLIP Text Encode (Prompt)** takes `CLIP` and your text and gives `CONDITIONING`. Some families have their own text nodes (for example CLIPTextEncodeFlux with separate fields for CLIP and T5, or TextEncodeQwenImageEdit for editing).
- **CLIP Set Last Layer** makes CLIP stop one or two layers early ("clip skip"), which some SD 1.5 anime models ask for.

## Values and what they change
- `type` must match the model family.
- Text encoder files come in precisions: `fp16` is the reference; `fp8` versions (`t5xxl_fp8_e4m3fn`, `umt5_xxl_fp8_e4m3fn_scaled`) take half the memory with a small loss.
- `stop_at_clip_layer`: -1 is normal; -2 is "clip skip 2".

## Typical mistakes
- **Only one of two encoders loaded**: an error, or a model that ignores much of the prompt.
- **The wrong `type`**: nonsense pictures.
- **Writing tag lists for a sentence reader** (or long prose for CLIP): see [How models read the prompt](Prompt.md).
- **Running out of memory on T5-XXL**: use the `fp8` file.

## How the app helps
**Check** tells when a prompt is longer than CLIP's 75-token chunk or too long for T5. The card of a model in the **Models** tab shows its family, and the [prompt lesson](../lessons/Prompt.md) explains the two ways of reading.

## See also
- [The prompt](Prompt.md)
- [Prompt syntax and weights](Prompt-Syntax.md)
- [Conditioning](Conditioning.md)
- [Separate loaders](Separate-Loaders.md)
- [Model families](Model-Families.md)
