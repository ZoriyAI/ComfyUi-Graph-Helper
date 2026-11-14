[Русский](Batch.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Batch

Several pictures in one run, and how that differs from queuing several runs.

## In plain words
A **batch** is a stack of pictures processed together. Every `IMAGE` and `LATENT` in ComfyUI is a batch, usually of one. Set `batch_size` 4 on the empty latent and the sampler makes four pictures at once, each from different noise, from the same prompt and settings.

There are two ways to get several results:
- **Batch** (`batch_size` > 1): one run, all pictures computed together. Faster per picture on a strong card, but memory grows with the batch.
- **Queue several runs** (the Run button's count in ComfyUI, or press Run several times with `randomize` seed): one picture at a time, same memory as one.

## Where you meet it in a graph
- `batch_size` on Empty Latent Image, EmptySD3LatentImage and others.
- Save Image saves every picture of a batch, numbered.
- **Latent From Batch**, **Image From Batch**, **Repeat Latent Batch**, **Rebatch** pick out or repeat items.
- In video, the frames of a clip are one `IMAGE` batch after VAE Decode; "batch size" of video means several clips and is rarely used.

## Values and what they change
- `batch_size` 1 to 4 for pictures on a typical card. Video: 1.
- All pictures of a batch share one seed value; each still gets different noise. To repeat picture 3 of a batch alone, use Latent From Batch or note that its noise depends on the batch.

## Typical mistakes
- Out of memory with a large batch: lower it, or queue runs instead.
- Expecting different prompts in one batch: a batch shares one prompt (packs exist for prompt lists).

## How the app helps
The Empty Latent Image description explains `batch_size`. Short definitions of this and other words are in the [Glossary](../reference/Glossary.md).

## See also
- [Seed](Seed.md)
- [Latent](Latent.md)
- [Graphics card memory](Graphics-Card-Memory.md)
- [What ComfyUI is](What-Is-ComfyUI.md)
