[Русский](Talking-Portraits.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Talking portraits

A face in a picture speaks the words of a voice recording, lips in time.

## The consent rule
Voice and animate only people who agree, with their own voice or a voice you have permission for. Never put words into the mouth of a real person without consent. The app does not help with someone else's face or voice without consent; every talking lesson starts with this rule. See [Content rules](../trust/Content-Rules.md).

## In plain words
A speech model (usually a **wav2vec** model) turns the sound into numbers that describe, moment by moment, what the mouth should do. A video model that was trained to listen (through a module or LoRA) draws the portrait speaking along. The sound file is then put into the clip as its track.

## The ways to do it
| Method | Notes |
|---|---|
| InfiniteTalk (WanVideoWrapper) | Wan 2.1 `i2v` 14B with the InfiniteTalk module; long speech by stitching windows; one or two speakers; 25 fps |
| MultiTalk (WanVideoWrapper) | The predecessor of InfiniteTalk; several speakers |
| FantasyTalking (WanVideoWrapper) | Simpler graph, short clips; 23 fps |
| Wan 2.2 S2V | Sound to video model with built-in nodes in recent ComfyUI |
| Ovi, LTX-2 | Generate the voice themselves together with the picture; no recording needed |

## Values and what they change
- A clean voice recording without music or noise works far better.
- `audio_scale` (about 1 to 1.2) for stronger lip movement; `audio_cfg_scale` about 2 for a livelier face, at more time.
- The frame rate of the clip must match what the method expects, or lips drift.
- A front-facing portrait, face large, mouth closed or slightly open.

## Typical mistakes
- Forgetting to connect the sound to Create Video: a silent clip.
- Two people swapped: in InfiniteTalk the first voice goes to the left half of the picture unless masks say otherwise.
- Long recordings while tuning: take five to ten seconds.

## How the app helps
Lessons [A talking video: InfiniteTalk](../lessons/Wrapper-Talk.md), [Two people talking](../lessons/Wrapper-Duo.md), [A talking portrait: FantasyTalking](../lessons/Wrapper-Fantasy.md) and [A video with sound: Ovi](../lessons/Wrapper-Ovi.md).

## See also
- [Audio](Audio.md)
- [Pose animation](Pose-Animation.md)
- [Video length and frame rate](Video-Length-And-Frame-Rate.md)
- [Content rules](../trust/Content-Rules.md)
