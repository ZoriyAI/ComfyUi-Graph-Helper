[Русский](Image-To-3D.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A picture into a 3D model: Hunyuan3D 2

<!-- lesson: 3d-image -->
Lesson "3d-image", in the group **3D** of the lesson list. Steps: 13.

## What you will be able to do
You build a graph that turns one picture of an object into a 3D model you can open in other programs.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `ckpt_name` of **Image Only Checkpoint Loader (img2vid model)**: a file whose name has `hunyuan3d`.
- Nodes: Image Only Checkpoint Loader (img2vid model), ModelSamplingAuraFlow, Load Image, CLIP Vision Encode, Hunyuan3Dv2Conditioning, Empty Hunyuan 3D v2 Latent, KSampler, Hunyuan 3D VAE Decode, Voxel to Mesh, Save 3D Model.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What comes out** (reading)

   Hunyuan3D 2 looks at one picture of an object and builds its shape in 3D. The result is a mesh, a surface of many small triangles, without colours: a white model.

   The best picture shows one object whole, on a plain background, from a little above and to the side.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add a **Image Only Checkpoint Loader (img2vid model)** node. In `ckpt_name` choose `hunyuan3d-dit-v2_fp16.safetensors` (version 2.0) or `hunyuan_3d_v2.1.safetensors` (version 2.1) from models/checkpoints.

   This loader takes a model that reads pictures, not text: its outputs are the model, the picture reader `CLIP_VISION` and the decoder.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the template "HY 3D 2.0" or "HY 3D 2.1: Single View to Model": it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Set the noise shift**

   Add a **ModelSamplingAuraFlow** node, connect the `MODEL` output of **Image Only Checkpoint Loader (img2vid model)** to its `model` input and set `shift` to 1.

   Both templates use 1. This model was trained for that value.

4. **Load the picture**

   Add a **Load Image** node and choose the picture in its `image` field.

   A background with other objects becomes part of the model. Remove it first if you can.

5. **Let the model see the picture**

   Add a **CLIP Vision Encode** node. Connect the `CLIP_VISION` output of **Image Only Checkpoint Loader (img2vid model)** to its `clip_vision` input and the picture from **Load Image** to its `image` input. Set `crop` to `center`.

   This node turns the picture into a prompt the model can follow.

6. **Turn it into a condition**

   Add a **Hunyuan3Dv2Conditioning** node and connect the output of **CLIP Vision Encode** to its `clip_vision_output` input.

   It gives two outputs, `positive` and `negative`, ready for the sampler. Nothing is written by hand here: the picture is the whole prompt.

7. **Add the blank**

   Add a **Empty Hunyuan 3D v2 Latent** node and set `resolution` to 3072.

   This is how finely the shape is worked out. Version 2.0 uses 3072, version 2.1 uses 4096.

8. **Add the sampler**

   Add a **KSampler** node and connect four inputs:
   - `model` from **ModelSamplingAuraFlow**;
   - `positive` and `negative` from the outputs of the same name of **Hunyuan3Dv2Conditioning**;
   - `latent_image` from **Empty Hunyuan 3D v2 Latent**.

   Set `steps` to 20 and `cfg` to 8, as the template of version 2.0 does. For version 2.1 the template uses 30 and 5.

9. **Turn the result into a volume**

   Add a **Hunyuan 3D VAE Decode** node. Connect the output of **KSampler** to its `samples` input and the `VAE` output of **Image Only Checkpoint Loader (img2vid model)** to its `vae` input.

   The result is a voxel grid: space cut into small cubes, each either inside the object or outside.

10. **Turn the volume into a mesh**

   Add a **Voxel to Mesh** node and connect the output of **Hunyuan 3D VAE Decode** to its `voxel` input. Set `algorithm` to `surface net` and `threshold` to 0.6.

   `surface net` gives a smoother surface than `basic`. The threshold says where the inside ends: lower makes the object fatter, higher thinner and with holes.

11. **Save the model**

   Add a **Save 3D Model** node and connect the output of **Voxel to Mesh** to its `mesh` input.

12. **Where the file goes and what opens it** (reading)

   In ComfyUI the node writes a .glb file into the output/3d folder and shows the model on the canvas.

   A .glb file opens in Blender (File ▸ Import ▸ glTF), in most 3D viewers and game engines, and in a web browser through any glTF viewer. The model has no colours yet: they are painted in another program or by a texturing graph.

   The ComfyUI-3D-Pack pack and the TRELLIS.2 nodes of ComfyUI itself also build models with colours, but their graphs are much larger.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   If the model has holes or lumps: a cleaner picture helps most, then a larger `resolution`.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Image Only Checkpoint Loader (img2vid model)** node.
  - `ckpt_name` of **Image Only Checkpoint Loader (img2vid model)** holds a file whose name has `hunyuan3d` (capitals, dots and dashes do not matter).
- Step 3, **Set the noise shift**:
  - a **ModelSamplingAuraFlow** node.
  - `MODEL` of **Image Only Checkpoint Loader (img2vid model)** into `model` of **ModelSamplingAuraFlow**.
  - `shift` of **ModelSamplingAuraFlow** is `1`.
- Step 4, **Load the picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 5, **Let the model see the picture**:
  - a **CLIP Vision Encode** node.
  - `CLIP_VISION` of **Image Only Checkpoint Loader (img2vid model)** into `clip_vision` of **CLIP Vision Encode**.
  - `IMAGE` of **Load Image** into `image` of **CLIP Vision Encode**.
  - `crop` of **CLIP Vision Encode** is `center`.
- Step 6, **Turn it into a condition**:
  - a **Hunyuan3Dv2Conditioning** node.
  - `CLIP_VISION_OUTPUT` of **CLIP Vision Encode** into `clip_vision_output` of **Hunyuan3Dv2Conditioning**.
- Step 7, **Add the blank**:
  - a **Empty Hunyuan 3D v2 Latent** node.
  - `resolution` of **Empty Hunyuan 3D v2 Latent** is from 3072 to 4096; **Do this for me** sets 3072.
- Step 8, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingAuraFlow** into `model` of **KSampler**.
  - `positive` of **Hunyuan3Dv2Conditioning** into `positive` of **KSampler**.
  - `negative` of **Hunyuan3Dv2Conditioning** into `negative` of **KSampler**.
  - `LATENT` of **Empty Hunyuan 3D v2 Latent** into `latent_image` of **KSampler**.
  - `steps` of **KSampler** is from 20 to 30; **Do this for me** sets 20.
  - `cfg` of **KSampler** is from 5 to 8; **Do this for me** sets 8.
- Step 9, **Turn the result into a volume**:
  - a **Hunyuan 3D VAE Decode** node.
  - `LATENT` of **KSampler** into `samples` of **Hunyuan 3D VAE Decode**.
  - `VAE` of **Image Only Checkpoint Loader (img2vid model)** into `vae` of **Hunyuan 3D VAE Decode**.
- Step 10, **Turn the volume into a mesh**:
  - a **Voxel to Mesh** node.
  - `VOXEL` of **Hunyuan 3D VAE Decode** into `voxel` of **Voxel to Mesh**.
  - `algorithm` of **Voxel to Mesh** is `surface net`.
  - `threshold` of **Voxel to Mesh** is from 0.5 to 0.7; **Do this for me** sets 0.6.
- Step 11, **Save the model**:
  - a **Save 3D Model** node.
  - `MESH` of **Voxel to Mesh** into `mesh` of **Save 3D Model**.

## See also
- [Where ComfyUI files live](../concepts/Where-Files-Live.md)
- [How lessons work](How-Lessons-Work.md)
