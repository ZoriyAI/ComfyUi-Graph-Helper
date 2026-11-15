[Русский](ControlNet-Depth.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# ControlNet from a depth map

<!-- lesson: controlnet-depth -->
Lesson "controlnet-depth", in the group **Packs and tools** of the lesson list. Steps: 7.

## What you will be able to do
The comfyui_controlnet_aux pack turns a picture into a depth map, and the model draws a new scene in the same space.

## What you need
- It goes on from [ControlNet: drawing along the edges of a picture](ControlNet.md). The card says so; it is a hint, not a lock.
- Node packs: **comfyui_controlnet_aux**. You install them in ComfyUI yourself, then choose **Sync ▸ Sync now**. Until then the card says the lesson does not fit and names the pack.
- Nodes: Load ControlNet Model, Load Image, Apply ControlNet, KSampler, Depth Anything V2 - Relative.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What a depth map gives** (reading)

   A depth map is a grey picture: near is light, far is dark. With it the model keeps the space of a scene, the walls and the distances, without copying its lines.

   ComfyUI has no depth finder of its own: it comes with the comfyui_controlnet_aux pack. A node pack runs other people's code on your computer. Install it yourself through ComfyUI's manager, from its official page, and only if you trust its authors. The app installs nothing.

   The lesson goes on from "ControlNet: drawing along the edges of a picture".

2. **The ControlNet graph is needed**

   The canvas must have **Load ControlNet Model**, **Load Image**, **Apply ControlNet** and **KSampler** as the ControlNet lesson leaves them.

   If they are not there, do that lesson first.

3. **Make the depth map**

   Add a **Depth Anything V2 - Relative** node and connect the output of **Load Image** to its `image` input. Set `resolution` to 1024.

   `resolution` is the size at which the depth is worked out: the closer to the size of the picture, the finer the detail. The node fetches its own model the first time the graph runs in ComfyUI.

4. **Give the depth map to the ControlNet**

   Connect the output of **Depth Anything V2 - Relative** to the `image` input of **Apply ControlNet**. The edges are replaced.

   The edge node can stay or go: its output leads nowhere now.

5. **Choose a depth ControlNet** (reading)

   Choose in `control_net_name` of **Load ControlNet Model** a ControlNet for depth: "depth" stands in its name. An edge ControlNet reads a depth map wrongly and gives a mess.

   Connect the depth map to a Preview Image node to see it before drawing.

6. **The other nodes of the pack** (reading)

   The pack has a node for each kind of ControlNet: lineart, OpenPose and DWPose for the pose of a person, normal maps, segmentation. Its "AIO Aux Preprocessor" node holds them all behind one list.

   The ComfyUI-Advanced-ControlNet pack adds finer control of strength over the steps, for those who need it.

7. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: a photo of a room and a prompt of a room in another style.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The ControlNet graph is needed**:
  - a **Load ControlNet Model** node.
  - a **Load Image** node.
  - a **Apply ControlNet** node.
  - a **KSampler** node.
  - `CONTROL_NET` of **Load ControlNet Model** into `control_net` of **Apply ControlNet**.
  - `positive` of **Apply ControlNet** into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - the file in `control_net_name` of **Load ControlNet Model** is made for the family of the file in `ckpt_name` of checkpoint. Why: a LoRA or a ControlNet works only with the family of models it was made for; with another family it does nothing or spoils the picture.
- Step 3, **Make the depth map**:
  - a **Depth Anything V2 - Relative** node.
  - `IMAGE` of **Load Image** into `image` of **Depth Anything V2 - Relative** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
  - `resolution` of **Depth Anything V2 - Relative** is from 768 to 2048; **Do this for me** sets 1024.
- Step 4, **Give the depth map to the ControlNet**:
  - `IMAGE` of **Depth Anything V2 - Relative** into `image` of **Apply ControlNet**.

## See also
- [ControlNet and preprocessors](../concepts/ControlNet.md)
- [How lessons work](How-Lessons-Work.md)
