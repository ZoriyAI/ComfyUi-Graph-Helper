[Русский](ControlNet.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# ControlNet and preprocessors

Guiding a picture with the edges, depth or pose of another picture.

## In plain words
A prompt says *what* to draw; it is poor at saying *exactly where*. A **ControlNet** is an extra model that reads a **control picture** (a map of edges, depth, a pose skeleton, line art) and makes the result follow its shapes. The control picture is made from an ordinary picture by a **preprocessor**.

<!-- diagram: a photo of a dancer → preprocessor "DWPose" → a stick-figure skeleton → Apply ControlNet → a picture of a robot in the same pose -->

## Where you meet it in a graph
- **Load ControlNet Model** (`ControlNetLoader`, from `models/controlnet`) gives `CONTROL_NET`.
- **Apply ControlNet** (`ControlNetApplyAdvanced`) takes `positive`, `negative`, `control_net`, `image` (the control picture), optional `vae`, and `strength`, `start_percent`, `end_percent`; it gives back positive and negative to the sampler.
- **Preprocessors** come mostly from the **comfyui_controlnet_aux** pack: Canny (edges), Depth Anything and MiDaS (depth), OpenPose and DWPose (pose), Lineart, Scribble, Tile and others. Built-in ComfyUI has a Canny node.
- **Union** ControlNets handle several kinds in one file (for SDXL, Flux, Qwen-Image). Some families do control differently: Flux.1 Canny and Depth are separate full models; Qwen-Image and Z-Image have their own control patches or nodes. Follow the family's template.

## Values and what they change
- `strength` 0.5 to 1.0: lower gives the prompt more freedom.
- `end_percent` 0.5 to 0.8: the control sets the layout early and lets go for the detail.
- The control picture should have the output's size and proportions.

## Typical mistakes
- A ControlNet of another family: an error or no effect. SD 1.5, SDXL and Flux ControlNets do not mix.
- Feeding a raw photo to a ControlNet that expects a depth map or edges.
- Strength 1 with a detailed edge map and a different prompt: a tracing, not a new picture.

## How the app helps
Built-in descriptions of Load ControlNet Model and Apply ControlNet; **Check** reports models of different families in one path. The lessons [ControlNet: drawing along the edges of a picture](../lessons/ControlNet.md) and [ControlNet from a depth map](../lessons/ControlNet-Depth.md) build it and check that the ControlNet is made for the family of the checkpoint. The VACE lesson and [Video guided by another video: Wan 2.2 Fun Control](../lessons/Video-Control.md) use the same idea for video.

## See also
- [Video to video](Video-To-Video.md)
- [Pose animation](Pose-Animation.md)
- [Reference images](Reference-Images.md)
- [Conditioning](Conditioning.md)
- [Node packs](Node-Packs.md)
