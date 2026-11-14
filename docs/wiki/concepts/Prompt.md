[Русский](Prompt.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# The prompt: how models read text

Writing a prompt a model understands: tags or sentences, order, length, language.

## In plain words
A model does not understand text the way a person does. It was trained on pictures with captions and learned which words go with which pictures. Your prompt pulls the result towards pictures whose captions looked like it. So:
- a word that was rare in the captions does little, however exact it sounds;
- a prompt is not an order: every word pulls its own way, and strong words outpull weak ones;
- what you leave unsaid, the model decides for itself.

## Two ways of reading
How you write depends on the [text encoder](Text-Encoders.md) of your model.

- **Tags and short phrases** (CLIP readers): SD 1.5, SDXL and the lines built on it. Example: `portrait of a woman, red coat, night street, rain, soft light`. Anime lines such as Pony and Illustrious were trained on booru-style tags (`1girl, red coat, outdoors, night, rain`), and Pony also expects its own quality tags at the start (`score_9, score_8_up, ...`); the model page lists them.
- **Whole sentences** (T5 and language-model readers): Flux, SD3, Qwen-Image, Z-Image, Wan, HunyuanVideo, LTX. Example: `A woman in a red coat stands on a night street in the rain. Soft light from a shop window falls on her face.` These models follow who does what and where, and Qwen-Image and Flux can even write short text into the picture if you put it in quotes.

## Order and length
- Put the main thing first: the subject, then the action, then the place, the light, the style.
- CLIP reads in chunks of 75 tokens (about 50 English words). Words in a later chunk hold together with the start less well.
- Sentence readers take a few hundred tokens, yet they too hold the end more weakly.
- Ten exact words work better than forty random ones. Every extra word takes attention from the rest.
- Most models were trained on English captions. Wan and Qwen-Image also understand Chinese well. Other languages work noticeably worse.

## For video
A clip also needs what changes: one action, the camera's move, the pace. See the lesson [A description for video](../lessons/Prompt-Video.md) and [Video models](Video-Models.md).

## Typical mistakes
- **Negations in the main prompt**: `no hat` tends to add a hat. Put unwanted things in the [negative prompt](Negative-Prompt.md).
- **Syntax from other programs**: `<lora:name:1>`, `BREAK`, `[word]` do nothing in ComfyUI. See [Prompt syntax and weights](Prompt-Syntax.md).
- **A tag list for a sentence reader**, or a novel for CLIP.
- **Colours and details bleed between objects** in tag models: describe each object in its own phrase.

## How the app helps
The **Check** panel reads prompts the way ComfyUI will and lists "Descriptions: worth changing": syntax from other programs, unmatched parentheses, weights above 1.5, the same word in both prompts, negations, non-English text, prompts too long for the encoder, a missing LoRA trigger word. The **Models** tab card shows the trigger words and example prompts the author stored in the file.

The app's own texts currently call the prompt a "description".

## See also
- [Prompt syntax and weights](Prompt-Syntax.md)
- [The negative prompt](Negative-Prompt.md)
- [Text encoders](Text-Encoders.md)
- [CFG and guidance](CFG.md)
- [Lesson: The description: how a model reads it](../lessons/Prompt.md)
- [The Check panel](../interface/Check-Panel.md)
