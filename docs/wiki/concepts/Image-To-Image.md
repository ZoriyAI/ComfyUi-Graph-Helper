[Русский](Image-To-Image.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Image to image

Starting from a picture instead of pure noise, and redrawing it in part.

## In plain words
In **image to image** the sampler does not start from an empty latent. You load a picture, encode it into a latent, add some noise, and let the model remove that noise its own way. With [denoise](Denoise.md) you choose how much of the picture is redrawn: little noise keeps the composition and changes the surface; much noise keeps only the rough layout.

Uses: change the style of a photo or sketch, add detail to a rough drawing, refine a picture with another model, make variations of a picture you like.

## Where you meet it in a graph
**Load Image** (`IMAGE`) → **VAE Encode** (`pixels`, `vae`) → KSampler's `latent_image`, with `denoise` below 1. The rest is the text to image graph. Often an **Upscale Image** or ImageScale node sits before VAE Encode to bring the picture to the model's size.

<!-- diagram: Load Image → VAE Encode → KSampler (denoise 0.55) → VAE Decode → Save Image, with the checkpoint's VAE going into both VAE nodes -->

**Editing models** are a different way to change a picture with words: Qwen-Image-Edit, FLUX.1 Kontext and Flux.2 read the picture as a reference and follow an instruction ("make the coat red"), often with denoise 1. They have their own templates; see [Reference images](Reference-Images.md).

## Values and what they change
- denoise 0.3: same picture, new texture; 0.5: same layout, new details and style; 0.7 and above: a new picture loosely based on the old.
- The picture's size decides the latent's size: resize huge photos first.
- Write the prompt for the result you want, not for the source.

## Typical mistakes
- denoise left at 1: the source is ignored.
- A picture far larger than the family's size: slow, repeated objects.
- Encoding with one model's VAE and sampling with another family.

## How the app helps
The lesson [Refining with a second model](../lessons/Refine.md) builds image to image as its second half; the VAE Encode description explains the start.

## See also
- [Denoise](Denoise.md)
- [Inpainting and masks](Inpainting.md)
- [Text to image](Text-To-Image.md)
- [Upscaling](Upscaling.md)
- [Reference images](Reference-Images.md)
