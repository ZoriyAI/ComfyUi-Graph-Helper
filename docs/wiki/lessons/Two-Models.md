[Русский](Two-Models.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Two models in one graph

<!-- lesson: two-models -->
Lesson "two-models": a picture model draws the first frame and Wan brings it to life; each has its own LoRAs and its own prompt.

## What you will be able to do
Put a picture model next to a video graph, draw the start frame with it, and bridge the two through a picture. Keep each model's text encoder, VAE, LoRAs and prompt in its own path, and work on frame and motion separately.

## What you need
- The graph of [Video from a picture](Video-Image.md): Load CLIP, Load VAE, two texts into WanImageToVideo, a VAE Decode at the end.
- A checkpoint (SD 1.5, SDXL, Pony, Illustrious or similar) in `models/checkpoints`.

## The steps
1. **Why join models** (reading): each model has its own set; what passes between them is a picture.
2. **A video-from-a-picture graph is needed.**
3. **Add a picture model**: Load Checkpoint with a file.
4. **Give it texts of its own**: two text nodes on its `CLIP`; a frame prompt in its manner.
5. **Build the part that draws the frame**: Empty Latent Image and KSampler.
6. **The size of the frame** (reading): the clip's proportions at the picture model's size: 1344×768 for SDXL-type models, 832×480 for SD 1.5, for an 832×480 clip.
7. **Lead the picture to the video**: VAE Decode with the checkpoint's VAE, its `IMAGE` into `start_image` of WanImageToVideo. The old Load Image can go.
8. **Save the frame itself too**: Save Image or Preview Image on the same `IMAGE`.
9. **Two descriptions, each with its own job** (reading).
10. **LoRA: each in the path of its own model** (reading).
11. **Two models and memory** (reading): ComfyUI loads them in turn; fix the frame's seed; mute the video saver (Ctrl+M in ComfyUI) while choosing the frame.
12. **Other ways to combine models** (reading): refining, passing a latent within one family, two graphs.
13. **The graph is ready** (reading).

## What the lesson checks
The video part is present; a checkpoint is chosen; the frame prompt has at least 3 characters; the frame part is linked; the frame's VAE Decode uses the checkpoint's VAE and feeds `start_image`; a save or preview node shows the frame.

## Mistakes people make
- Decoding the frame with Wan's VAE.
- Using the video prompts for the frame.
- A picture LoRA in Wan's path: nothing happens, silently.
- `randomize` on the frame's seed: a new frame every run.

## What next
[Refining with a second model](Refine.md), or the adult lessons if they are switched on.

## See also
- [Why families do not mix](../concepts/Why-Families-Do-Not-Mix.md)
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
- [Bypass and mute](../concepts/Bypass-And-Mute.md)
- [Seed](../concepts/Seed.md)
