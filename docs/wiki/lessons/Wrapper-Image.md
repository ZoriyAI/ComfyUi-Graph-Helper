[Русский](Wrapper-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from a picture on WanVideoWrapper

<!-- lesson: wrapper-image -->
Lesson "wrapper-image": a clip made on WanVideoWrapper nodes starts from your picture.

## What you will be able to do
Replace the empty embeds of the pack's graph with a start picture, and get more or less motion out of it.

## What you need
- The graph of [Video on WanVideoWrapper](Wrapper.md).
- The Wan 2.2 `i2v` `high_noise` and `low_noise` models; a picture in ComfyUI's `input` folder.
- Nodes: Load Image and WanVideoImageToVideoEncode.

## The steps
1. **What changes** (reading): the model files, a picture node, a start node instead of the empty embeds.
2. **A WanVideoWrapper graph is needed**: two loaders, the VAE loader, two samplers chained.
3. **Models for a picture** (reading): `i2v` files in both loaders.
4. **Load the picture**: Load Image.
5. **Prepare the start**: WanVideoImageToVideoEncode with `vae` and `start_image`; 832×480, `num_frames` 81.
6. **Connect the start to the samplers**: `image_embeds` to both samplers; the empty embeds node can go.
7. **How to get more motion** (reading): `noise_aug_strength` (for example 0.02) and `start_latent_strength` (for example 0.8); the `end_image` input needs models trained for a last frame.
8. **The graph is ready** (reading).

## What the lesson checks
A picture chosen; the start node fed by the VAE and the picture, `num_frames` 49 to 121; its `image_embeds` in both samplers.

## Mistakes people make
- Leaving `t2v` files in the loaders (the lesson does not check the names).
- Leaving one sampler on the empty embeds.
- Raising both motion fields at once: the clip drifts away from the picture.

## What next
[VACE: motion from another video](Wrapper-VACE.md).

## See also
- [Lesson: Video from a picture](Video-Image.md)
- [First and last frame](../concepts/First-And-Last-Frame.md)
- [Video models](../concepts/Video-Models.md)
