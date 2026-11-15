[Русский](Video-Fast.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Fast video in four steps

<!-- lesson: video-fast -->
Lesson "video-fast", in the group **Video** of the lesson list. Steps: 8.

## What you will be able to do
You cut twenty steps down to four with a speed-up LoRA.

## What you need
- It goes on from [LoRA: add a style or a subject](LoRA.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - the high_noise half of Wan 2.2: `models/diffusion_models`, for example `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`;
  - the low_noise half of Wan 2.2: `models/diffusion_models`, for example `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`;
  - a speed-up LoRA for Wan (lightx2v or similar), its high file: `models/loras`, for example `wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors`;
  - a speed-up LoRA for Wan (lightx2v or similar), its low file: `models/loras`, for example `wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors`.
- Nodes: Load Diffusion Model, ModelSamplingSD3, LoraLoaderModelOnly, KSampler (Advanced).
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Where the speed comes from** (reading)

   A speed-up LoRA teaches the model to do in four steps what usually takes twenty. The best known one for Wan is called `lightx2v`.

   The price: less variety and slightly rougher motion. For trying things out and finding the right prompt it nearly always pays: the clip is ready several times sooner.

2. **A video graph is needed**

   This lesson goes on from the graph of "Video from text" or "Video from a picture". The canvas must have two **Load Diffusion Model** nodes and two **ModelSamplingSD3** nodes.

   If they are not there, do one of those lessons first.

3. **Put a LoRA into both models**

   Two **LoraLoaderModelOnly** nodes are needed, each between its **Load Diffusion Model** node and its **ModelSamplingSD3** node. How to put them in is shown in "LoRA: add a style or a subject".

4. **Choose the speed-up files**

   In the node in the path of the `high_noise` model choose the `lightx2v` file with `high` in its name in `lora_name`, and in the path of `low_noise` the file with `low`.

   The files for `t2v` and `i2v` models differ: take the ones that fit your models. Leave `strength_model` at 1.

5. **The two samplers**

   The two samplers of a video lesson are needed: the first takes the `high_noise` model, the second takes the `low_noise` model and the result of the first.

6. **Set four steps**

   Set `steps` to 4 in both samplers. Set `end_at_step` to 2 in the first and `start_at_step` to 2 in the second.

   Four steps are split in half: the first model does two, the second does two.

7. **Set cfg to 1**

   Set `cfg` to 1 in both samplers.

   A speed-up LoRA is trained to work without text guidance. With a larger value the clip burns out and fills with artifacts. At `cfg` 1 the text of the `negative` input stops acting.

8. **Now it is fast** (reading)

   The clip is made several times sooner.

   Once the prompt is right you can go back to twenty steps for quality: take the speed-up LoRAs out and set `steps` back to 20, `cfg` to 3.5 and the hand-over to step 10.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A video graph is needed**:
  - a **Load Diffusion Model** node.
  - a **Load Diffusion Model** node.
  - a **ModelSamplingSD3** node.
  - a **ModelSamplingSD3** node.
  - `unet_name` of **Load Diffusion Model** (first pass) holds the high_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `unet_name` of **Load Diffusion Model** (second pass) holds the low_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 3, **Put a LoRA into both models**:
  - a **LoraLoaderModelOnly** node.
  - a **LoraLoaderModelOnly** node.
  - `MODEL` of **Load Diffusion Model** (first pass) into `model` of **LoraLoaderModelOnly** (LoRA of the first pass) (a LoraLoaderModelOnly or ModelSamplingSD3 in between is accepted).
  - `MODEL` of **LoraLoaderModelOnly** (LoRA of the first pass) into `model` of **ModelSamplingSD3** (shift of the first pass) (a LoraLoaderModelOnly in between is accepted); or `MODEL` of **ModelSamplingSD3** (shift of the first pass) into `model` of **LoraLoaderModelOnly** (LoRA of the first pass) (a LoraLoaderModelOnly in between is accepted).
  - `MODEL` of **Load Diffusion Model** (second pass) into `model` of **LoraLoaderModelOnly** (LoRA of the second pass) (a LoraLoaderModelOnly or ModelSamplingSD3 in between is accepted).
  - `MODEL` of **LoraLoaderModelOnly** (LoRA of the second pass) into `model` of **ModelSamplingSD3** (shift of the second pass) (a LoraLoaderModelOnly in between is accepted); or `MODEL` of **ModelSamplingSD3** (shift of the second pass) into `model` of **LoraLoaderModelOnly** (LoRA of the second pass) (a LoraLoaderModelOnly in between is accepted).
- Step 4, **Choose the speed-up files**:
  - `lora_name` of **LoraLoaderModelOnly** (LoRA of the first pass) holds a speed-up LoRA for Wan (lightx2v or similar), its high file; such a file lies in `models/loras`, for example `wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors`.
  - `lora_name` of **LoraLoaderModelOnly** (LoRA of the second pass) holds a speed-up LoRA for Wan (lightx2v or similar), its low file; such a file lies in `models/loras`, for example `wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors`.
- Step 5, **The two samplers**:
  - a **KSampler (Advanced)** node.
  - a **KSampler (Advanced)** node.
  - `MODEL` of **ModelSamplingSD3** (shift of the first pass) into `model` of **KSampler (Advanced)** (first pass) (a LoraLoaderModelOnly in between is accepted).
  - `MODEL` of **ModelSamplingSD3** (shift of the second pass) into `model` of **KSampler (Advanced)** (second pass) (a LoraLoaderModelOnly in between is accepted).
  - `LATENT` of **KSampler (Advanced)** (first pass) into `latent_image` of **KSampler (Advanced)** (second pass).
- Step 6, **Set four steps**:
  - `steps` of **KSampler (Advanced)** (first pass) is `4`. Why: a speed-up LoRA is trained to do everything in four steps.
  - `steps` of **KSampler (Advanced)** (second pass) is `4`. Why: a speed-up LoRA is trained to do everything in four steps.
  - `end_at_step` of **KSampler (Advanced)** (first pass) is `2`. Why: four steps are split in half: the first model does two, the second does two.
  - `start_at_step` of **KSampler (Advanced)** (second pass) is `2`. Why: four steps are split in half: the first model does two, the second does two.
- Step 7, **Set cfg to 1**:
  - `cfg` of **KSampler (Advanced)** (first pass) is `1`. Why: a speed-up LoRA is trained without prompt guidance. With a higher cfg the clip burns out.
  - `cfg` of **KSampler (Advanced)** (second pass) is `1`. Why: a speed-up LoRA is trained without prompt guidance. With a higher cfg the clip burns out.

## Mistakes people make
- cfg left at 3.5: burnt, noisy clip.
- `t2v` speed-up files with `i2v` models, or the other way round.
- Leaving 20 steps: no speed gain, often over-cooked results.
- Counting on the negative prompt: at cfg 1 it does nothing.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Speed-up LoRAs](../concepts/Speed-Up-LoRAs.md)
- [CFG and guidance](../concepts/CFG.md)
- [Steps](../concepts/Steps.md)
- [Wan 2.2 two passes](../concepts/Wan-Two-Passes.md)
