[Русский](Resolution.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Resolution and aspect ratio

Picture and video sizes each family was trained at, and what goes wrong far from them.

## In plain words
Every model was trained at certain sizes. Near them it composes well. Far above them it starts to repeat things: two heads, doubled bodies, a second horizon. Far below them it loses detail. The **aspect ratio** (width to height) can change freely within the trained area: keep the total number of pixels about the same and swap width and height for an upright picture.

## Where you meet it in a graph
`width` and `height` on the empty latent node (Empty Latent Image, EmptySD3LatentImage, EmptyHunyuanLatentVideo and others), and on video start nodes (WanImageToVideo, WanVideo Image To Video Encode). In image to image the size comes from the loaded picture.

## Sizes per family
| Family | Trained around | Good sizes (W×H) |
|---|---|---|
| SD 1.5 | 512 px | 512×512, 512×768, 768×512 |
| SDXL, Pony, Illustrious | 1 megapixel | 1024×1024, 832×1216, 896×1152, 1216×832, 1344×768, 768×1344 |
| SD 3.5, Flux.1, Chroma, Krea | about 1 megapixel, flexible | 1024×1024, 832×1216, 1216×832; Flux handles up to about 2 megapixels |
| Qwen-Image | about 1.6 megapixels | 1328×1328, 1664×928, 928×1664 |
| Z-Image | about 1 megapixel | 1024×1024 and the same ratios as SDXL |
| Wan 2.1 / 2.2 14B | 480p or 720p | 832×480, 480×832, 1280×720 |
| Wan 2.2 5B | 720p | 1280×704, 704×1280 |

Sides must divide by 8; most families prefer multiples of 16 (Wan, Flux) or 64 (SDXL). Check the model's page: fine-tuned models sometimes prefer other sizes.

## What size changes
Doubling width and height means four times the pixels, about four times the time and much more memory. For video, length multiplies it again. To get a large result, generate at the trained size and [upscale](Upscaling.md).

## Typical mistakes
- **SD 1.5 at 1024**: doubled figures. **SDXL at 512**: mushy, low-detail pictures.
- **A start picture of other proportions** in video from a picture: the start node crops or stretches it.
- **Out of memory**: lower the size first.

## How the app helps
The two-models lesson gives exact frame sizes for SDXL and SD 1.5 next to an 832×480 clip. The family of a model is on its card in the **Models** tab.

## See also
- [Model families](Model-Families.md)
- [Latent](Latent.md)
- [Upscaling](Upscaling.md)
- [Graphics card memory](Graphics-Card-Memory.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
