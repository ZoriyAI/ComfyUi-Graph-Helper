[Русский](Prompt-Video.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A description for video

<!-- lesson: prompt-video -->
Lesson "prompt-video": how to describe a clip so the model understands the motion and the camera.

## What you will be able to do
Write a clip prompt in five parts (subject, one action, place, camera, light), use the film words Wan knows, keep a prompt for video from a picture short, and know when the negative prompt acts.

## What you need
The graph of [Video from text](Video-Text.md) or [Video from a picture](Video-Image.md): a text node whose output reaches a `positive` input of a KSampler (Advanced) or WanImageToVideo. No new files.

## The steps
1. **How the description of a clip differs** (reading): Wan was trained on long captions; say what changes; weights hardly act; English or Chinese.
2. **A video graph is needed.**
3. **What a description is made of** (reading): who, what happens, where, camera, light; three to five sentences.
4. **Write a description to this pattern**: at least 80 characters, English, present tense.
5. **One action per clip** (reading): five seconds hold one action; name motion with a verb.
6. **Words for the camera** (reading): `static shot`, `pan left`, `tilt up`, `push in`, `pull back`, `tracking shot`, `orbit`, `handheld`; `close-up`, `wide shot`; `low angle`.
7. **When the clip starts from a picture** (reading): name the subject briefly, describe the change, never argue with the picture.
8. **The second text for video** (reading): the Chinese negative prompt of the templates, and why it does nothing at cfg 1.
9. **When the clip does not obey** (reading): what to change, in order.
10. **What the app will tell you** (reading): **Check** reads clip prompts too.

## What the lesson checks
The prompt that reaches a `positive` input of the video graph has at least 80 characters.

## Mistakes people make
- Three actions in five seconds: the model squeezes or drops them.
- A state instead of a motion ("she is happy" rather than "she turns and smiles").
- No camera sentence: the model moves the camera on its own. Write `static shot` if it must stand.
- Expecting the negative prompt to work with a speed-up LoRA (cfg 1).

## What next
[LoRA: add a style or a subject](LoRA.md) and [Fast video in four steps](Video-Fast.md).

## See also
- [The prompt](../concepts/Prompt.md)
- [The negative prompt](../concepts/Negative-Prompt.md)
- [Video models](../concepts/Video-Models.md)
- [Lesson: The description: how a model reads it](Prompt.md)
