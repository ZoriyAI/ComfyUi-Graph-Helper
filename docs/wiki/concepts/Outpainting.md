[Русский](Outpainting.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Outpainting

Extending a picture beyond its edges.

## In plain words
**Outpainting** is inpainting outward: you add empty canvas around the picture and let the model fill it so that it continues the scene. A square portrait becomes a wide landscape; a tight crop gets its surroundings back.

## Where you meet it in a graph
**Load Image** → **Pad Image for Outpainting** (`ImagePadForOutpaint`: `left`, `top`, `right`, `bottom` in pixels, and `feathering`) gives a larger `IMAGE` and a `MASK` covering the new area. Then any inpainting way from [Inpainting and masks](Inpainting.md): VAE Encode (for Inpainting), or InpaintModelConditioning with an inpainting model, or Flux.1 Fill dev, which handles outpainting especially well.

## Values and what they change
- Extend by a moderate amount at a time (a few hundred pixels); very wide extensions repeat or lose the style.
- `feathering` (about 40 to 100) blends the seam.
- Keep the result's total size near the family's trained size.
- The prompt describes the whole new picture, not only the added part.

## Typical mistakes
- A visible seam: too little feathering or a hard mask.
- Denoise below 1 with VAE Encode (for Inpainting): the new area stays grey.
- Huge padding on a plain model: repeated objects and a style that drifts.

## How the app helps
Not covered by a lesson or the built-in knowledge yet; build it from the ComfyUI outpainting template and use **Check** before saving.

## See also
- [Inpainting and masks](Inpainting.md)
- [Image to image](Image-To-Image.md)
- [Resolution and aspect ratio](Resolution.md)
