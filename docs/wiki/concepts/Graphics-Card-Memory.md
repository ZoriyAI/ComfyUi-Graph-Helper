[Русский](Graphics-Card-Memory.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Graphics card memory

Why things do not fit, and what helps: lighter files, offloading, smaller jobs.

## In plain words
The graphics card has its own memory (**VRAM**), usually 8 to 24 GB at home. The model's weights must be there while it works, together with the latent and the intermediate results of each step. Your computer's ordinary memory (**RAM**) is larger but slower to reach. When the work does not fit in VRAM, ComfyUI stops with an "out of memory" error (in its log: `OutOfMemoryError` or "Allocation on device").

Rough sizes: an SDXL checkpoint is about 7 GB in fp16; Flux.1 dev about 24 GB in fp16 and 12 GB in fp8; each Wan 2.2 14B model about 14 GB in fp8; the T5-XXL text encoder about 10 GB in fp16 and 5 GB in fp8.

## What uses memory
1. **Model weights**: the biggest part. Several models in one graph are loaded in turn when they do not all fit.
2. **Size of the job**: width × height × frames × batch. Video at 720p and 81 frames needs far more than a picture.
3. **Decoding**: VAE Decode of a large picture or a long clip briefly needs a lot.

## What helps, in order
- **Make the job smaller**: lower size, `length`, `batch_size`. Generate small, [upscale](Upscaling.md) later.
- **Lighter files**: fp8 versions of models and text encoders (half of fp16, small quality loss); `weight_dtype` fp8 on Load Diffusion Model; **GGUF** quantized models (Q8, Q6, Q5, Q4: smaller, slower, lower quality as the number drops) through the ComfyUI-GGUF pack and its GGUF loader nodes.
- **Offloading**: ComfyUI moves models between VRAM and RAM by itself. Launch options change how hard it tries: `--lowvram` (split the model, keep parts in RAM), `--novram` (keep almost nothing in VRAM), `--reserve-vram` (leave room for other programs). WanVideoWrapper's **BlockSwap** keeps a number of the model's blocks in RAM. All of these are slower.
- **Tiled VAE**: VAE Decode (Tiled) for large pictures and long clips.
- **Smaller models**: Wan 2.2 5B instead of 14B; Z-Image Turbo or SDXL instead of Flux on small cards.
- **Free memory between runs**: ComfyUI's unload models / free cache commands; close other programs that use the card.

If even RAM runs out (the computer swaps or ComfyUI is killed), the model files are too large for the machine: use fp8 or GGUF files.

## Typical mistakes
- fp16 files on an 8 to 12 GB card when fp8 versions exist.
- A first test at full size and length.
- Two copies of the same large model loaded under different nodes.

## How the app helps
The app does not measure your card. Lessons name fp8 files and tell you to lower size or length when memory runs out; the WanVideoWrapper lesson explains BlockSwap and fp8 quantization.

## See also
- [Separate loaders](Separate-Loaders.md)
- [Resolution and aspect ratio](Resolution.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
- [Batch](Batch.md)
- [Running in ComfyUI](../graph/Running-In-ComfyUI.md)
