[Русский](Adult-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Pictures for adults: what changes

This is a technique note, not a separate built-in lesson. It applies the same levers as the adult video lesson to pictures: model family, matching LoRAs and prompt style.

## The limits come first
For lawful consensual adult (18+) use, obtain consent for real likenesses, permission for source material and follow local law. This page stays factual and non-graphic. Subject choice and preview controls are explained in [Subject choice and adult education](../trust/Content-Rules.md).

## What you will be able to do
Know which picture families and fine-tuned lines suit the subject, how their prompt style differs (tags or sentences), why a LoRA must match the family, what the negative prompt and the size do, and how to diagnose poor results.

## What you need
The graph of [A first picture from text](Image.md). Files of your choice that are already in your ComfyUI; the app downloads nothing.

## The technique in general words
- **The family decides most**: fine-tuned lines differ in what they were trained on. The **Family** line on a model's card tells which family a file belongs to; the author's page tells the rest, including the words and settings the author used.
- **The prompt style follows the reader**: tag-reading lines (SDXL, Pony, Illustrious) and sentence-reading models need different writing; see [The prompt](../concepts/Prompt.md).
- **A LoRA** must be made for the family; with Load LoRA its trigger words go into the prompt.
- **The negative prompt** lists defects; the **size** must be the family's.

## What to check yourself
Check the picture graph, model family and LoRA trigger words using the catalog and model author’s notes. This note has no automatic lesson progress check. A green graph check does not prove execution or quality.

## See also
- [Content rules](../trust/Content-Rules.md)
- [Lesson: Video for adults](Adult.md)
- [Model families](../concepts/Model-Families.md)
- [LoRA](../concepts/LoRA.md)
- [Resolution and aspect ratio](../concepts/Resolution.md)
