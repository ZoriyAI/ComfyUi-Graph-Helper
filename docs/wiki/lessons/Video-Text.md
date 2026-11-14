[Русский](Video-Text.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video from text

<!-- lesson: video-text -->
Lesson "video-text": a Wan 2.2 graph on built-in nodes that makes a five-second clip from a prompt.

## What you will be able to do
Build the two-pass Wan 2.2 14B graph: two models, one text encoder, one VAE, a noise shift for each model, two samplers that share the steps, and the nodes that turn frames into a clip.

## What you need
- Built-in nodes: Load Diffusion Model (×2), Load CLIP, Load VAE, CLIP Text Encode (×2), ModelSamplingSD3 (×2), EmptyHunyuanLatentVideo, KSampler (Advanced) (×2), VAE Decode, Create Video, Save Video. A recent ComfyUI has them all.
- Files: `wan2.2_t2v_high_noise_14B` and `wan2.2_t2v_low_noise_14B` (any precision, fp8 is lighter) in `models/diffusion_models`; `umt5_xxl` in `models/text_encoders`; `wan_2.1_vae` in `models/vae`. The app never downloads anything: ComfyUI's ready Wan 2.2 "text to video" template names the missing files and their folders.
- A graphics card with a lot of memory: the 14B models are large. See [Graphics card memory](../concepts/Graphics-Card-Memory.md).
- An empty canvas: **File ▸ New project**.

## The steps
1. **What a video is to a model** (reading): a stack of frames drawn at once; `high_noise` lays out, `low_noise` finishes.
2. **Load two models**: two Load Diffusion Model nodes with the `t2v` `high_noise` and `low_noise` files. Two halves of one model, never the same file twice.
3. **Load the text reader**: Load CLIP with `umt5_xxl`, `type` `wan`.
4. **Load the VAE**: `wan_2.1_vae` (the large Wan 2.2 models use the 2.1 VAE; `wan2.2_vae` is only for the 5B model).
5. **Write the description**: two text nodes on Load CLIP; describe the action and the camera.
6. **Set the noise shift**: a ModelSamplingSD3 after each model, `shift` 8 (accepted 5 to 8).
7. **Set the size and the length**: EmptyHunyuanLatentVideo, 832×480, `length` 81 (accepted 49 to 121; Wan wants 4n + 1).
8. **The first pass**: KSampler (Advanced) with the `high_noise` model, both texts, the empty latent.
9. **The second pass**: KSampler (Advanced) with the `low_noise` model, both texts, the first sampler's output.
10. **Set up the first sampler**: `add_noise` enable, `steps` 20, `cfg` 3.5, `start_at_step` 0, `end_at_step` 10, `return_with_leftover_noise` enable.
11. **Set up the second sampler**: `add_noise` disable, the same `steps` and `cfg`, `start_at_step` 10, `return_with_leftover_noise` disable.
12. **Turn the result into frames**: VAE Decode with the Wan VAE.
13. **Make the clip and save it**: Create Video with `fps` 16, then Save Video.
14. **The graph is ready** (reading): the first run is long; lower size or length if memory runs out.

## What the lesson checks
Two different files in the two loaders; a file and `type` `wan` in Load CLIP; a VAE file; at least 3 characters of prompt; `shift` 5 to 8 on both; `length` 49 to 121; every link; first sampler `add_noise` enable, `cfg` 1 to 4, `start_at_step` 0, `end_at_step` 1 to 15, leftover noise enable; second sampler `add_noise` disable, the same `steps`, `cfg` 1 to 4, `start_at_step` equal to the first's `end_at_step`, leftover noise disable; `fps` 16. A LoraLoaderModelOnly anywhere in a model's path is accepted.

The lesson does not yet check that the files are `t2v` rather than `i2v`, or that the text encoder and VAE belong to Wan. Check the names yourself.
<!-- verify: the check of file families in lessons (learning report, P0) -->

## Mistakes people make
- `i2v` files in a text to video graph, or the same file in both loaders.
- Forgetting `return_with_leftover_noise` on the first sampler: the second gets a clean clip and has nothing to finish.
- `start_at_step` of the second not equal to `end_at_step` of the first: steps lost or done twice.
- `fps` other than 16: the clip runs too fast or too slow.
- **Do this for me** may set a value at the edge of the accepted range rather than the number the text names (for example `shift` 5 instead of 8). Compare with the text.
<!-- verify: "Do this for me" uses the numbers of the text (learning report, P0) -->

## What next
[A description for video](Prompt-Video.md), [Video from a picture](Video-Image.md), [LoRA: add a style or a subject](LoRA.md), then [Fast video in four steps](Video-Fast.md).

## See also
- [Video models](../concepts/Video-Models.md)
- [Wan 2.2 two passes](../concepts/Wan-Two-Passes.md)
- [Video length and frame rate](../concepts/Video-Length-And-Frame-Rate.md)
- [Wan 2.2](../concepts/Family-Wan22.md)
- [Scheduler](../concepts/Scheduler.md)
