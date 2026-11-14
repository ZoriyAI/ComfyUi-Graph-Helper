[Русский](Wrapper.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video on WanVideoWrapper

<!-- lesson: wrapper -->
Lesson "wrapper": the Wan 2.2 two-pass graph built on the nodes of the WanVideoWrapper pack, and how it differs from the built-in one.

## What you will be able to do
Build the same clip as in [Video from text](Video-Text.md) on the pack's own nodes; know that the pack's nodes and the built-in ones do not connect; save memory with block swap; add LoRAs the pack's way.

## What you need
- The node pack **ComfyUI-WanVideoWrapper** (by Kijai) installed in ComfyUI. You install it yourself, for example with ComfyUI Manager; then **Sync ▸ Sync now**. See [Node packs](../concepts/Node-Packs.md).
- The Wan 2.2 `t2v` `high_noise` and `low_noise` models, `umt5-xxl-enc` from the pack author's set (Kijai/WanVideo_comfy on Hugging Face), and `wan_2.1_vae`. The pack's `example_workflows` folder names the files.
- Nodes: WanVideoModelLoader (×2), LoadWanVideoT5TextEncoder, WanVideoVAELoader, WanVideoTextEncode, WanVideoEmptyEmbeds, WanVideoSampler (×2), WanVideoDecode, plus built-in Create Video and Save Video.

## The steps
1. **What WanVideoWrapper is** (reading): the same models, its own way; its `model` output does not fit a built-in sampler.
2. **Load two models**: `high_noise` and `low_noise`; `quantization` disabled; `load_device` offload_device if the model is larger than the card.
3. **Load the text reader**: `umt5-xxl-enc`; the ComfyUI template file may not fit.
4. **Load the VAE**: `wan_2.1_vae`.
5. **Write the description**: one WanVideoTextEncode holds `positive_prompt` and `negative_prompt`.
6. **Set the size and the length**: WanVideoEmptyEmbeds, 832×480, `num_frames` 81.
7. **The first pass**: WanVideoSampler with the `high_noise` model, `text_embeds`, `image_embeds`. The sampler's own `shift` field replaces ModelSamplingSD3.
8. **The second pass**: the `low_noise` model, the same embeds, `samples` from the first.
9. **Split the steps**: `steps` 20 in both, `end_step` 10 in the first, `start_step` 10 in the second.
10. **Strictness and the noise shift**: `cfg` 3.5, `shift` 8 in both (the pack's default cfg 6 is too strict for Wan 2.2).
11. **Turn the result into frames**: WanVideoDecode.
12. **Make the clip and save it**: built-in Create Video (`fps` 16) and Save Video.
13. **When the graphics card runs out of memory** (reading): WanVideo BlockSwap into `block_swap_args`, `blocks_to_swap` from 20 up; fp8 files and `quantization` fp8_e4m3fn.
14. **LoRA in this pack** (reading): WanVideo Lora Select into the loader's `lora` input; chain with `prev_lora`.
15. **The LoRA's words in the description.**
16. **Fast in four steps** (reading): lightx2v here too; 4 steps, split at 2, cfg 1.
17. **The graph is ready** (reading).

## What the lesson checks
Two different model files; text encoder and VAE files chosen; at least 3 characters of prompt; `num_frames` 49 to 121; the links; `steps` 4 to 40 and equal in both; `end_step` 1 to 20 and `start_step` equal to it; `cfg` 1 to 4 and `shift` 5 to 8 in both; `fps` 16; trigger words of any LoRA select node on the canvas in `positive_prompt`.

## Mistakes people make
- Connecting a pack loader to a built-in sampler: the link does not attach (`WANVIDEOMODEL` is not `MODEL`).
- `end_step` left at -1: the first sampler does everything.
- The ComfyUI `umt5_xxl` file in the pack's T5 loader: an error at run time.
- cfg 6 left from the default: a burnt clip.

## What next
[Video from a picture on WanVideoWrapper](Wrapper-Image.md), [VACE: motion from another video](Wrapper-VACE.md).

## See also
- [Node packs](../concepts/Node-Packs.md)
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
- [Wan 2.2 two passes](../concepts/Wan-Two-Passes.md)
- [Lesson: Video from text](Video-Text.md)
