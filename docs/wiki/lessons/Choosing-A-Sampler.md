[Русский](Choosing-A-Sampler.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Choosing a sampler and a scheduler

<!-- lesson: samplers -->
Lesson "samplers", in the group **Pictures: models** of the lesson list. Steps: 10.

## What you will be able to do
You put two samplers side by side that differ in one setting only, and learn to choose by comparing.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image / Preview Image, Preview Image / Save Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Two settings, one way to choose** (reading)

   The sampler (`sampler_name`) is the way each step removes noise. The scheduler (`scheduler`) decides how much noise is left before each step. Together they change the look of the picture, its detail and how many steps it needs.

   There is no best pair for every model. The way to choose is to compare: the same seed, the same steps and cfg, one setting changed. This lesson builds such a comparison on one canvas.

2. **A picture graph is needed**

   This lesson goes on from the graph of the lesson "A first picture from text". The canvas must have **Load Checkpoint**, two **CLIP Text Encode (Prompt)** nodes, **Empty Latent Image**, **KSampler**, **VAE Decode** and **Save Image** with their links.

   If they are not there, do that lesson first.

3. **Add a second sampler**

   Add a second **KSampler** node and connect to it the same as to the first:
   - to `model`, the output of **Load Checkpoint**;
   - to `positive` and `negative`, the same two text nodes;
   - to `latent_image`, the same **Empty Latent Image**.

   Both samplers start from one empty latent and one prompt.

4. **Make everything the same**

   In **KSampler** set `seed`, `steps`, `cfg` and `scheduler` the same as in the first sampler.

   The seed is the number the starting noise is made from. With the same seed both start from the same noise, so any difference in the result comes from the one setting you change.

5. **Change only the sampler**

   In **KSampler** choose another `sampler_name`. For example, `euler` in the first and `dpmpp_2m` in the second.

6. **Show the second result**

   Add a **VAE Decode** node and a **Preview Image** node. The output of **KSampler** goes into the `samples` input of **VAE Decode**, the `VAE` output of **Load Checkpoint** into its `vae` input, and its output into the `images` input of **Preview Image**.

   Now one run gives two pictures side by side.

7. **Fix the seed and run** (reading)

   Under `seed` each sampler has a choice of what happens after a run. Set it to `fixed` in both, or ComfyUI changes the seed after every run and the comparison breaks.

   Save the graph, run it in ComfyUI and look at the two pictures: sharpness, colour, small detail, how faithful to the prompt. Then try a third sampler in the second node, and so on.

8. **Then the scheduler** (reading)

   Now give both samplers the same `sampler_name` and change only `scheduler` in the second.
   - `normal` and `simple`: even steps;
   - `karras` and `exponential`: more steps at the end, on fine detail;
   - `sgm_uniform`: the one SD 3.5 is used with;
   - `beta`: more steps at the start and the end.

   With 20 steps or more the difference is often small; with few steps it is large.

9. **Where to start for each family** (reading)

   Pairs from ComfyUI's own templates, a good start:
   - SD 1.5 and SDXL: `dpmpp_2m` with `karras`, 20 to 30 steps; Pony and Illustrious: `euler_ancestral`;
   - Flux.1, Flux.2, Qwen-Image: `euler` with `simple`;
   - SD 3.5: `euler` with `sgm_uniform`;
   - Z-Image: `res_multistep` with `simple`;
   - turbo and distilled models: exactly what their template says, some of them take `lcm`.

   Samplers with "ancestral" or "sde" in the name add fresh noise at each step: the picture does not settle as steps grow, and is more varied.

10. **Done** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Keep the pair that looks best for your model and delete the second branch, or keep it for the next comparison. The same way compares two cfg values or two step counts: everything the same, one setting changed.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **Empty Latent Image** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (first sampler) (a Load LoRA or LoraLoaderModelOnly or ModelSamplingSD3 in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (first sampler).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (first sampler).
  - `LATENT` of **Empty Latent Image** into `latent_image` of **KSampler** (first sampler).
  - `LATENT` of **KSampler** (first sampler) into `samples` of **VAE Decode** (first result).
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode** (first result).
  - `IMAGE` of **VAE Decode** (first result) into `images` of **Save Image** or **Preview Image**.
- Step 3, **Add a second sampler**:
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (second sampler) (a Load LoRA or LoraLoaderModelOnly or ModelSamplingSD3 in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (second sampler).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (second sampler).
  - `LATENT` of **Empty Latent Image** into `latent_image` of **KSampler** (second sampler).
- Step 4, **Make everything the same**:
  - `seed` of **KSampler** (second sampler) equals `seed` of **KSampler** (first sampler).
  - `steps` of **KSampler** (second sampler) equals `steps` of **KSampler** (first sampler).
  - `cfg` of **KSampler** (second sampler) equals `cfg` of **KSampler** (first sampler).
  - `scheduler` of **KSampler** (second sampler) equals `scheduler` of **KSampler** (first sampler).
- Step 5, **Change only the sampler**:
  - `sampler_name` of **KSampler** (second sampler) is not the same file as `sampler_name` of **KSampler** (first sampler).
- Step 6, **Show the second result**:
  - a **VAE Decode** node.
  - a **Preview Image** or **Save Image** node.
  - `LATENT` of **KSampler** (second sampler) into `samples` of **VAE Decode** (second result).
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode** (second result).
  - `IMAGE` of **VAE Decode** (second result) into `images` of **Preview Image** or **Save Image**.

## See also
- [Sampler and sampler names](../concepts/Sampler.md)
- [Scheduler](../concepts/Scheduler.md)
- [Steps](../concepts/Steps.md)
- [How lessons work](How-Lessons-Work.md)
