[Русский](Wrapper-Duo.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Two people talking: InfiniteTalk

<!-- lesson: wrapper-duo -->
Lesson "wrapper-duo": two people in one picture speak, each with their own voice.

## Consent first
Only those who agree may be voiced, with their own voices or voices you have permission for. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Extend the InfiniteTalk graph with a second voice, choose how the two recordings play (together or in turn), and know which voice goes to which person.

## What you need
- The graph of [A talking video: InfiniteTalk](Wrapper-Talk.md).
- An InfiniteTalk module for several speakers (its name has "multi"; MultiTalk has one module for every case).
- A picture with two people side by side, both seen large, and two voice recordings.

## The steps
1. **Two voices in one frame** (reading), with the consent rule.
2. **The graph of a talking video is needed.**
3. **Check the module** (reading): a multi-speaker module in MultiTalk Model Loader.
4. **Choose the picture** (reading): one person in the left half, the other in the right.
5. **Add the second voice**: a second Load Audio, a different file, into `audio_2`.
6. **Together or in turn** (reading): `multi_audio_type` `para` (both from the start, each recording with pauses) or `add` (first, then second).
7. **Who speaks with which voice** (reading): `audio_1` goes to the left person, `audio_2` to the right; otherwise masks in `ref_target_masks`, drawn in ComfyUI's mask editor; `audio_3` and `audio_4` need masks.
8. **The graph is ready** (reading).

## What the lesson checks
The InfiniteTalk graph is there; a second Load Audio with another file feeds `audio_2`.

## Mistakes people make
- The single module: only one face moves.
- Swapped voices: swap the recordings, or use masks.
- Long recordings while tuning: take lines a few seconds long.

## What next
[A talking portrait: FantasyTalking](Wrapper-Fantasy.md) or [A video with sound: Ovi](Wrapper-Ovi.md).

## See also
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Inpainting and masks](../concepts/Inpainting.md)
- [Content rules](../trust/Content-Rules.md)
