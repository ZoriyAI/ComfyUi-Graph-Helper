[Русский](Negative-Prompt.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# The negative prompt

Saying what you do not want, and when it does nothing at all.

## In plain words
The **negative prompt** is the text that goes into the sampler's `negative` input. At every step the model makes two predictions: one from your prompt and one from the negative prompt. Then it moves away from the second towards the first. How far is set by [CFG](CFG.md).

So the negative prompt names the very things to move away from: `blurry, extra fingers, watermark, text`. There is no need to write "no".

## Where you meet it in a graph
A second **CLIP Text Encode (Prompt)** node, fed by the same `CLIP`, with its output in `negative`. Some pack nodes keep both texts in one node (WanVideoWrapper's text node has `positive_prompt` and `negative_prompt`).

## Values and what they change
- A short list of defects that really appear in your pictures works better than a long generic one.
- The ComfyUI templates for Wan carry a long negative prompt in Chinese (overexposure, still frame, blurred detail, subtitles, extra fingers, deformed hands); it can be kept as it is.
- Some newer models, and every model at CFG 1, ignore it.

## When it does nothing
At **CFG 1** the second prediction is not made at all, so the negative prompt has no effect, whatever it says. This is the case with Flux dev and schnell, Z-Image Turbo, Flux.2 Klein and other distilled models, and with speed-up LoRAs (lightx2v for Wan). For them, everything that matters must be in the main prompt.

## Typical mistakes
- **Negations in the main prompt** (`no hat`): the word `hat` pulls towards hats. Move it here.
- **The same word in both prompts**: two opposite instructions.
- **Expecting an effect at CFG 1.**
- **Empty negative prompt left unconnected**: the `negative` input is required. Connect an encode node with empty text (or, for some models, a ConditioningZeroOut node).

## How the app helps
**Check** says when a sampler has cfg 1 so the negative prompt does nothing, and when the same thing stands in both prompts, and when the main prompt holds a negation.

## See also
- [The prompt](Prompt.md)
- [CFG and guidance](CFG.md)
- [Conditioning](Conditioning.md)
- [Speed-up LoRAs](Speed-Up-LoRAs.md)
