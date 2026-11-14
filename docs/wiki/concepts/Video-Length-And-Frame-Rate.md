[Русский](Video-Length-And-Frame-Rate.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Video length and frame rate

Frames, length, fps: the numbers each video model expects.

## In plain words
- **Frames**: how many pictures the clip has. Set by `length` (built-in nodes) or `num_frames` (WanVideoWrapper).
- **Frame rate** (`fps`): how many frames play per second. Set on **Create Video**. It does not change what is drawn, only how fast it plays.
- **Duration** = frames ÷ fps. 81 frames at 16 fps is about 5 seconds.

Each model was trained at one frame rate and up to a certain length. The VAE packs several frames into one latent frame, so the frame count must fit a pattern: for Wan and HunyuanVideo **4n + 1** (49, 81, 121), for LTX **8n + 1** (97, 121).

## Numbers per model
| Model | fps | Usual length |
|---|---|---|
| Wan 2.1, Wan 2.2 14B | 16 | 81 frames (5 s); 49 to 121 |
| Wan 2.2 5B | 24 | 121 frames (5 s) |
| HunyuanVideo | 24 | up to about 129 frames |
| LTX-Video, LTX-2 | about 24 to 25 | 8n + 1 frames; see the template |
| InfiniteTalk (WanVideoWrapper) | 25 | follows the sound |
| FantasyTalking | 23 | 81 frames |
| Ovi | 24 | always 121 frames |

## What changes when you change it
- **More frames**: longer clip, more memory and time (roughly in proportion), and more risk that faces and figures drift towards the end. Beyond the trained length quality falls fast.
- **Another fps on Create Video**: the clip plays faster or slower than the model meant; motion looks sped up or slow.
- **Longer scenes** are made of several clips, by continuing from the last frame, or with pack nodes that work in windows (InfiniteTalk, Wan Animate's `frame_window_size`).
- **Smoother playback** comes from frame interpolation after generation (for example RIFE or FILM nodes from packs), not from a higher `fps` field.

## Typical mistakes
- `length` 80 instead of 81: ComfyUI rounds to the pattern, and the clip is shorter than expected.
- `fps` 24 on a Wan 14B clip: motion too fast.
- A driving video at another frame rate than the model: wrong speed of motion.

## How the app helps
The video lessons accept `length` and `num_frames` from 49 to 121 and check `fps` 16, 23, 24 or 25 as the model needs.

## See also
- [Video generation](Video-Models.md)
- [Resolution and aspect ratio](Resolution.md)
- [Graphics card memory](Graphics-Card-Memory.md)
- [Latent](Latent.md)
