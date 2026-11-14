[Русский](Adult.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video for adults: what changes

<!-- lesson: adult -->
<!-- verify: adult lessons changed -->
Lesson "adult": what the content of a clip depends on, the limits the app keeps, and a check of your graph. For adults only.

## The limits come first
The lesson opens with the rules, and so does this page. The app teaches technique and does not decide for you what to make, within one list of things it never helps with, written in the same words everywhere. That list, and how the 18+ switch works, is on [Content rules](../trust/Content-Rules.md). Face and voice of a real person need that person's consent. The laws of your country and the rules of the places where you post are your responsibility.

The lessons for adults stand apart from the others and are not offered as "the next lesson". This page describes technique in general words only; the app has no explicit texts and no ready scene descriptions, and neither does this wiki.

## What you will be able to do
Understand the three levers that decide what a clip shows (the model, a LoRA, the prompt), choose a fine-tuned model or a LoRA that fits your Wan model, set the samplers the way such a model needs, and diagnose poor results.

## What you need
The graph of [Video from text](Video-Text.md) or [Video from a picture](Video-Image.md). Files of your choice that are already in your ComfyUI; the app downloads nothing and shows on a file's card which model it belongs to.

## The technique in general words
- **The model**: most base models were trained with little such material and handle it poorly. A fine-tuned version or a LoRA made for the subject fixes that. Either must fit your exact model: `t2v` or `i2v`, the Wan version, the size.
- **A fine-tuned Wan 2.2 model** usually comes as a pair chosen in the two loaders. Some have the speed-up built in (names with `light`, `fast`, `4steps`): they take the settings of [Fast video in four steps](Video-Fast.md) and no speed-up LoRA. Others take the normal settings; the author's page has the numbers.
- **A LoRA** goes into both model paths as in [LoRA: add a style or a subject](LoRA.md), on top of a fine-tuned model too; with a speed-up LoRA, chain them.
- **The prompt**: plain words, in order (who, what happens, where, camera, light), and a plain statement that the people shown are adults. What is left out the model invents. The negative prompt lists defects and does nothing at cfg 1.
- **Trigger words** of a LoRA on the canvas go into the prompt.

## What the lesson checks
A video graph is on the canvas (two loaders and two ModelSamplingSD3 nodes), and the prompt that reaches a `positive` input holds the trigger words of any LoraLoaderModelOnly on the canvas. Without a LoRA, or without words in its file, that step counts on its own.

## Mistakes people make
- Anatomy drifts: lower the LoRA strength to 0.6 to 0.8, or shorten `length`.
- The subject does not appear: trigger words missing, or a file for another model.
- A burnt clip: cfg above 1 with a speed-up LoRA or a built-in speed-up.
- Jerky motion: calmer motion, `fps` 16.
- Everything off: another seed.
- Cloud assistants usually refuse such topics; a local model answers as it was trained. What is sent to an assistant is set in **Settings ▸ Privacy**.

## See also
- [Content rules](../trust/Content-Rules.md)
- [Lesson: Pictures for adults](Adult-Image.md)
- [LoRA](../concepts/LoRA.md)
- [Speed-up LoRAs](../concepts/Speed-Up-LoRAs.md)
- [What is sent](../assistant/What-Is-Sent.md)
