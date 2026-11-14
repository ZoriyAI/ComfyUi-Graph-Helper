[Русский](Latent.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Latent

The compressed picture the model works on.

## In plain words
Models do not draw in pixels. They work on a **latent**: a compressed form of the picture, much smaller than the picture itself. For SD 1.5, SDXL and Flux one latent cell stands for an 8 by 8 square of pixels, so a 1024 by 1024 picture is a 128 by 128 latent. Working small is what makes generation fast enough for a home graphics card.

A latent is not a small picture you could look at. It is numbers in several channels (4 for SD 1.5 and SDXL, 16 for SD3 and Flux.1, more for some newer models). Only a [VAE](VAE.md) can turn it into pixels.

For video, a latent is also compressed in time: Wan's VAE packs 4 frames into one latent frame (after the first), which is why Wan lengths are 4n + 1.

The lessons call an empty latent "the blank".

<!-- diagram: a 1024×1024 picture on the left, an arrow "VAE Encode" to a small 128×128 grid of numbers in 4 layers, an arrow "VAE Decode" back to the picture -->

## Where you meet it in a graph
- **Empty latent nodes** start text to image: Empty Latent Image (SD 1.5, SDXL), EmptySD3LatentImage (SD3, Flux.1 and others with 16 channels), EmptyHunyuanLatentVideo (Wan 14B, HunyuanVideo), Wan22ImageToVideoLatent (Wan 2.2 5B), and others per family. Their fields `width`, `height`, `batch_size` (and `length` for video) set the size.
- **VAE Encode** makes a latent from a picture (image to image).
- **Samplers** take a latent in `latent_image` and give a latent out.
- **VAE Decode** turns the final latent into pixels.
- **Latent tools**: Upscale Latent, Set Latent Noise Mask, latent batch nodes.

## Values and what they change
`width` and `height` are given in pixels even though the node makes a latent; they must divide by 8 (most families prefer 16 or 64). Size changes time and memory more than anything else: twice the width and height means four times the work. See [Resolution and aspect ratio](Resolution.md).

## Typical mistakes
- **Passing a latent between families**: an SDXL latent is meaningless to Flux. Go through a picture: decode with one VAE, encode with the other.
- **Decoding with the wrong VAE**: wrong colours, noise or an error.
- **Using a picture empty latent for video**: video samplers need a latent with a length.
- **The empty latent of another family**: current ComfyUI quietly adjusts the channel count of an all-empty latent to the model, so a plain Empty Latent Image often still works with Flux; but for size rules and video, use the empty latent node the family's official template uses.

## How the app helps
The node description of every empty latent says which family it is for. **Check** warns when models of different families meet in one path.

## See also
- [VAE](VAE.md)
- [Text to image](Text-To-Image.md)
- [Image to image](Image-To-Image.md)
- [Resolution and aspect ratio](Resolution.md)
- [Why families do not mix](Why-Families-Do-Not-Mix.md)
- [Glossary](../reference/Glossary.md)
