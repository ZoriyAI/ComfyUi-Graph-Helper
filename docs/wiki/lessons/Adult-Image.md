[Русский](Adult-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Pictures for adults: what changes

<!-- lesson: adult-image -->
<!-- verify: adult lessons changed; this lesson is being added (id "adult-image"), check its title and steps -->
Lesson "adult-image": the same levers as in the video lesson, for pictures: the model family, LoRAs made for it, the prompt. For adults only.

## The limits come first
The lesson opens with the rules. The one list of what the app never helps with, the consent rule for real people, and the 18+ switch are on [Content rules](../trust/Content-Rules.md). This page describes technique in general words only; there are no explicit texts or example prompts here.

## What you will be able to do
Know which picture families and fine-tuned lines suit the subject, how their prompt style differs (tags or sentences), why a LoRA must match the family, what the negative prompt and the size do, and how to diagnose poor results.

## What you need
The graph of [A first picture from text](Image.md). Files of your choice that are already in your ComfyUI; the app downloads nothing.

## The technique in general words
- **The family decides most**: fine-tuned lines differ in what they were trained on. The **Family** line on a model's card tells which family a file belongs to; the author's page tells the rest, including the words and settings the author used.
- **The prompt style follows the reader**: tag-reading lines (SDXL, Pony, Illustrious) and sentence-reading models need different writing; see [The prompt](../concepts/Prompt.md).
- **A LoRA** must be made for the family; with Load LoRA its trigger words go into the prompt.
- **The negative prompt** lists defects; the **size** must be the family's.

## What the lesson checks
A picture graph is on the canvas, and the positive prompt holds the trigger words of any LoRA loader on the canvas (none needed if there is no LoRA or its file names no words).

## See also
- [Content rules](../trust/Content-Rules.md)
- [Lesson: Video for adults](Adult.md)
- [Model families](../concepts/Model-Families.md)
- [LoRA](../concepts/LoRA.md)
- [Resolution and aspect ratio](../concepts/Resolution.md)
