[Русский](Sampler-Settings.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The sampler's settings

<!-- lesson: sampler-fields -->
Lesson "sampler-fields", in the group **Pictures: first steps** of the lesson list. Steps: 10.

## What you will be able to do
You set the fields of the sampler the way ComfyUI's own SDXL template sets them, and learn what each one does.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, Empty Latent Image, KSampler, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Fields everybody meets** (reading)

   The sampler is where the picture is made, and its fields are the ones you will change most. This lesson goes through them on the graph of "A first picture from text".

   The values are those of ComfyUI's own SDXL template. For SD 1.5 they work too. Newer families (Flux, Z-Image, Qwen-Image, Wan) want other numbers: their templates say which.

2. **The picture graph is needed**

   The canvas must have the graph of "A first picture from text": **Load Checkpoint**, **Empty Latent Image**, **KSampler** and **Save Image**.

   If it is not there, do that lesson first.

3. **The seed** (reading)

   The `seed` field is the number the starting noise is made from. The same `seed`, the same settings and the same prompt give the same picture.

   Under it in ComfyUI there is `control_after_generate`: what happens to the number after each run. `randomize` takes a new random number, `increment` adds one, `fixed` keeps it.

   Take `randomize` while you look for ideas. Take `fixed` while you tune one picture: then you see what each change did.

4. **Steps**

   Set `steps` to 25.

   The sampler removes the noise in this many steps. More steps, a cleaner picture and a longer wait, but after about 30 the picture hardly changes. Distilled and turbo models need only 4 to 8 steps: their pages say so.

5. **CFG**

   Set `cfg` to 7.

   It says how strictly the model follows the prompt. Higher follows more closely but burns the colours and hardens the picture; lower is softer and freer. For SD 1.5 and SDXL keep 5 to 8.

   Distilled models and speed-up LoRAs want `cfg` 1, which also halves the time.

6. **Sampler and scheduler** (reading)

   Two fields choose how the noise is removed.

   - `sampler_name`, the method. `euler` is simple and reliable. `dpmpp_2m` gives more detail in the same steps. Names with `ancestral` or `sde` add fresh noise at every step: livelier, but the picture never settles and changes with the number of steps.
   - `scheduler`, how the noise is spread over the steps. `karras` spends more steps on fine detail and suits the dpmpp methods; `normal` and `simple` spread them evenly and suit most new families.

   For a start take a pair from a template and change one thing at a time.

7. **Choose the pair**

   Set `sampler_name` to `dpmpp_2m` and `scheduler` to `karras`.

   This is the pair of ComfyUI's SDXL template and of many guides for SD 1.5 and SDXL.

8. **Denoise**

   Leave `denoise` at 1.

   It says how much of the starting latent is replaced with noise. With an empty blank everything is drawn anew, so 1. Below 1 is for redrawing a picture that comes in: image to image, a second pass.

9. **Size and batch** (reading)

   The size is set in **Empty Latent Image**: `width` and `height`. Make the picture near the size the model was trained at: 512 by 512 for SD 1.5, about 1024 by 1024 for SDXL. Far from it the model repeats things or breaks the composition.

   Other shapes with the same number of pixels work: 832 by 1216 for a portrait, 1216 by 832 for a landscape.

   `batch_size` makes several pictures in one run. It needs that many times the memory; 1 is the safe start.

10. **Try it** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   In ComfyUI set `control_after_generate` to `fixed`, run once, then change only `steps` or only `cfg` and run again. Seeing one change at a time is the fastest way to learn what each field does.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **Empty Latent Image** node.
  - a **KSampler** node.
  - a **Save Image** or **Preview Image** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `LATENT` of **Empty Latent Image** into `latent_image` of **KSampler**.
- Step 4, **Steps**:
  - `steps` of **KSampler** is `25`.
- Step 5, **CFG**:
  - `cfg` of **KSampler** is `7`.
- Step 7, **Choose the pair**:
  - `sampler_name` of **KSampler** is `dpmpp_2m`.
  - `scheduler` of **KSampler** is `karras`.
- Step 8, **Denoise**:
  - `denoise` of **KSampler** is `1`.

## See also
- [Sampler and sampler names](../concepts/Sampler.md)
- [Scheduler](../concepts/Scheduler.md)
- [Steps](../concepts/Steps.md)
- [CFG and guidance](../concepts/CFG.md)
- [Seed](../concepts/Seed.md)
- [Denoise](../concepts/Denoise.md)
- [How lessons work](How-Lessons-Work.md)
