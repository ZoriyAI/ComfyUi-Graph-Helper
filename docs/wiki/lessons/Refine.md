[Русский](Refine.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Refining with a second model

<!-- lesson: refine -->
Lesson "refine": a second model redraws a finished picture; the composition comes from the first, the texture and style from the second.

## What you will be able to do
Chain two models: decode the first picture, encode it for the second model, and redraw it with partial denoise. You learn image to image along the way, and why going through a picture works between any two families.

## What you need
- The graph of [A first picture from text](Image.md) on the canvas (or the picture part of [Two models in one graph](Two-Models.md)).
- Two different checkpoints in `models/checkpoints`. They may be of different families.
- Built-in nodes only: Load Checkpoint, CLIP Text Encode, VAE Encode, KSampler, VAE Decode, Save Image or Preview Image.

## The steps
1. **What refining is** (reading): the second model starts from the finished picture with some noise added.
2. **A picture graph is needed**: checkpoint, texts, sampler, decode, save, linked.
3. **Add the second model**: another Load Checkpoint with a different file.
4. **Give the second model texts of its own**: two new text nodes on its `CLIP`; the first model's texts were read by another encoder.
5. **Translate the picture for the second model**: VAE Encode, `IMAGE` from the first VAE Decode, `vae` from the second model.
6. **Add the second sampler**: its own model, its own texts, `latent_image` from VAE Encode.
7. **Set the strength of refining**: `denoise` 0.5 (the lesson accepts 0.2 to 0.5).
8. **Save the result**: a second VAE Decode with the second model's VAE, and a second Save Image, so you can compare before and after.
9. **When the models are of one family** (reading): pass the `LATENT` straight on and skip decode and encode.
10. **LoRA in a graph with two models** (reading): each LoRA in its own model's path; its trigger words in that model's prompt.
11. **The graph is ready** (reading): try `denoise` 0.3 and 0.5; swap the models.

## What the lesson checks
The first graph is complete; the second checkpoint holds another file than the first; the second positive text has at least 3 characters; the links listed above exist; `denoise` of the second sampler is between 0.2 and 0.5.

## Mistakes people make
- Encoding with the first model's VAE: the second model gets a latent it cannot read.
- Reusing the first model's text nodes for the second sampler.
- `denoise` 1: the first picture is lost completely.
- Passing a `LATENT` between different families: noise or an error.

## What next
[Two models in one graph](Two-Models.md) uses a picture model to start a video. [Upscaling](../concepts/Upscaling.md) uses the same second pass at a larger size.

## See also
- [Image to image](../concepts/Image-To-Image.md)
- [Denoise](../concepts/Denoise.md)
- [Why families do not mix](../concepts/Why-Families-Do-Not-Mix.md)
- [LoRA](../concepts/LoRA.md)
