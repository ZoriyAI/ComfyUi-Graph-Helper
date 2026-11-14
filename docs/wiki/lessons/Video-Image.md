[Русский](Video-Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from a picture

<!-- lesson: video-image -->
Lesson "video-image": a finished picture comes to life as the first frame of a Wan 2.2 clip.

## What you will be able to do
Turn the text to video graph into an image to video graph: choose the `i2v` models, load a picture, and let WanImageToVideo carry it into the blank and into both prompts.

## What you need
- The graph of [Video from text](Video-Text.md) helps: if it is on the canvas, most steps are already done and the lesson goes straight to the new ones.
- Files: `wan2.2_i2v_high_noise_14B` and `wan2.2_i2v_low_noise_14B` in `models/diffusion_models`, `umt5_xxl`, `wan_2.1_vae`. ComfyUI's Wan 2.2 "image to video" template names them.
- A picture in ComfyUI's `input` folder (upload it in ComfyUI's Load Image node, or copy it there).
- Built-in nodes as in Video from text, plus Load Image and WanImageToVideo.

## The steps
1. **What is different** (reading): the picture sets the look; the prompt says what happens.
2. **Choose the models for a picture**: the `i2v` high and low files; `t2v` models do not take a picture.
3. to 6. **The text reader, the VAE, Describe the motion, The noise shift**: as in Video from text; the VAE now works twice (reads the picture, makes the frames).
7. **Load the picture**: Load Image; the clip keeps it best with the picture's proportions.
8. **Prepare the start**: WanImageToVideo with both texts, the VAE and `start_image`; 832×480, `length` 81.
9. **The first pass**: the sampler now takes `positive`, `negative` and `latent` from WanImageToVideo's outputs, not from the text nodes. The old empty latent can be deleted.
10. **The second pass**: the same conditioning outputs, the first sampler's latent.
11. to 13. **Sampler settings, decode, save**: as in Video from text.
14. **The graph is ready** (reading): a clip that stands still needs more action and camera in the prompt; a face that drifts needs a shorter `length` or calmer motion.

## What the lesson checks
As in Video from text, plus: a picture chosen in Load Image; WanImageToVideo connected to both texts, the VAE and the picture, with `length` 49 to 121; both samplers fed from WanImageToVideo.

## Mistakes people make
- `t2v` files: the picture is ignored.
- Samplers still connected to the text nodes directly: the clip is drawn from nothing.
- A portrait picture into a landscape clip: cropped edges. Match proportions.
- Repeating the picture's description in the prompt: say what moves instead.

## What next
[Two models in one graph](Two-Models.md) makes the first frame with a picture model. [First and last frame](../concepts/First-And-Last-Frame.md) explains the end frame.

## See also
- [Video models](../concepts/Video-Models.md)
- [Conditioning](../concepts/Conditioning.md)
- [Wan 2.2](../concepts/Family-Wan22.md)
- [A description for video](Prompt-Video.md)
