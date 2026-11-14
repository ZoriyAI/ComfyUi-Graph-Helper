[Русский](Wrapper-Fantasy.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A talking portrait: FantasyTalking

<!-- lesson: wrapper-fantasy -->
Lesson "wrapper-fantasy": a portrait says a short voice recording; a simpler graph than InfiniteTalk's, a shorter clip.

## Consent first
Only someone who agrees may be voiced, with their own voice or a voice you have permission for. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Build a plain Wan 2.1 image to video graph with the FantasyTalking module and its own wav2vec reader, and match the frame counts of the picture start and the sound.

## What you need
- The **ComfyUI-WanVideoWrapper** pack.
- Files: a Wan 2.1 `i2v` 14B model (720p preferred), `umt5-xxl-enc`, `wan_2.1_vae`, `clip_vision_h`, the FantasyTalking module. The speech model `facebook/wav2vec2-base-960h` is downloaded by the pack's node itself on the first run in ComfyUI; this app downloads nothing.
- A portrait and a short voice recording in `input`.

## The steps
1. **What FantasyTalking does** (reading), with the consent rule.
2. to 6. **Model, text reader and VAE, a short prompt, the portrait, CLIP Vision.**
7. **Add the FantasyTalking module**: into the loader's `fantasytalking_model` input.
8. **Prepare the start**: WanVideoImageToVideoEncode with VAE, portrait and CLIP Vision embeds; `num_frames` 81 (three and a half seconds at 23 frames a second).
9. **Load the voice**: Load Audio, the wav2vec downloader set to `facebook/wav2vec2-base-960h`, FantasyTalking Wav2Vec Embeds with three links; `fps` 23, `num_frames` equal to the start node's.
10. **Add the sampler**: with `fantasytalking_embeds`.
11. **Decode.** 12. **Assemble the clip**: `fps` 23.
13. **Put the sound into the clip**: Load Audio's output into Create Video's `audio`.
14. **If the lips miss the words** (reading). 15. **The graph is ready** (reading).

## What the lesson checks
Files, portrait and sound chosen; `num_frames` 49 to 121 on the start node and the same number on the sound node; the wav2vec model name exactly as above; `fps` 23 on the sound node and on Create Video; the links listed.

## Mistakes people make
- Different `num_frames` in the start and the sound nodes.
- A recording longer than the clip: only its beginning is used.
- For long speech, use InfiniteTalk instead.

## What next
[A video with sound: Ovi](Wrapper-Ovi.md).

## See also
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Lesson: A talking video: InfiniteTalk](Wrapper-Talk.md)
- [Content rules](../trust/Content-Rules.md)
