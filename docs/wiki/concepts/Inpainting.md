[Русский](Inpainting.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Inpainting and masks

Redrawing only part of a picture: the part under a mask.

## In plain words
A **mask** is a black and white map the size of the picture: white where the model may change things, black where it must not. **Inpainting** redraws only the white area and blends it into the rest: remove an object, change a face, fix hands, replace a sky.

## Where you get a mask
- **The mask editor** in ComfyUI: right-click a Load Image node and open the mask editor, paint over the area, save. Load Image then gives the painted area on its `MASK` output.
- **Transparency**: a PNG with transparent areas gives them as the mask.
- **Mask nodes** and packs that find objects or faces automatically (segmentation), or grow, blur and invert masks.

## Three ways to inpaint
| Way | Nodes | Denoise | When |
|---|---|---|---|
| Plain model, noise mask | VAE Encode → **Set Latent Noise Mask** → sampler | 0.5 to 1.0 | Small changes with any model |
| Inpainting model, cleared area | **VAE Encode (for Inpainting)** with `grow_mask_by` → sampler | 1.0 | Models trained for inpainting; replacing things entirely |
| Inpaint conditioning | **InpaintModelConditioning** (positive, negative, VAE, pixels, mask) → its three outputs to the sampler | up to 1.0 | Inpainting models and Flux Fill; the best blending |

Flux.1 Fill dev is a model made for inpainting and outpainting; Qwen-Image and Flux have inpainting ControlNets, and editing models can change a region from an instruction.

<!-- diagram: a photo with a painted white area over a lamp; arrow to the result where the lamp is replaced by a plant, the rest unchanged -->

## Values and what they change
- `grow_mask_by` (6 to 16 pixels) widens the mask so edges blend.
- A soft (blurred) mask edge avoids a visible seam.
- The prompt describes what should appear in the masked area, often with a little context.

## Typical mistakes
- VAE Encode (for Inpainting) with denoise below 1: a grey or flat patch.
- A mask that hugs the object too tightly: a halo or seam.
- Inpainting a tiny area of a huge picture: little detail. Crop the area, inpaint at the model's size and paste back (packs such as crop-and-stitch nodes do this).

## How the app helps
The app describes all three inpainting nodes; the description of VAE Encode (for Inpainting) warns that it needs denoise 1.0. The lessons [Inpainting: redraw part of a picture](../lessons/Inpainting.md) and [A mask by words](../lessons/Mask-By-Words.md) build it; the mask itself is painted in ComfyUI's mask editor.

## See also
- [Outpainting](Outpainting.md)
- [Image to image](Image-To-Image.md)
- [Denoise](Denoise.md)
- [Data types](Data-Types.md)
