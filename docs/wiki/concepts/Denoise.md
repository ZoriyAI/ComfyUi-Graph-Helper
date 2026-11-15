[Русский](Denoise.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Denoise

How much of the starting picture the sampler redraws.

## In plain words
`denoise` is a number from 0 to 1 on the sampler. It says how much noise is laid over the starting latent before sampling, and so how much of it the model redraws.
- **1.0**: start from pure noise. Whatever was in the latent is gone. This is text to image.
- **0.5**: half-way. The composition and colours of the start stay; texture, faces and detail are redrawn.
- **0.2**: only fine detail changes.

With `denoise` below 1, the sampler runs only the last part of the schedule: at 20 steps and 0.5 it does roughly the last 10.

## Where you meet it in a graph
- `denoise` on KSampler, BasicScheduler and other nodes. KSampler (Advanced) has no `denoise`; there the same effect comes from `start_at_step`.
- It matters when `latent_image` holds a real picture: from VAE Encode (image to image), from an earlier sampler (hires fix, refining), or with a mask (inpainting).

## Values people use
| Task | Typical denoise |
|---|---|
| Text to image | 1.0 |
| Refining with a second model | 0.3 to 0.5 |
| Second pass after upscaling (hires fix) | 0.4 to 0.6 for latent upscale, 0.2 to 0.4 after a model upscale |
| Image to image, keep the picture, change the style | 0.4 to 0.7 |
| Inpainting with an ordinary model | 0.6 to 1.0 |

## Typical mistakes
- **denoise below 1 on an empty latent**: there is nothing to keep, and the picture comes out muddy and unfinished.
- **denoise 1 in image to image**: the start picture is ignored.
- **Too low to change anything**, or too high to keep anything: compare two values side by side.

## How the app helps
The refining lesson checks `denoise` of the second sampler between 0.2 and 0.5. The KSampler description warns about denoise below 1 on an empty latent. In **Properties**, a field with a built-in note has a button **What this field does** next to its name; it opens the note under the field: what the field does and what to put in it.

## See also
- [Image to image](Image-To-Image.md)
- [Inpainting and masks](Inpainting.md)
- [Upscaling](Upscaling.md)
- [Lesson: Refining with a second model](../lessons/Refine.md)
