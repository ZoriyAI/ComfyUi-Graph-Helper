[Русский](Wrapper-ReCam.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Another camera: ReCamMaster

<!-- lesson: wrapper-recam -->
Lesson "wrapper-recam": a finished video is drawn again as if the camera had moved another way.

## What you will be able to do
Encode a video into latents, choose one of the pack's camera paths (pan, tilt, zoom, rise, orbit), and redraw the scene along it while what happens stays the same.

## What you need
- The **ComfyUI-WanVideoWrapper** pack.
- Files: the ReCamMaster model (based on Wan 2.1 1.3B), `umt5-xxl-enc`, `wan_2.1_vae`. The pack's ReCamMaster example names them.
- A video of your own, or one you have the rights to, in `input`. It works best at 81 frames and 832×480, the size it was trained on.

## The steps
1. **What ReCamMaster does** (reading).
2. to 4. **Model, text reader and VAE, prompt**: describe what happens in the video; the camera needs no words.
5. **Load the video**: Load Video and Get Video Components.
6. **Turn the video into its compressed form**: WanVideo Encode; ImageFromBatch and ImageScale in between when the video is longer or of another size.
7. **Choose the camera move**: WanVideo ReCamMaster Default Camera, `camera_type` such as `pan_right`, `zoom_in`, `arc_left`.
8. **Join the camera and the video**: WanVideo ReCamMaster Camera Embed with `camera_poses` and the latents.
9. **Add the sampler**: `image_embeds` from the camera embed; `steps` 20.
10. and 11. **Decode and save**: `fps` 16.
12. **If the scene changed** (reading). 13. **The graph is ready** (reading): one run, one camera move.

## What the lesson checks
Files and the video chosen; the encode, camera, embed and sampler linked as above (a resize or batch-cut node in between is accepted); `steps` 20 to 30; `fps` 16.

## Mistakes people make
- A prompt that does not match the video: another scene appears.
- A video of another size: a blurry result.

## What next
[Two models in one graph](Two-Models.md).

## See also
- [Video to video](../concepts/Video-To-Video.md)
- [Video models](../concepts/Video-Models.md)
- [Content rules](../trust/Content-Rules.md)
