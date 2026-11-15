[Русский](Video-Memory.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# When a video does not fit in memory

<!-- lesson: video-memory -->
Lesson "video-memory", in the group **Video** of the lesson list. Steps: 9.

## What you will be able to do
You change the graph of the small Wan model so that it needs less graphics memory, and you know what each change costs.

## What you need
- It goes on from [Video on a modest graphics card: Wan 2.2 5B](Video-Small.md). The card says so; it is a hint, not a lock.
- Nodes: Load Diffusion Model, Load VAE, Wan22ImageToVideoLatent, KSampler, Create Video, VAE Decode (Tiled).
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Why video runs out of memory** (reading)

   Practice on the graph of "Video on a modest graphics card". Three things are in graphics memory during a run: the weights of the model, the latent of the whole clip with what the model works out for it, and at the end the decoding of every frame at once. Each of them can be made smaller, and each change costs something: a little quality, or time.

   The usual message when it does not fit says "out of memory" (OOM) in ComfyUI's window.

2. **The graph of the small model is needed**

   The canvas must hold the graph of "Video on a modest graphics card": **Load Diffusion Model**, **Load VAE**, **Wan22ImageToVideoLatent**, **KSampler** and **Create Video**. If it is not there, do that lesson first.

3. **Where the memory goes** (reading)

   - The model: a file in `fp16` takes two bytes per parameter, so 5B is about 10 GB. In `fp8` it is half.
   - The text encoder: it works once at the start and ComfyUI moves it out afterwards, but it must fit while it works.
   - The clip: memory grows with width × height × number of frames. Half the frames is about half the memory of this part.
   - The decoding: the VAE turns all frames into pixels at once, a peak at the very end.

4. **Hold the model in fp8**

   In **Load Diffusion Model** set `weight_dtype` to `fp8_e4m3fn`.

   The model is kept in memory with one byte per parameter instead of two. The picture changes a little; on most clips the difference is hard to see. A file that is already `fp8` (its name says so) gains nothing from this.

5. **Lighter files** (reading)

   The same model comes in lighter files:
   - `fp8` or `fp8_scaled` files: half the size of `fp16`, the format of most official templates;
   - GGUF files (Q8, Q6, Q5, Q4): smaller still, the lower the number the smaller and the rougher. They are loaded by the ComfyUI-GGUF pack with its own loader, not by Load Diffusion Model;
   - the text encoder in `fp8` instead of the full one.

   Take files only from the model's official page or a well-known publisher. Old formats (`.ckpt`, `.pt`, `.pth`, `.bin`) can run code when loaded; `.safetensors` and `.gguf` cannot.

6. **Decode in tiles**

   Add a **VAE Decode (Tiled)** node. Connect the sampler's output to its `samples` input and the VAE to its `vae` input, and its output to the `images` input of **Create Video** in place of the old decoder. Set `tile_size` to 512 and `temporal_size` to 32.

   The frames are decoded in pieces, a square of 512 pixels and 32 frames at a time, so the peak at the end is much lower. Smaller pieces need less memory and take longer; seams between tiles are rare at these numbers. The old decoder can be deleted.

7. **A smaller clip**

   In **Wan22ImageToVideoLatent** set `width` to 960, `height` to 544 and `length` to 81.

   That is about three seconds at 24 fps, at a size below 720p. Both numbers stay multiples of 32 for this node, and the length stays of the form 4n + 1. This is the change that saves the most, and the clip shows it: less detail, a shorter scene.

8. **When it still does not fit** (reading)

   - ComfyUI moves parts of a model to system memory by itself when graphics memory is short. It is slower but works, as long as there is enough system memory. Close other programs that use the graphics card.
   - ComfyUI can be started with `--lowvram`, which moves even more out of graphics memory.
   - Block swapping: some packs keep part of the model's blocks in system memory and bring each one in when it is needed. WanVideoWrapper has a Block Swap node, SeedVR2 has a `blocks_to_swap` field. The more blocks, the less graphics memory and the slower.
   - A speed-up LoRA (4 to 8 steps) does not save memory but saves most of the time.

9. **Check one change at a time** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Change one thing, run, and look at the clip and at the time. Then the next. That way you know which change cost what, and you keep the ones your card needs.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The graph of the small model is needed**:
  - a **Load Diffusion Model** node.
  - a **Load VAE** node.
  - a **Wan22ImageToVideoLatent** node.
  - a **KSampler** node.
  - a **Create Video** node.
  - `LATENT` of **Wan22ImageToVideoLatent** into `latent_image` of **KSampler**.
- Step 4, **Hold the model in fp8**:
  - `weight_dtype` of **Load Diffusion Model** is `fp8_e4m3fn`.
- Step 6, **Decode in tiles**:
  - a **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode (Tiled)**.
  - `IMAGE` of **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `tile_size` of **VAE Decode (Tiled)** is from 256 to 512; **Do this for me** sets 512.
  - `temporal_size` of **VAE Decode (Tiled)** is from 16 to 64; **Do this for me** sets 32.
- Step 7, **A smaller clip**:
  - `width` of **Wan22ImageToVideoLatent** is from 480 to 960; **Do this for me** sets 960.
  - `height` of **Wan22ImageToVideoLatent** is from 320 to 544; **Do this for me** sets 544.
  - `length` of **Wan22ImageToVideoLatent** is from 25 to 81; **Do this for me** sets 81.

## See also
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
- [Video length and frame rate](../concepts/Video-Length-And-Frame-Rate.md)
- [How lessons work](How-Lessons-Work.md)
