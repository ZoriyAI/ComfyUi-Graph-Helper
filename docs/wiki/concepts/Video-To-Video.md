[Русский](Video-To-Video.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Video to video

Making a new clip that takes its motion, layout or camera from an existing video.

## In plain words
A source video can guide a new clip in several ways:
- **Restyle by partial denoise**: encode the video into a latent and redraw it with denoise below 1, as image to image does for pictures. Motion stays, the look changes; too low a denoise changes little, too high loses the motion.
- **Control signals**: turn each frame into a depth map, a pose skeleton, edges or line art, and let the model follow them while the prompt sets the look. Wan uses **VACE** or Wan Fun Control models for this.
- **Pose transfer** onto a character from a picture: see [Pose animation](Pose-Animation.md).
- **Camera re-shoot**: ReCamMaster redraws the scene along another camera path.

## Where you meet it in a graph
- **Load Video** (file from `input`) → **Get Video Components** gives `images` (frames), `audio` and `fps`.
- Preprocessors from the **comfyui_controlnet_aux** pack (Depth Anything, DWPose, OpenPose, Canny, Lineart) between the frames and the control input.
- WanVideoWrapper: WanVideo VACE Encode (`input_frames`, `ref_images`, `strength`, start and end percent); built-in ComfyUI has WanVaceToVideo for the same idea.
- Resize and batch-cut nodes (ImageScale, ImageFromBatch) to match the clip's size and length.

## Values and what they change
- Control `strength` about 1; lower for more freedom.
- Ending the control early (`vace_end_percent` 0.5) keeps the layout but lets the model finish the detail.
- The new clip cannot be longer than the source frames you give.

## Typical mistakes
- Source frames of another size or length than the clip.
- Raw frames when you wanted only the motion: the colours and clothes come along. Use depth or pose.
- Using someone's video without the right to: see [Content rules](../trust/Content-Rules.md).

## How the app helps
Lessons [VACE: motion from another video](../lessons/Wrapper-VACE.md), [Another camera: ReCamMaster](../lessons/Wrapper-ReCam.md), [Video guided by another video: Wan 2.2 Fun Control](../lessons/Video-Control.md), and the tools of [Load, cut and save video: VideoHelperSuite](../lessons/VideoHelperSuite.md), [A larger, sharper video: SeedVR2](../lessons/Video-Upscale.md), [Remove an object from a video: ProPainter](../lessons/Video-Remove.md) and [Smoother motion: more frames between frames](../lessons/Video-Interpolate.md).

## See also
- [ControlNet and preprocessors](ControlNet.md)
- [Pose animation](Pose-Animation.md)
- [Video generation](Video-Models.md)
- [Denoise](Denoise.md)
