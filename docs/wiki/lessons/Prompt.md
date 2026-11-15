[Русский](Prompt.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The prompt: how a model reads it

<!-- lesson: prompt -->
Lesson "prompt", in the group **Pictures: first steps** of the lesson list. Steps: 13.

## What you will be able to do
You learn what a model does with text and how to steer a picture with words.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: CLIP Text Encode (Prompt), KSampler.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What a model does with text** (reading)

   A model does not understand text the way a person does. It was trained on pictures with captions and remembers which words stood next to which pictures. Your prompt pulls the result towards captions like it.

   Three things follow:
   - a word that was not in the captions does nothing, however exact it sounds;
   - a prompt is not an order: each word pulls its own way, and strong words outpull weak ones;
   - what you leave unsaid the model decides for itself.

   Next you take a prompt apart, piece by piece, on your own graph.

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have two **CLIP Text Encode (Prompt)** nodes connected to the `positive` and `negative` inputs of **KSampler**.

   If they are not there, do that lesson first.

3. **Two ways of reading** (reading)

   The text is read by a separate part of the model: it turns words into numbers. There are two kinds of this part, and one writes for them differently.

   The first kind reads words and short phrases separated by commas. SD 1.5, SDXL and the models built on them, Pony and Illustrious, work this way. A prompt that suits them: `portrait of a woman, red coat, night street, rain, soft light`.

   The second kind reads whole sentences and understands who does what and what is where. Flux, SD 3, Qwen-Image and Wan work this way. A prompt that suits them: `A woman in a red coat stands on a night street in the rain. Soft light from a shop window falls on her face.`

   Which kind your model is shows in its card in the "Models" tab: the line "Family". Most models were trained on English captions: write in English.

4. **Order and length** (reading)

   Words at the start of a prompt weigh more than words at the end. So the main thing goes first: who or what is in the frame, then what happens, then the place, the light and the style.

   Length matters too. Models of the first kind read text in chunks of 75 tokens. A token is a word or a piece of one, so 75 tokens come to about 50 English words. Whatever comes after falls into the next chunk and holds together with the start less well. Models of the second kind read a long prompt whole, up to a few hundred tokens, yet they too keep a weaker hold on what stands at the very end.

   Extra words are not harmless: each takes attention away from the rest. Ten exact words work better than forty random ones.

5. **Rewrite the prompt**

   In the `text` field of the **CLIP Text Encode (Prompt)** node that goes into the `positive` input write the prompt anew: the main thing first, then the action, the place, the light. At least 40 characters are needed.

   An example for a model of the first kind: `portrait of a woman, red coat, night street, rain, soft light`.

6. **Weight: how to stress what matters** (reading)

   When the model misses something of the prompt, that thing can be given more weight. In ComfyUI a weight is written like this: `(red coat:1.2)`. The words in the parentheses get a pull of 1.2 instead of the usual 1. A number below 1 weakens: `(rain:0.8)`.

   Keep a weight between 0.5 and 1.5. Above that a picture burns out and distorts. 1.1-1.3 is enough most of the time.

   The forms of other programs do not work in ComfyUI. `<lora:name:1>` connects nothing: a LoRA is added with a node of its own. `BREAK`, `AND` and square brackets are read by the model as plain characters. Prompts from other people's pages are often full of such forms: take them out.

   Three forms ComfyUI understands itself. Besides the weight these are `embedding:name` for the files of the `embeddings` folder, and curly braces: of the options written in them with a vertical bar between, one is taken at each run. Plain parentheses that must stay in the text are written with a backslash: `\(` and `\)`.

   On models of the second kind a weight acts weakly and unpredictably. For them what matters is said in words and put at the start.

7. **Stress one thing**

   In the same `text` field put the most important thing into parentheses and give it a weight: for example `(red coat:1.2)`. The weight must be between 0.5 and 1.5 and other than 1.

   If your model is of the second kind, do not expect a strong effect. The step is there so that you remember the form: you will meet it in other people's prompts.

8. **The second text: what must not be there** (reading)

   The text that goes into the `negative` input works differently from the first. At every step the model makes two sketches: one from your prompt and one from the second text. Then it moves away from the second sketch towards the first.

   So the second text names the very things to move away from: `blurry, extra fingers, watermark, text`. There is no need to write "no" there.

   In the main prompt negations do harm. Write `no hat` and a hat will most likely appear: the word `hat` pulls towards hats, and `no` weighs next to nothing. Whatever must not be there goes into the second text.

   A long second text is not better than a short one. Name what really creeps into your pictures.

9. **Fill in the second text**

   In the `text` field of the node that goes into the `negative` input list two or three defects separated by commas. For example: `blurry, extra fingers, watermark`.

   Then compare the pictures with this text and without it.

10. **cfg: how strictly to follow the text** (reading)

   The `cfg` field of the sampler sets how far the model moves from the second sketch towards the first. The larger the number, the more strictly it follows the prompt.

   Too small a value gives a limp picture that follows the text poorly. Too large a value gives burnt colours and harsh outlines.

   Usual values:
   - SD 1.5: 7-8;
   - SDXL, Pony, Illustrious: 5-7;
   - speeded-up models and speed-up LoRAs: 1-2;
   - Flux: 1. Its strictness is set by a separate node, not by this field.

   At `cfg` 1 the second sketch is not made at all. The text of the `negative` input then does nothing, whatever it says. The author gives the exact numbers on the model's page: start from those.

11. **seed: one change at a time** (reading)

   The `seed` field sets the noise a picture starts from. The same number with the same settings and the same prompt gives the same picture.

   This is used to see what a change did. Keep `seed` as it was, change one thing in the prompt and compare. If the number and the words change together, there is no telling which of them acted.

   In ComfyUI a switch named `control_after_generate` stands under the `seed` field. With `randomize` the number changes after every run, with `fixed` it stays.

   Once the prompt is ready, change `seed` to get different pictures from one prompt. Some of them simply fail by chance: that is normal.

12. **When the picture does not obey** (reading)

   What to check, and in what order:
   - the model misses part of the prompt: move that part nearer the start, take out extra words, raise its weight to 1.2-1.3;
   - colours and details are mixed up between objects: models of the first kind read words with no ties between them. Describe each object in a phrase of its own and take out extra colours;
   - the picture is burnt out: `cfg` is too high, or a weight is above 1.5;
   - the picture is dull and limp: `cfg` is too low, or `steps` is too few;
   - extra arms, two heads, doubled figures: the size is larger than the one the model was trained at. For SD 1.5 that is 512, for SDXL 1024;
   - the second text changes nothing: check that `cfg` is above 1;
   - nothing helps: change `seed`. Then check in the model's card that the prompt is written in its manner.

13. **The app reads prompts with you** (reading)

   The "Check" button on the top toolbar reads the prompts of a graph the way ComfyUI will. It says when forms of other programs are left in a text, the parentheses do not match, a weight is too high, the same thing stands in both texts, or the second text does not act because of `cfg` 1. These are advice, not errors: the graph runs with them too.

   The card of a model in the "Models" tab shows what its author wrote down: the words that switch a LoRA on, the strength the author advises, and the prompts the author's own examples were made from. Someone else's prompt that worked is the best textbook: copy it and change one thing at a time.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler**.
- Step 5, **Rewrite the prompt**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 40 characters and 4 real words, with no negation such as "no hat".
- Step 7, **Stress one thing**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds a weight in ComfyUI's form `(words:1.2)`, from 0.5 to 1.5 and not 1.
- Step 9, **Fill in the second text**:
  - `text` of **CLIP Text Encode (Prompt)** (negative prompt) holds at least 5 characters, not a copy of `text` of **CLIP Text Encode (Prompt)** (prompt).

## Mistakes people make
- A weight above 1.5 (the step refuses it) or exactly 1 (no effect).
- Writing `no hat` in the main prompt instead of `hat` in the negative.
- Expecting the negative prompt to act at cfg 1.
- On a sentence-reading model, expecting a strong effect from a weight.

## What next
These lessons go on from this one: [Pony and Illustrious: tags instead of sentences](Pony-And-Illustrious.md).

## See also
- [How lessons work](How-Lessons-Work.md)
- [The prompt](../concepts/Prompt.md)
- [Prompt syntax and weights](../concepts/Prompt-Syntax.md)
- [The negative prompt](../concepts/Negative-Prompt.md)
- [CFG and guidance](../concepts/CFG.md)
- [Seed](../concepts/Seed.md)
- [The Check panel](../interface/Check-Panel.md)
