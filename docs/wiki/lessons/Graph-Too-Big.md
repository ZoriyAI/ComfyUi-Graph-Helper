[Русский](Graph-Too-Big.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# When the graph does not fit the graphics card

<!-- lesson: vram -->
Lesson "vram", in the group **ComfyUI basics** of the lesson list. Steps: 10.

## What you will be able to do
You learn why a graph runs out of memory and what to change, and set the picture graph up to need less of it.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, Empty Latent Image, KSampler, Save Image / Preview Image, VAE Decode (Tiled).
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What takes the memory** (reading)

   The graphics card has its own memory, VRAM. A run needs room for two things.

   - The models: a file needs about as much memory as it weighs. An SDXL checkpoint of 7 GB needs about 7 GB.
   - The work itself: it grows with the size of the picture, with the number of pictures at once, and for video with the frames.

   ComfyUI loads a model when it is needed and moves the others to ordinary memory (RAM). When even one step does not fit, the run stops with an error.

2. **The error you will see** (reading)

   ComfyUI shows a red message on the node where memory ran out. Its text says "out of memory" or "Allocation on device", and ComfyUI adds: "This error means you ran out of memory on your GPU. TIPS: If the workflow worked before you might have accidentally set the batch_size to a large number."

   The node it names tells where to look. In the sampler: the model or the size is too large. In VAE Decode at the very end: the decoding of a large picture or clip.

3. **The picture graph is needed**

   The canvas must have the graph of "A first picture from text": **Load Checkpoint**, **Empty Latent Image**, **KSampler** and **Save Image**.

   If it is not there, do that lesson first.

4. **One picture at a time**

   Set `batch_size` of **Empty Latent Image** to 1.

   Every picture of a batch needs its own working memory. Several variants are better made one after another, with another `seed` each time.

5. **The size** (reading)

   Memory grows with the number of pixels: 2048 by 2048 has 4 times the pixels of 1024 by 1024. For video multiply by the frames.

   Make the picture at the size the model was trained at and enlarge it afterwards with an upscaler or a second pass. That is faster and looks better than drawing it large at once.

6. **Decode in tiles**

   Add a **VAE Decode (Tiled)** node. Connect the output of **KSampler** to its `samples` input and the `VAE` output of **Load Checkpoint** to its `vae` input. Leave `tile_size` at 512.

   It does what VAE Decode does, piece by piece, so it needs far less memory. When a run fails at the very end, after the sampler, this is the cure. If 512 still does not fit, try 256.

7. **Save from the tiled decode**

   Connect the `IMAGE` output of **VAE Decode (Tiled)** to the `images` input of **Save Image**. The link from the old VAE Decode is replaced.

   The old VAE Decode now leads nowhere, so ComfyUI does not run it. You can delete it.

8. **Lighter files** (reading)

   The same model comes in files of different precision. Fewer bits per number, a smaller file and less memory.

   - fp16 and bf16: the usual full files.
   - fp8: half of that, with a small loss; the common choice for cards of 12 to 16 GB. Load Diffusion Model can also load a 16-bit file as fp8 with its weight_dtype field.
   - GGUF (Q8, Q6, Q5, Q4): quantised files of the pack ComfyUI-GGUF and its Unet Loader (GGUF). Q8 is close to fp16 at half the size; Q4 takes about a quarter with a visible loss.

   The text encoder comes in fp8 and GGUF too, and can run on the processor.

9. **Ordinary memory helps** (reading)

   - ComfyUI moves models that are not in use to RAM by itself, and recent versions stream large models in pieces.
   - Start flags change that: --reserve-vram 2 leaves 2 GB for the system, --lowvram and --novram keep more in RAM.
   - Block swap (WanVideo Block Swap of WanVideoWrapper) keeps some blocks of a video model in RAM.
   - ComfyUI-MultiGPU puts parts of a model on a second card or in RAM.

   All of this is slower than having everything on the card, and needs enough RAM.

10. **What to change, in order** (reading)

   1. `batch_size` to 1 and the size down to the model's own.
   2. The tiled decode, if the run fails at the end.
   3. An fp8 or GGUF file of the same model.
   4. The text encoder in fp8 or on the processor.
   5. For video: fewer frames, a smaller frame, block swap.
   6. ComfyUI's start flags.
   7. A smaller model of the family, or a cloud graphics card.

   The app's knowledge explains every ComfyUI message about memory. Save the graph with "File ▸ Save workflow for ComfyUI…" and run it in ComfyUI.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 3, **The picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **Empty Latent Image** node.
  - a **KSampler** node.
  - a **Save Image** or **Preview Image** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `LATENT` of **Empty Latent Image** into `latent_image` of **KSampler**.
- Step 4, **One picture at a time**:
  - `batch_size` of **Empty Latent Image** is `1`.
- Step 6, **Decode in tiles**:
  - a **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode (Tiled)**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode (Tiled)**.
  - `tile_size` of **VAE Decode (Tiled)** is from 256 to 512; **Do this for me** sets 512.
- Step 7, **Save from the tiled decode**:
  - `IMAGE` of **VAE Decode (Tiled)** into `images` of **Save Image** or **Preview Image**.

## See also
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
- [Batch](../concepts/Batch.md)
- [Resolution and aspect ratio](../concepts/Resolution.md)
- [How lessons work](How-Lessons-Work.md)
