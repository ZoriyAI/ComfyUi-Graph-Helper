[Русский](ControlNet.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# ControlNet: drawing along the edges of a picture

<!-- lesson: controlnet -->
Lesson "controlnet", in the group **Pictures: techniques** of the lesson list. Steps: 11.

## What you will be able to do
The model draws a new picture that keeps the outlines of a sample picture.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), KSampler, VAE Decode, Save Image / Preview Image, Load ControlNet Model, Load Image, Detect Edges (Canny), Apply ControlNet.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What ControlNet does** (reading)

   A prompt says what to draw, not where. ControlNet adds a second kind of instruction, a control picture: edges, depth, the pose of a person. The model keeps to it while drawing what the prompt says.

   The control picture is made from an ordinary one. In this lesson ComfyUI's own edge finder makes it. The lesson adds four nodes to the graph of "A first picture from text".

2. **A picture graph is needed**

   This lesson goes on from the graph of "A first picture from text". The canvas must have **Load Checkpoint**, the two texts **CLIP Text Encode (Prompt)** and **CLIP Text Encode (Prompt)**, **KSampler**, **VAE Decode** and **Save Image** with the links between them.

   If they are not there, do that lesson first.

3. **Load a ControlNet**

   Add a **Load ControlNet Model** node and choose a ControlNet for edges in its `control_net_name` field: "canny" stands in its name. ComfyUI looks for them in `models/controlnet`.

   A ControlNet is trained for one model family and one kind of control picture. An SD 1.5 ControlNet does not work with SDXL, and one for depth does not read edges.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, a ControlNet template of ComfyUI: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

4. **Load the sample picture**

   Add a **Load Image** node and choose in its `image` field the picture whose outlines you want to keep.

   This picture is only a plan: its colours and content do not go into the result.

5. **Find the edges**

   Add a **Detect Edges (Canny)** node and connect the output of **Load Image** to its `image` input.

   It draws white lines where the picture has edges. `low_threshold` and `high_threshold` say how strong an edge must be: lower values give more lines, small details too. Connect it to a Preview Image node to see what the ControlNet will get.

6. **Apply the ControlNet**

   Add an **Apply ControlNet** node and connect to it:
   - to `positive` and `negative`, the two texts;
   - to `control_net`, the output of **Load ControlNet Model**;
   - to `image`, the output of **Detect Edges (Canny)**.

   The node adds the edges to both prompts, and the model gets them together with the words.

7. **Give the sampler the new prompts**

   Connect the `positive` output of **Apply ControlNet** to the `positive` input of **KSampler**, and `negative` to `negative`. The direct links from the texts are replaced.

8. **Set the strength**

   Leave `strength` of **Apply ControlNet** at 1 for the first run.

   At 1 the model keeps strictly to the edges. When the result looks traced and stiff, lower it to 0.6: the outlines stay, and the model draws more freely inside them.

9. **When it acts: start and end** (reading)

   `start_percent` and `end_percent` say in which part of the steps the ControlNet acts, from 0 to 1. The first steps set the composition, the last ones the detail.
   - `end_percent` 0.8: the outlines are fixed early, and the last steps draw the detail freely;
   - `start_percent` 0.2: the model lays the picture out itself and only then follows the edges.

10. **Other kinds of control** (reading)

   Each ControlNet reads its own kind of picture: canny and lineart read lines, depth reads a depth map, openpose reads the skeleton of a person, scribble reads a rough drawing. ComfyUI itself only finds edges; the other control pictures are made by the comfyui_controlnet_aux pack, see "ControlNet from a depth map".

   Several ControlNets can act at once: chain two **Apply ControlNet** nodes, the outputs of the first into the inputs of the second. A "union" ControlNet reads several kinds in one file.

   For Flux, SD3.5 and Qwen-Image ComfyUI has templates with ControlNets made for them.

11. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: the same edges with two different prompts; `strength` 0.4.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A picture graph is needed**:
  - a **Load Checkpoint** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - a **VAE Decode** node.
  - a **Save Image** or **Preview Image** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly or DifferentialDiffusion or ModelSamplingAuraFlow or ModelSamplingFlux or CFGNorm or IPAdapter Unified Loader or IPAdapter or IPAdapterAdvanced or IPAdapterStyleComposition in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.
- Step 3, **Load a ControlNet**:
  - a **Load ControlNet Model** node.
  - `control_net_name` of **Load ControlNet Model**: a value is chosen.
  - the file in `control_net_name` of **Load ControlNet Model** is made for the family of the file in `ckpt_name` of **Load Checkpoint**. Why: a LoRA or a ControlNet works only with the family of models it was made for; with another family it does nothing or spoils the picture.
- Step 4, **Load the sample picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 5, **Find the edges**:
  - a **Detect Edges (Canny)** node.
  - `IMAGE` of **Load Image** into `image` of **Detect Edges (Canny)** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
- Step 6, **Apply the ControlNet**:
  - a **Apply ControlNet** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **Apply ControlNet** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **Apply ControlNet** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `CONTROL_NET` of **Load ControlNet Model** into `control_net` of **Apply ControlNet**.
  - `IMAGE` of **Detect Edges (Canny)** into `image` of **Apply ControlNet**.
- Step 7, **Give the sampler the new prompts**:
  - `positive` of **Apply ControlNet** into `positive` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
  - `negative` of **Apply ControlNet** into `negative` of **KSampler** (a Apply ControlNet or InpaintModelConditioning or Conditioning (Combine) or ConditioningSetArea or ConditioningSetAreaPercentage or ConditioningSetMask or Apply Style Model or FluxGuidance or ConditioningZeroOut or FluxKontextMultiReferenceLatentMethod in between is accepted).
- Step 8, **Set the strength**:
  - `strength` of **Apply ControlNet** is from 0.3 to 1; **Do this for me** sets 1.

## What next
These lessons go on from this one: [ControlNet from a depth map](ControlNet-Depth.md).

## See also
- [ControlNet and preprocessors](../concepts/ControlNet.md)
- [How lessons work](How-Lessons-Work.md)
