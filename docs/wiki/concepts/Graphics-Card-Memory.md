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
Check graph shows known file sizes, processing stages, the largest recognized dimensions/batch and a snapshot of free RAM/VRAM reported by the connected ComfyUI. Refresh reads its statistics again. This is a free-memory snapshot and file-based estimate, not the execution peak of your graph. External Ollama model sizes can remain unknown.

## Measured example: two models in sequence
On 17 November 2026 an RTX 4060 executed: image → local vision model → description → CLIP → KSampler → VAE Decode. The vision model `huihui_ai/qwen3-vl-abliterated:4b-instruct` was released before generation (`keep_alive=0`). ComfyUI 0.45.3 used `XenoMORPH-v2.safetensors`, 512 × 512, batch 1, four Euler steps, CFG 5.

| Measurement | Result |
| --- | --- |
| Checkpoint file size | 2.14 GB (1.99 GiB) |
| Sampled VRAM peak of the entire sequence | 5537 MiB (about 5.4 GiB) |
| Background before/after process exit | 105 MiB |
| Peak allocated PyTorch tensors while sampling | 2036 MiB |
| Peak RAM of the ComfyUI process | 5067 MiB |

A real 512 × 512 image was produced. This checks execution, not artistic quality: four steps do not guarantee prompt fidelity. The overall peak includes a different vision model and background use; PyTorch accounts for only part of memory. VRAM sampling every 250 ms can miss shorter peaks. Ollama server RAM is excluded from the ComfyUI process RAM figure.

For your graph, start small with batch 1, run the entire sequence including Decode, then raise one setting at a time. If the assistant occupies memory, choose Release memory for ComfyUI and wait for confirmation. On failure, reduce dimensions/frames/batch, try tiled VAE or execute stages in sequence. This example does not guarantee another graph on another GPU. [Detailed report](https://github.com/ZoriyAI/nodewise-studio/blob/main/docs/research/2026-11-17-combined-models.md)

## See also
- [Separate loaders](Separate-Loaders.md)
- [Resolution and aspect ratio](Resolution.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
- [Batch](Batch.md)
- [Running in ComfyUI](../graph/Running-In-ComfyUI.md)
