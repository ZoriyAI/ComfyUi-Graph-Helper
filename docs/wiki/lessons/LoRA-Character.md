[Русский](LoRA-Character.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# LoRA for a character: face, body, clothes, pose

<!-- lesson: lora-character -->
Lesson "lora-character", in the group **Pictures: techniques** of the lesson list. Steps: 13.

## Consent first
A LoRA of a real person may be used only with that person's consent: only someone who agrees may be drawn this way. Get that consent first. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Three LoRAs on one picture, each tuned on its own, the face kept while a body or clothing LoRA works.

## What you need
- It goes on from [LoRA for pictures](LoRA-Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load LoRA.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What this lesson is about** (reading)

   A character is often built from several LoRAs: one for the person, one for the build of the body, one for the clothes, one for the style. Each pulls the picture its own way, and together they fight. This lesson shows how to tell them apart, how to see what each one does and how to keep the face.

   You bring your own LoRA files and write your own words. A LoRA of a real person may be used only with that person's consent: only someone who agrees may be drawn this way. Get that consent first. The characters are adults.

   The lesson goes on from "LoRA for pictures" and adds a third loader.

2. **The graph with two LoRAs is needed**

   The canvas must have the picture graph with **Load LoRA** and **Load LoRA** in a chain after **Load Checkpoint**, as "LoRA for pictures" leaves it.

   If they are not there, do that lesson first.

3. **The kinds of LoRA** (reading)

   - A character LoRA: one person or figure, the face first of all.
   - A body LoRA: the build, the proportions, the anatomy.
   - A clothing LoRA: one outfit or a kind of clothes.
   - A pose LoRA: a way to stand, sit or move.
   - A style LoRA: a manner of drawing, a kind of light, a film look.
   - A detail LoRA: more or less fine detail, sharper skin and cloth.
   - A speed-up LoRA: the same picture in fewer steps; it comes with its own number of steps and its own `cfg`.

   A pose LoRA gives a pose loosely. A pose that must be exact comes from ControlNet; that is the step about the pose further on.

4. **How to tell which kind a file is** (reading)

   The name of a file is not enough. Look in three places:
   - the card of the file in the "Models" tab: the base model, the trigger words and the notes its author wrote into the file;
   - the page the file came from: what it was trained on, the strength its author advises, the pictures made with it;
   - ComfyUI-Lora-Manager, when it is installed: it keeps the page, the pictures and the words of each LoRA, and this app reads them from there.

   A LoRA whose author names no kind and no words is tried alone first, at a medium strength, and looked at.

5. **Add a third LoRA**

   Add a third **Load LoRA** after **Load LoRA**: the `MODEL` and `CLIP` outputs of **Load LoRA** into its inputs, its outputs to where the outputs of **Load LoRA** went, the sampler and the two texts. Choose in `lora_name` the body or clothing LoRA.

   The character LoRA stays in **Load LoRA**, the style or the second one in **Load LoRA**.

6. **Start the new LoRA low**

   Set `strength_model` of **Load LoRA** to 0.5.

   The changes of all the LoRAs add up. A third one at full strength on top of two others usually breaks the picture. Raise it by 0.1 at a time while its part shows and the rest holds.

   `strength_clip` says how much the LoRA changes the reading of the words. Lower it when the words of one LoRA begin to pull the others: at 0 its words mean what they mean to the model without it.

7. **Write the words of all three**

   Add the trigger words of each LoRA to `text` of **CLIP Text Encode (Prompt)**.

   A LoRA without its words often does little. Words of a LoRA that is not in the graph do nothing, or they push the model somewhere odd: keep in the prompt only the words of the LoRAs that are there.

8. **See what each LoRA does** (reading)

   Under `seed` of **KSampler** set "control after generate" to `fixed`. Then make four runs with the same `seed`:
   - all three LoRAs;
   - without **Load LoRA**: set its `strength_model` and `strength_clip` to 0;
   - without **Load LoRA**, the same way;
   - without **Load LoRA**.

   Set each back after its run. Put the four pictures side by side: what is gone without a LoRA is what that LoRA does. In ComfyUI a node can also be switched off for a run with Bypass (Ctrl+B).

9. **In which order to tune them** (reading)

   Tune one LoRA at a time, the others at 0:
   - the character first, until the face is right;
   - then the body or the clothes, at the lowest strength where they show;
   - then the style, last and often lowest.

   The place of a loader in the chain changes almost nothing: the changes of the LoRAs add up in any order. What decides is the strength of each.

10. **Why a body LoRA changes the face, and how to keep it** (reading)

   A body or clothing LoRA was trained on pictures of people, with their faces. It learnt the faces too, and it pulls every face towards them.

   What holds the face:
   - a lower `strength_model` of the body or clothing LoRA;
   - `strength_clip` of that LoRA lower than its `strength_model`, so its words pull less;
   - the character LoRA a little stronger than the rest;
   - a pass over the face afterwards with the character LoRA in the model: see "Fixing faces and hands with a detailer".

11. **Body and pose together** (reading)

   A body LoRA gives the build, not an exact pose. For both, let each come from its own place:
   - the pose from a control picture, an OpenPose skeleton or a depth map of a person standing as you want, through ControlNet: see "ControlNet from a depth map";
   - the build from the body LoRA, at a strength where it does not fight the control.

   When the two fight, lower the strength of the ControlNet first and of the LoRA after. Hands and anatomy that come out wrong are fixed afterwards: a detailer with a hand detector, or inpainting of the hand.

12. **A LoRA for another model** (reading)

   A LoRA is made for one family. On another one it does nothing, or it breaks the picture with noise and odd colours: an SD 1.5 LoRA on SDXL, an SDXL LoRA on Flux. Pony and Illustrious grew from SDXL; their LoRAs load on each other but act weaker or strangely.

   The card of a file in the "Models" tab says its family.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: the four runs of the comparison; then the body LoRA at 0.3 and at 0.7 with the same `seed`, looking only at the face.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The graph with two LoRAs is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - a **Load LoRA** node.
  - a **Load LoRA** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
  - `MODEL` of **Load Checkpoint** into `model` of **Load LoRA** (first LoRA).
  - `MODEL` of **Load LoRA** (first LoRA) into `model` of **Load LoRA** (second LoRA).
  - `CLIP` of **Load LoRA** (first LoRA) into `clip` of **Load LoRA** (second LoRA).
- Step 5, **Add a third LoRA**:
  - a **Load LoRA** node.
  - `MODEL` of **Load LoRA** (second LoRA) into `model` of **Load LoRA** (third LoRA).
  - `CLIP` of **Load LoRA** (second LoRA) into `clip` of **Load LoRA** (third LoRA).
  - `MODEL` of **Load LoRA** (third LoRA) into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CLIP` of **Load LoRA** (third LoRA) into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load LoRA** (third LoRA) into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `lora_name` of **Load LoRA** (third LoRA) is not the same file as `lora_name` of **Load LoRA** (second LoRA).
  - the file in `lora_name` of **Load LoRA** (third LoRA) is made for the family of the file in `ckpt_name` of **Load Checkpoint**. Why: a LoRA or a ControlNet works only with the family of models it was made for; with another family it does nothing or spoils the picture.
- Step 6, **Start the new LoRA low**:
  - `strength_model` of **Load LoRA** (third LoRA) is from 0.2 to 0.7; **Do this for me** sets 0.5.
- Step 7, **Write the words of all three**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds a trigger word of the file chosen in `lora_name` of **Load LoRA** (first LoRA) or `lora_name` of **Load LoRA** (second LoRA) or `lora_name` of **Load LoRA** (third LoRA), when the file's description names any.

## See also
- [LoRA](../concepts/LoRA.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
