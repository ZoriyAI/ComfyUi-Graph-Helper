[Русский](Wrapper-Talk.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A talking video: InfiniteTalk

<!-- lesson: wrapper-talk -->
Lesson "wrapper-talk": a portrait says the words of a sound file, the lips in time with them.

## Consent first
Only someone who agrees may be voiced, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Build a Wan 2.1 image to video graph with the InfiniteTalk module: a wav2vec model reads the sound, the clip is made in stitched pieces so it can run longer than five seconds, and the sound becomes the clip's track.

## What you need
- The **ComfyUI-WanVideoWrapper** pack.
- Files: a Wan 2.1 `i2v` 14B model (480p preferred), `umt5-xxl-enc`, `wan_2.1_vae`, `clip_vision_h`, the InfiniteTalk module (single for one speaker), and a wav2vec speech model (usually chinese-wav2vec2-base) in the `wav2vec2` folder. The pack's InfiniteTalk example names them.
- A portrait and a clean voice recording in `input`.

## The steps
1. **What InfiniteTalk does** (reading), with the consent rule.
2. to 6. **Model, text reader and VAE, a short prompt, the portrait, CLIP Vision.** The prompt says how the person speaks; the words come from the sound.
7. **Add the InfiniteTalk module**: MultiTalk Model Loader into the loader's `multitalk_model` input.
8. **Load the voice**: Load Audio, the wav2vec loader, and MultiTalk Wav2Vec Embeds with the sound in `audio_1`; `fps` 25.
9. **Prepare the start**: WanVideo Image To Video MultiTalk with the VAE, the portrait and the CLIP Vision embeds.
10. **Add the sampler**: with `multitalk_embeds`.
11. **Decode.**
12. **Make the clip**: `fps` 25, as for the sound.
13. **Put the sound into the clip**: the embeds node's `audio` output into Create Video's `audio`.
14. **When the lips miss the words** (reading): `audio_scale`, `audio_cfg_scale`; the length follows the sound.
15. **The graph is ready** (reading): work on five to ten seconds while tuning.

## What the lesson checks
All files, the portrait and the sound chosen; the module, the wav2vec chain and the start node linked as above; `fps` 25 on the embeds node and on Create Video; the sound connected to the clip.

## Mistakes people make
- Music or noise under the voice: poor lip sync.
- `fps` 16 (the Wan default) instead of 25: the lips drift.
- Forgetting the sound link: a silent clip with moving lips.

## What next
[Two people talking: InfiniteTalk](Wrapper-Duo.md).

## See also
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Audio](../concepts/Audio.md)
- [Content rules](../trust/Content-Rules.md)
