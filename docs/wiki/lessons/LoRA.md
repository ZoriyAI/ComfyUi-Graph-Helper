[Русский](LoRA.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# LoRA: add a style or a subject

<!-- lesson: lora -->
Lesson "lora", in the group **Video** of the lesson list. Steps: 8.

## What you will be able to do
You connect a LoRA to both models and put its words into the prompt.

## What you need
- It goes on from [Video from text](Video-Text.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - the high_noise half of Wan 2.2: `models/diffusion_models`, for example `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`;
  - the low_noise half of Wan 2.2: `models/diffusion_models`, for example `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`;
  - a LoRA for Wan: the high file of a pair, or a single LoRA: `models/loras`, for example `my_style_wan22_high_noise.safetensors`;
  - a LoRA for Wan: the low file of a pair, or a single LoRA: `models/loras`, for example `my_style_wan22_low_noise.safetensors`.
- Nodes: Load Diffusion Model, ModelSamplingSD3, LoraLoaderModelOnly, CLIP Text Encode (Prompt), WanImageToVideo / KSampler (Advanced) / KSampler.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What a LoRA is** (reading)

   A LoRA is a small addition to a model. It teaches the model one thing: a style, a character, an object, a kind of motion.

   A LoRA is made for its own model. A LoRA for Wan does not work with SDXL, nor the other way round. In the "Models" tab on the left the card of a file shows which model it belongs to.

   Wan 2.2 has two models, so a LoRA often comes as a pair of files: `high` and `low`.

2. **A video graph is needed**

   This lesson goes on from the graph of "Video from text" or "Video from a picture". The canvas must have two **Load Diffusion Model** nodes and two **ModelSamplingSD3** nodes.

   If they are not there, do one of those lessons first.

3. **Add two LoRA nodes**

   Add two **LoraLoaderModelOnly** nodes: one for each model.

4. **Put them into the model's path**

   Each LoRA node stands between a model loader and its **ModelSamplingSD3** node:
   - the `MODEL` output of **Load Diffusion Model** to the `model` input of the LoRA node;
   - the `MODEL` output of the LoRA node to the `model` input of **ModelSamplingSD3**.

   Do this for both models. The model passes through the LoRA and comes out changed.

5. **Choose the files and the strength**

   Choose a file in `lora_name`. The node in the path of the `high_noise` model takes the `high` file, the one in the path of `low_noise` the `low` file. If the LoRA is a single file, put it into both nodes.

   `strength_model` is the strength. 1 means full strength. If the LoRA overrides everything else or spoils the picture, lower it to 0.6-0.8.

   Several LoRAs are chained: the output of one LoRA node to the input of the next.

6. **The words that switch a LoRA on** (reading)

   Many LoRAs act only when the prompt holds their words. These are called trigger words.

   Open the card of the file in the "Models" tab: if the author wrote these words into the file, they are shown there. If they are not, look at the page you took the LoRA from.

7. **Put the LoRA's words into the prompt**

   Add your LoRA's words to the `text` field of the **CLIP Text Encode (Prompt)** node whose output goes into a `positive` input.

   The app compares the prompt with the words written in the LoRA file itself. If its author wrote none there, there is nothing to compare with and the step counts on its own.

8. **The LoRA is connected** (reading)

   Run the graph in ComfyUI and compare with the clip without the LoRA.

   If nothing changed, check three things: the file fits the model, the trigger words are in the prompt, the strength is not too low.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A video graph is needed**:
  - a **Load Diffusion Model** node.
  - a **Load Diffusion Model** node.
  - a **ModelSamplingSD3** node.
  - a **ModelSamplingSD3** node.
  - `unet_name` of **Load Diffusion Model** (first pass) holds the high_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `unet_name` of **Load Diffusion Model** (second pass) holds the low_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 3, **Add two LoRA nodes**:
  - a **LoraLoaderModelOnly** node.
  - a **LoraLoaderModelOnly** node.
- Step 4, **Put them into the model's path**:
  - `MODEL` of **Load Diffusion Model** (first pass) into `model` of **LoraLoaderModelOnly** (LoRA of the first pass) (a LoraLoaderModelOnly or ModelSamplingSD3 in between is accepted).
  - `MODEL` of **LoraLoaderModelOnly** (LoRA of the first pass) into `model` of **ModelSamplingSD3** (shift of the first pass) (a LoraLoaderModelOnly in between is accepted); or `MODEL` of **ModelSamplingSD3** (shift of the first pass) into `model` of **LoraLoaderModelOnly** (LoRA of the first pass) (a LoraLoaderModelOnly in between is accepted).
  - `MODEL` of **Load Diffusion Model** (second pass) into `model` of **LoraLoaderModelOnly** (LoRA of the second pass) (a LoraLoaderModelOnly or ModelSamplingSD3 in between is accepted).
  - `MODEL` of **LoraLoaderModelOnly** (LoRA of the second pass) into `model` of **ModelSamplingSD3** (shift of the second pass) (a LoraLoaderModelOnly in between is accepted); or `MODEL` of **ModelSamplingSD3** (shift of the second pass) into `model` of **LoraLoaderModelOnly** (LoRA of the second pass) (a LoraLoaderModelOnly in between is accepted).
- Step 5, **Choose the files and the strength**:
  - `lora_name` of **LoraLoaderModelOnly** (LoRA of the first pass) holds a LoRA for Wan: the high file of a pair, or a single LoRA; such a file lies in `models/loras`, for example `my_style_wan22_high_noise.safetensors`.
  - `lora_name` of **LoraLoaderModelOnly** (LoRA of the second pass) holds a LoRA for Wan: the low file of a pair, or a single LoRA; such a file lies in `models/loras`, for example `my_style_wan22_low_noise.safetensors`.
- Step 7, **Put the LoRA's words into the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **WanImageToVideo** or **KSampler (Advanced)** or **KSampler** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **WanImageToVideo** or **KSampler (Advanced)** or **KSampler**.
  - `text` of **CLIP Text Encode (Prompt)** holds a trigger word of the file chosen in `lora_name` of **LoraLoaderModelOnly** (LoRA of the first pass) or `lora_name` of **LoraLoaderModelOnly** (LoRA of the second pass), when the file's description names any.

## Mistakes people make
- A LoRA made for another family or size (SDXL, or Wan 1.3B with a 14B model): nothing happens, ComfyUI only logs warnings.
- The `low` file in the `high_noise` path.
- Strength 1.5 or more: the picture breaks.
- Forgetting the trigger words.

## What next
These lessons go on from this one: [Fast video in four steps](Video-Fast.md).

## See also
- [How lessons work](How-Lessons-Work.md)
- [LoRA](../concepts/LoRA.md)
- [Speed-up LoRAs](../concepts/Speed-Up-LoRAs.md)
- [Why families do not mix](../concepts/Why-Families-Do-Not-Mix.md)
- [The model card](../interface/Model-Card.md)
