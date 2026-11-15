[Русский](Video-Models.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Video generation

How video generation differs from pictures, the kinds of video graphs, and where to read on.

## In plain words
To a video model a clip is a stack of frames drawn **all at once**, so that the motion holds together. The latent has a time dimension as well as width and height, and the VAE compresses frames in time too. Everything a picture graph has is still there: loaders, text encoder, sampler, VAE decode. What is new: a length, a frame rate, a node that turns frames into a clip, and much larger memory needs.

## The kinds of video graphs
| Kind | Starts from | Where to read |
|---|---|---|
| Text to video | A prompt and an empty video latent | [Lesson: Video from text](../lessons/Video-Text.md) |
| Image to video | A picture as the first frame | [Lesson: Video from a picture](../lessons/Video-Image.md) |
| First and last frame | Two pictures, the clip fills the gap | [First and last frame](First-And-Last-Frame.md) |
| Video to video | Another video's motion, depth, pose or camera | [Video to video](Video-To-Video.md) |
| Animation by pose | A character picture and a driving video | [Pose animation](Pose-Animation.md) |
| Talking portraits | A portrait and a voice recording | [Talking portraits](Talking-Portraits.md) |
| Video with sound | A prompt; sound is generated too (LTX-2, Ovi) | [Audio](Audio.md) |

## Where you meet it in a graph
- Empty video latents: EmptyHunyuanLatentVideo (Wan 14B, HunyuanVideo), Wan22ImageToVideoLatent (Wan 2.2 5B), EmptyLTXVLatentVideo (LTX).
- Start nodes that attach a picture: WanImageToVideo, WanFirstLastFrameToVideo and others.
- After VAE Decode the frames are an `IMAGE` batch. **Create Video** joins them with an `fps` (and optional `audio`) into a `VIDEO`; **Save Video** writes the file. **Load Video** and **Get Video Components** do the opposite.
- The families the app knows for video: [Wan 2.1](Family-Wan21.md), [Wan 2.2](Family-Wan22.md), [HunyuanVideo](Family-HunyuanVideo.md), [LTX-2](Family-LTX2.md).

## What changes compared with pictures
- **Length and frame rate** have rules per model: [Video length and frame rate](Video-Length-And-Frame-Rate.md).
- **Prompts** describe motion and camera: [lesson](../lessons/Prompt-Video.md).
- **Memory and time** grow with width × height × frames: start at 480p and 49 to 81 frames. See [Graphics card memory](Graphics-Card-Memory.md).
- **Speed-up LoRAs** matter more: [Speed-up LoRAs](Speed-Up-LoRAs.md).

## Typical mistakes
A picture empty latent in a video graph; `fps` that does not match the model; a clip too long for memory; `t2v` models for image to video.

## How the app helps
The lesson groups **Video**, **Video: the anchor picture**, **WanVideoWrapper** and **Packs and tools** build video graphs on Wan, LTX, HunyuanVideo and Kandinsky (see [Lessons](../lessons/README.md)), and node descriptions cover the core loaders and samplers.

## See also
- [Wan 2.2 two passes](Wan-Two-Passes.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
- [Model families](Model-Families.md)
- [Lessons](../lessons/README.md)
