[Русский](Wrapper-Ovi.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A video with sound: Ovi

<!-- lesson: wrapper-ovi -->
Lesson "wrapper-ovi": one run draws the clip and its sound at once: speech, steps, street noise.

## Consent first
The model invents the voice itself. The rule stays: do not put words into the mouths of real people without their consent. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Build an Ovi graph: a video model with an audio model beside it, speech written into the prompt between `<S>` and `<E>`, a separate prompt for what the sound must not be, an empty sound latent, and two decoders.

## What you need
- The **ComfyUI-WanVideoWrapper** pack.
- Files: the Ovi video model and the Ovi audio model (two files), `umt5-xxl-enc`, the Wan 2.2 VAE (`Wan2_2_VAE`; the 2.1 VAE does not fit), `mmaudio_vae` and `mmaudio_vocoder`. The pack's Ovi example names them.

## The steps
1. **What Ovi does** (reading): always 121 frames, five seconds at 24 frames a second.
2. **Load the two models**: the audio model through WanVideo Extra Model Select into `extra_model`; `base_precision` `bf16` (fp16 may give a black screen).
3. **The text reader and the VAE**: the Wan 2.2 VAE.
4. **Describe the frame**: in English.
5. **Write the speech in**: the spoken words between `<S>` and `<E>`; other sounds optionally between `<AUDCAP>` and `<ENDAUDCAP>`.
6. **Connect the sound setting**: WanVideo Ovi CFG with the text in `original_text_embeds`; `ovi_audio_cfg` 3.
7. **Say what the sound must not be**: a second text node; its *positive* field holds the unwanted sound (robotic, muffled, echo); its output into `ovi_negative_text_embeds`.
8. **Set the size and the length**: empty embeds, `num_frames` 121, 992×512 for a landscape clip.
9. **Add the blank sound**: the empty MMAudio latent, `length` 157.
10. **Add the sampler**: `text_embeds` from the Ovi CFG node, not from the text node; `steps` 50, `cfg` 4.
11. **Turn the result into frames.**
12. **Turn the result into sound**: the MMAudio VAE loader (two different files) and the Ovi audio decoder, fed from the same sampler output.
13. **Assemble the clip with its sound**: `fps` 24.
14. **If the clip should start from a picture** (reading, not checked).
15. **If the sound or the speech did not come out** (reading). 16. **The graph is ready** (reading).

## What the lesson checks
Two different model files, `base_precision` `bf16`; the prompt contains `<S>` and `<E>`; `ovi_audio_cfg` 2 to 4; the sound-negative text is connected; `num_frames` exactly 121; sound `length` exactly 157; `steps` 30 to 50, `cfg` 3 to 5; vae and vocoder are different files; `fps` 24; the links listed.

## Mistakes people make
- Writing the unwanted sound into `negative_prompt` of the second node: the Ovi node reads its positive field.
- Too much speech for five seconds: one or two short phrases fit.
- `fp16` precision: a black screen.

## What next
[Another camera: ReCamMaster](Wrapper-ReCam.md).

## See also
- [Audio](../concepts/Audio.md)
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Video models](../concepts/Video-Models.md)
