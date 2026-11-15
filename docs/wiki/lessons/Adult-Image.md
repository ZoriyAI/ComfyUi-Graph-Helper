[Русский](Adult-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Pictures for adults: what changes

<!-- lesson: adult-image -->
Lesson "adult-image", in the group **For adults (18+)**, the last group of the list. Steps: 11. This page gives the technique in general words.

## A closed group until you open it
The group is open only while the switch **Adult content (18+)** in **Settings ▸ Privacy** is on. It is off in a new profile. While it is off, the list shows the group as one row with a lock, the text "Lessons about adult content: pictures, LoRAs and video. They open with the switch “Adult content (18+)” in Settings ▸ Privacy." and the button **Open the setting**. Turning the switch on first asks **Turn on adult content?** and shows the rules; **I am 18 or older** turns it on, **Leave it off** does not.

A lesson of this group is never offered as the next lesson after an ordinary one, and an ordinary one never after it.

## The rules come first
The first step, **First, the rules**, shows the content rules of the app, the same words as Help ▸ Content rules:

> Adults (18+) may make any lawful adult content with the consent of everyone involved, and the app explains the technique. Keep these out of your work:
> - minors and anyone who looks like a minor, drawn characters included;
> - real people in explicit content; use a person's face or voice only with their consent;
> - sexual violence and coercion;
> - animals in explicit content;
> - anything the law forbids where you live.
>
> What you make and where you post it is your responsibility: the laws of your country and the rules of the sites.

See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You learn what the content of a picture depends on and check your graph.

## What you need
- The graph of [A first picture from text](Image.md).
- A picture model and, if you like, LoRAs of your choice, already in your ComfyUI. The lesson names no file and no word.
- The app downloads nothing.

## The steps
1. **First, the rules** (reading): the content rules of the app, in full (quoted above).
2. **The technique is the same** (reading): the graph is the one of "A first picture from text"; what comes out is decided by the model, the LoRA and the prompt.
3. **A picture graph is needed**: the picture graph must be on the canvas.
4. **The model and its family** (reading): base models draw such subjects poorly, so people take a further-trained model of a family, or a LoRA made for that family. Files of different families do not mix. The card of a file in the **Models** tab names its family.
5. **Tags or phrases, and the author's words** (reading): SD 1.5, SDXL, Pony and Illustrious read tags, Flux.1 reads phrases. A further-trained model has its author's own quality and rating words; the model's card shows the author's notes, trigger words and examples. The lesson lists no words.
6. **LoRA: strength, several, words** (reading): a LoRA node stands between the model and the rest of the graph; start from the author's strength, usually 0.6 to 1; several LoRAs are chained with less strength each.
7. **The LoRA's words in the prompt**: the trigger words of a LoRA on the canvas go into the prompt.
8. **The second text: defects** (reading): the second text lists defects; "no" in the main prompt does not work; at `cfg` 1 the second text does not act.
9. **The size for the family** (reading): each family has its own size: about 512 on the short side for SD 1.5, about 1024 × 1024 in area for SDXL, Pony and Illustrious.
10. **If the result is poor** (reading): what to change and in what order: family and words first, then the LoRA strength and the size, then `cfg`, then the seed.
11. **About the assistant in the app** (reading): lessons need no assistant; a question in Ask goes to the model you chose, which answers by its own rules; the rules of the first step are the app's own. The assistant gets the graph with its values, not your pictures; sending values can be switched off in **Settings ▸ Privacy**.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 3, **A picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler**.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 7, **The LoRA's words in the prompt**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds a trigger word of the file chosen in `lora_name` of any **Load LoRA** or `lora_name` of any **LoraLoaderModelOnly**, when the file's description names any.

## See also
- [Content rules](../trust/Content-Rules.md)
- [Model families](../concepts/Model-Families.md)
- [LoRA](../concepts/LoRA.md)
- [Resolution and aspect ratio](../concepts/Resolution.md)
- [Lesson: Adult LoRAs](Adult-Lora.md)
- [Lesson: Video for adults](Adult.md)
- [How lessons work](How-Lessons-Work.md)
