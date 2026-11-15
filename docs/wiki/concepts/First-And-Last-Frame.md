[Русский](First-And-Last-Frame.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# First and last frame

A clip that starts at one picture and ends at another, with the motion in between invented by the model.

## In plain words
In image to video the model knows only where the clip begins. With **first and last frame** (often written FLF2V) it gets both ends and fills the gap. This is used for transitions, for a camera move between two views, and for joining clips: the last frame of one clip becomes the first of the next.

## Where you meet it in a graph
- Built-in: **WanFirstLastFrameToVideo** takes `positive`, `negative`, `vae`, `start_image`, `end_image` (and optional CLIP Vision outputs), plus `width`, `height`, `length`, and gives conditioning and a latent to the samplers, just like WanImageToVideo. ComfyUI's Wan 2.2 FLF2V template uses the Wan 2.2 14B `i2v` models in the usual two-pass graph; there is also a dedicated Wan 2.1 FLF2V 14B model, and Wan 2.2 Fun InP models.
- WanVideoWrapper: the `end_image` input of WanVideo Image To Video Encode; it needs a model trained for it.
- Other families (LTX, HunyuanVideo 1.5) have their own keyframe nodes; follow their templates.

## Values and what they change
- Both pictures should have the clip's size and proportions, and show the same scene; the further apart they are, the stranger the in-between.
- The prompt describes the motion between them.
- A longer `length` gives a slower transition.

## Typical mistakes
- Two unrelated pictures: morphing instead of motion.
- An `end_image` on a model not trained for it: ignored or a broken end.
- Different proportions: one end cropped.

## How the app helps
The lesson [Two anchors: first and last frame](../lessons/First-And-Last-Frame.md) builds this graph on Wan 2.2. [The start picture is the anchor](../lessons/Anchor-Start.md) comes before it, and [A longer video in parts](../lessons/Anchor-Parts.md) joins clips on shared key frames. On WanVideoWrapper, [Video from a picture on WanVideoWrapper](../lessons/Wrapper-Image.md) mentions `end_image`.

## See also
- [Video generation](Video-Models.md)
- [Wan 2.2](Family-Wan22.md)
- [Video to video](Video-To-Video.md)
- [Lesson: Video from a picture](../lessons/Video-Image.md)
