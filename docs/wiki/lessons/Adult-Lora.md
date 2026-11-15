[Русский](Adult-Lora.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Adult LoRAs: how to load and balance them

<!-- lesson: adult-lora -->
Lesson "adult-lora", in the group **For adults (18+)**, the last group of the list. Steps: 11. This page gives the technique in general words.

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
You load your own LoRA, check which model it fits and learn to balance two LoRAs.

## What you need
- The graph of [A first picture from text](Image.md).
- Your own LoRA file in `models/loras`, made for the family of your model.
- The app downloads nothing.

## The steps
1. **First, the rules** (reading): the content rules of the app, in full (quoted above).
2. **Where the files go** (reading): a LoRA file goes into `models/loras`; then **Sync ▸ Sync now**, and it shows in the **Models** tab. The files and the words are yours: the lesson names none.
3. **A picture graph is needed**: the picture graph must be on the canvas.
4. **Put the LoRA between the model and the graph**: a Load LoRA node between the checkpoint and the graph, the way ComfyUI's own LoRA example wires it: `MODEL` and `CLIP` go through it to the sampler and to both text nodes.
5. **Does the file fit the model** (reading): a LoRA works only with the family it was made for; compare the family on the card of the file with the card of the model.
6. **The LoRA's words in the prompt**: read the file's trigger words on its card and type them into the prompt yourself.
7. **Two strengths** (reading): `strength_model` changes what the model draws, `strength_clip` how it reads the prompt; start from the author's strength, usually 0.6 to 1.
8. **Comparing on one seed** (reading): to see what a file does, keep the `seed` and every other field, and change only its strength: 0, the author's value, then higher.
9. **Two LoRAs: a body and a character** (reading): two LoRAs are chained; a body LoRA and a character LoRA often pull the face apart: tune one at a time, lower the body LoRA, put the character LoRA last, or fix the face in a separate pass.
10. **When two LoRAs fight** (reading): two LoRAs that teach different things add up and can smear the picture: lower both, or split them between two passes.
11. **About the assistant in the app** (reading): lessons need no assistant; a question in Ask goes to the model you chose, which answers by its own rules; the rules of the first step are the app's own. Sending the values of fields can be switched off in **Settings ▸ Privacy**.

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
- Step 4, **Put the LoRA between the model and the graph**:
  - a **Load LoRA** node.
  - `MODEL` of **Load Checkpoint** into `model` of **Load LoRA**.
  - `CLIP` of **Load Checkpoint** into `clip` of **Load LoRA**.
  - `MODEL` of **Load LoRA** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `CLIP` of **Load LoRA** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load LoRA** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `lora_name` of **Load LoRA**: a value is chosen.
  - the file in `lora_name` of **Load LoRA** is made for the family of the file in `ckpt_name` of **Load Checkpoint**. Why: a LoRA or a ControlNet works only with the family of models it was made for; with another family it does nothing or spoils the picture.
- Step 6, **The LoRA's words in the prompt**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds a trigger word of the file chosen in `lora_name` of **Load LoRA**, when the file's description names any.

## See also
- [Content rules](../trust/Content-Rules.md)
- [LoRA](../concepts/LoRA.md)
- [Lesson: LoRA for pictures](LoRA-Image.md)
- [Lesson: Refining with a second model](Refine.md)
- [Lesson: Pictures for adults](Adult-Image.md)
- [How lessons work](How-Lessons-Work.md)
