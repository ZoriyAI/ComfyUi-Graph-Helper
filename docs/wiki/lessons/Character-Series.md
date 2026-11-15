[Русский](Character-Series.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# One character in many pictures

<!-- lesson: character-series -->
Lesson "character-series", in the group **Faces and characters** of the lesson list. Steps: 8.

## Consent first
Only someone who agrees may be shown this way: yourself, a person who gave permission, or an invented character. Obtain consent before using a real person's likeness and permission for the source material, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who is or appears under 18; do not pass a person off as saying or doing what they did not. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You learn what holds a character's identity and practise a new pose and new clothes while the face stays.

## What you need
- It goes on from [The same character in a new picture: FLUX.1 Kontext](Character-Kontext.md). The card says so; it is a hint, not a lock.
- Nodes: Load Image, CLIP Text Encode (Prompt), ReferenceLatent, KSampler.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **First, about faces** (reading)

   Only someone who agrees may be shown this way: yourself, a person who gave permission, or an invented character. Obtain consent before using a real person's likeness and permission for the source material, and follow local law. Do not put a real person's likeness into explicit content; exclude anyone who is or appears under 18; do not pass a person off as saying or doing what they did not. This lesson teaches technique.

   This lesson goes on from the graph of "The same character in a new picture: FLUX.1 Kontext". The example is a character you generated, or your own photo.

2. **The Kontext graph is needed**

   The canvas must hold the graph of the Kontext lesson: **Load Image** with the reference, **CLIP Text Encode (Prompt)** with the prompt, **ReferenceLatent** that joins them and **KSampler**.

   If they are not there, do that lesson first.

3. **What holds identity, in the order to reach for it** (reading)

   Reach for these in order, and go to the next only when the one before is not enough:
   - the words of the prompt: the same features named the same way every time;
   - the seed: the same number keeps the same noise and so much of the same look;
   - a reference picture: Kontext, or a face adapter such as IP-Adapter FaceID;
   - a LoRA trained on the character: the steadiest, but it has to be trained first.

   The first two cost nothing. The reference is what this graph already has.

4. **Words that keep a character** (reading)

   Write a short "card" of the character once and copy it into every prompt: age group, hair, eyes, a mark, the clothes that belong to the character. For example: a woman in her thirties, short red hair, green eyes, a small scar over the left eyebrow.

   Then add only what changes. If one prompt says "red hair" and the next "auburn hair", the model hears two people.

5. **Change the pose and the clothes, keep the face**

   Rewrite the `text` of **CLIP Text Encode (Prompt)**: keep the card of the character and the words "keep her face", and change the pose and the clothes. For example: the same woman with short red hair and green eyes, now sitting on a bench in a yellow raincoat, looking to the side, keep her face.

   Run it in ComfyUI. The face should stay while everything you named changes. If the face drifts, the prompt changed too much at once: change the pose first, the clothes in the next picture.

6. **The seed while you search** (reading)

   While you look for the right words, fix `seed` in **KSampler** (in ComfyUI set `control_after_generate` to `fixed`). Then only your words change the picture, and you see what each word does.

   When the prompt is right, let the seed change again to get variants.

7. **When the reference is not enough** (reading)

   For a long series, other ways hold a face more firmly:
   - "The same face from one photo: IP-Adapter FaceID" puts a face from a photo into pictures of SD 1.5 and SDXL models;
   - a LoRA trained on the character holds face, body and clothes at once;
   - "Put a face onto a picture: ReActor" fixes the face after the picture is drawn.

   Each comes with the same rule: your own face, a person who agreed, or an invented character.

8. **What next** (reading)

   The next steps for a character: a start picture for video, so that a clip begins from the character you made ("The start picture is the anchor"), and a reference that holds the character through a whole clip ("A reference for the whole clip: Wan VACE"). A LoRA trained on the character holds it in pictures: "LoRA for a character: face, body, clothes, pose".

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The Kontext graph is needed**:
  - a **Load Image** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **ReferenceLatent** node.
  - a **KSampler** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `conditioning` of **ReferenceLatent**.
- Step 5, **Change the pose and the clothes, keep the face**:
  - `text` of **CLIP Text Encode (Prompt)** holds at least 80 characters.

## See also
- [Reference images: IP-Adapter, Redux, editing models](../concepts/Reference-Images.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
