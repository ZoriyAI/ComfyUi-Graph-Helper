[Русский](Pose-Animation.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Animation by pose

A character from a picture moves the way a person in a video moves.

## Consent
Animate only someone who agrees: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law. See [Content rules](../trust/Content-Rules.md).

## In plain words
A pose detector draws a stick-figure skeleton for every frame of a **driving video**. The video model then draws your **character** (from a reference picture) in those poses. Some methods carry the face and expression too; others only the body.

## The ways to do it
| Method | What it carries | Graph |
|---|---|---|
| Wan 2.2 Animate | Body pose and face; can also replace a person in the video | One model. Built-in nodes in recent ComfyUI (WanAnimateToVideo), or WanVideoWrapper with the ComfyUI-WanAnimatePreprocess pack |
| UniAnimate | Body pose only | Wan 2.1 `i2v` 14B plus the UniAnimate LoRA (WanVideoWrapper) |
| VACE with a pose map | Body pose, look from the prompt and a reference picture | Wan with VACE modules |
| ControlNet OpenPose (pictures) | One pose for one picture | Any picture family with a pose ControlNet |

## Values and what they change
- Pose strength: lower (about 0.8) when the character copies the pose too rigidly or breaks.
- Keep the proportions of the picture, the clip and the driving video alike.
- A driving video with one person, seen whole, at the model's frame rate.
- A reference picture standing in a pose close to the video's first pose.

## Typical mistakes
- Several people in the driving video: skeletons mix.
- The character takes the body shape of the person in the video: give the detector the reference pose too (UniAnimate's `reference_pose_image`).
- A video at another frame rate: motion too fast or slow.

## How the app helps
Lessons [Animation by pose: Wan Animate](../lessons/Wrapper-Animate.md) and [Animation by pose: UniAnimate](../lessons/Wrapper-UniAnimate.md), both with the consent rule as their first step.

## See also
- [Video to video](Video-To-Video.md)
- [ControlNet and preprocessors](ControlNet.md)
- [Talking portraits](Talking-Portraits.md)
- [Content rules](../trust/Content-Rules.md)
