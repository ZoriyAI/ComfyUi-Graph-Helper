[Русский](LoRA-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# LoRA for pictures

<!-- lesson: lora-image -->
Lesson "lora-image", in the group **Pictures: techniques** of the lesson list. Steps: 8.

## What you will be able to do
Two LoRAs in a chain change the style and the subject of a picture model, each with its own strength.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load LoRA.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What a LoRA is** (reading)

   A LoRA is a small file trained on top of a model: a style, a character, a kind of object. It does not replace the model, it bends it, and several can be chained.

   For pictures the LoRA loader changes two parts: the model that draws and the text reader. That is why it has two strengths. The lesson adds two loaders to the graph of "A first picture from text".

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have **Load Checkpoint**, the two texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** and **Save Image** with the links between them.

   If they are not there, do that lesson first.

3. **Put the first LoRA in**

   Add a **Load LoRA** node. Connect the `MODEL` and `CLIP` outputs of **Load Checkpoint** to its `model` and `clip` inputs. Its `MODEL` output then goes into `model` of **KSampler**, its `CLIP` output into `clip` of both texts. Choose the file in `lora_name`; ComfyUI looks for them in `models/loras`.

   Everything that used the model now uses the model with the LoRA.

4. **Set the strengths**

   Set `strength_model` of **Load LoRA** to 0.8. Leave `strength_clip` at 1.

   `strength_model` says how much the LoRA changes the drawing, `strength_clip` how much it changes the reading of the words. Above 1 a LoRA usually breaks the picture: burnt colours, doubled shapes. Its author often names the best value on its page.

5. **Chain a second LoRA**

   Add a second **Load LoRA** node after **Load LoRA**: the `MODEL` and `CLIP` outputs of **Load LoRA** into its inputs, its outputs to where the outputs of **Load LoRA** went. Choose another file in `lora_name` and set `strength_model` to 0.6.

   The effects of two LoRAs add up. Give each a little less than it would get alone; when they fight, lower the one that matters less.

6. **Write their words**

   Add the trigger words of both LoRAs to `text` of **CLIP Text Encode (Prompt)**.

   Many LoRAs act only on their words. The app compares the prompt with the words written in the files themselves and in the notes of ComfyUI-Lora-Manager when it is installed. A file without words asks for none, and the step counts on its own.

7. **Which LoRA fits** (reading)

   A LoRA works only with the family it was trained for: an SD 1.5 LoRA on SDXL does nothing or spoils the picture. Pony and Illustrious grew from SDXL but have LoRAs of their own; on each other they act weaker or strangely.

   Flux, Qwen-Image and Z-Image have no text reader inside the checkpoint: their LoRAs go into LoraLoaderModelOnly, which has only `strength_model`. The family of a file is shown by its card in the "Models" tab.

8. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: the same `seed` with each LoRA alone and with both; `strength_clip` 0, to see what the words of a LoRA do.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 3, **Put the first LoRA in**:
  - a **Load LoRA** node.
  - `MODEL` of **Load Checkpoint** into `model` of **Load LoRA** (first LoRA).
  - `CLIP` of **Load Checkpoint** into `clip` of **Load LoRA** (first LoRA) (a CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load LoRA** (first LoRA) into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CLIP` of **Load LoRA** (first LoRA) into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load LoRA** (first LoRA) into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `lora_name` of **Load LoRA** (first LoRA): a value is chosen.
  - the file in `lora_name` of **Load LoRA** (first LoRA) is made for the family of the file in `ckpt_name` of **Load Checkpoint**. Why: a LoRA or a ControlNet works only with the family of models it was made for; with another family it does nothing or spoils the picture.
- Step 4, **Set the strengths**:
  - `strength_model` of **Load LoRA** (first LoRA) is from 0.3 to 0.9; **Do this for me** sets 0.8.
- Step 5, **Chain a second LoRA**:
  - a **Load LoRA** node.
  - `MODEL` of **Load LoRA** (first LoRA) into `model` of **Load LoRA** (second LoRA).
  - `CLIP` of **Load LoRA** (first LoRA) into `clip` of **Load LoRA** (second LoRA).
  - `MODEL` of **Load LoRA** (second LoRA) into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CLIP` of **Load LoRA** (second LoRA) into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load LoRA** (second LoRA) into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `lora_name` of **Load LoRA** (second LoRA) is not the same file as `lora_name` of **Load LoRA** (first LoRA).
  - `strength_model` of **Load LoRA** (second LoRA) is from 0.3 to 0.8; **Do this for me** sets 0.6.
  - the file in `lora_name` of **Load LoRA** (second LoRA) is made for the family of the file in `ckpt_name` of **Load Checkpoint**. Why: a LoRA or a ControlNet works only with the family of models it was made for; with another family it does nothing or spoils the picture.
- Step 6, **Write their words**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds a trigger word of the file chosen in `lora_name` of **Load LoRA** (first LoRA) or `lora_name` of **Load LoRA** (second LoRA), when the file's description names any.

## What next
These lessons go on from this one: [A reference picture with IP-Adapter](IP-Adapter.md), [LoRA for a character: face, body, clothes, pose](LoRA-Character.md).

## See also
- [LoRA](../concepts/LoRA.md)
- [How lessons work](How-Lessons-Work.md)
