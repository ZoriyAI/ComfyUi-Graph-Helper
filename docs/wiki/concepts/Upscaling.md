[Русский](Upscaling.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Upscaling

Making a picture larger: by a simple resize, by an upscale model, in latent space, or with a second pass.

## In plain words
Models draw best at their trained size (about 1 megapixel for most). To get a larger result you generate at that size and then enlarge. There are four ways, from fastest to best:

| Way | Nodes | What you get |
|---|---|---|
| Simple resize | Upscale Image, Upscale Image By (`ImageScale`, `ImageScaleBy`), method `lanczos` or `bicubic` | Bigger, but no new detail; soft |
| Upscale model | Load Upscale Model → Upscale Image (using Model) | Sharper; a neural network (ESRGAN-type, for example 4x-UltraSharp or RealESRGAN) adds plausible detail; fixed factor, often 4x |
| Latent upscale ("hires fix") | Upscale Latent or Upscale Latent By → a second KSampler with denoise 0.4 to 0.6 | The model redraws at the larger size; real new detail; must be resampled |
| Model upscale + second pass | Upscale Image (using Model) → scale down to the target → VAE Encode → KSampler with denoise 0.2 to 0.4 | The best detail with stable composition |

For very large pictures, **tiled** upscaling (for example the Ultimate SD Upscale pack) redraws the picture in tiles so it fits in memory. For video there are video upscale models and second passes in some families' templates (LTX-2 ships its own upscale models).

## Values and what they change
- A second pass at 1.5x to 2x the trained size is usually safe; beyond that, repeated objects appear unless you use tiles.
- Denoise of the second pass: lower keeps the picture, higher adds more (and changes more).
- Upscale models are files in `models/upscale_models`; their factor is fixed by the model, so follow them with Upscale Image By (0.5) to get 2x from a 4x model.

## Typical mistakes
- Decoding an upscaled latent without resampling: blurry or broken.
- A second pass with denoise 1: a new picture.
- Out of memory on large pictures: use tiled VAE decode or tiled upscaling.

## How the app helps
Built-in descriptions of the upscale, latent upscale and resize nodes, including the warning that an enlarged latent must be sampled again. The lessons [Upscaling with a model](../lessons/Upscale.md), [A second pass after upscaling (hires fix)](../lessons/Hires-Fix.md) and, for video, [A larger, sharper video: SeedVR2](../lessons/Video-Upscale.md).

## See also
- [Denoise](Denoise.md)
- [Resolution and aspect ratio](Resolution.md)
- [Image to image](Image-To-Image.md)
- [Graphics card memory](Graphics-Card-Memory.md)
- [Lesson: Refining with a second model](../lessons/Refine.md)
