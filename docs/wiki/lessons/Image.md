[Русский](Image.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A first picture from text

<!-- lesson: image -->
Lesson "image", in the group **Pictures: first steps** of the lesson list. Steps: 11.

## What you will be able to do
You build a graph of seven nodes that draws a picture from a prompt.

## What you need
- Model files the lesson checks:
  - a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model: `models/checkpoints`, for example `juggernautXL_v9.safetensors`.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **How a graph works** (reading)

   A graph reads from left to right. Each node does one thing, and the lines between nodes, the links, carry the result on.

   This lesson has seven nodes: the model loader, two texts, a blank, the sampler, the turn into a picture and the saving.

   A node is added by a double click in the library on the left or with the "Node" button on the canvas toolbar. You build. The app watches the canvas and ticks a step off when it is done.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the model**

   Add a **Load Checkpoint** node. Choose the model file in its `ckpt_name` field.

   This is the model that draws. One file holds three parts, so the node has three outputs: `MODEL` draws, `CLIP` understands text, `VAE` turns the result into a picture.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, a ready template for a picture from text: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Add two texts**

   Add two **CLIP Text Encode (Prompt)** nodes. One will hold what you want to see. The other holds what must not be in the picture.

   There are two nodes because the sampler takes these texts through different inputs.

4. **Connect the texts to the model**

   Drag a link from the `CLIP` output of **Load Checkpoint** to the `clip` input of each of the two text nodes.

   A link is dragged with the mouse: from the dot on the right edge of one node to the dot on the left edge of another. This is how the text reaches the part of the model that can read it.

5. **Write what you want to see**

   Fill in the `text` field of one of the two text nodes. For example: a quiet lake at dawn, mist, soft light.

   Leave the other empty or list in it what is not wanted: blur, distortion. Most models understand English best.

6. **Add the blank**

   Add a **Empty Latent Image** node. Its `width` and `height` fields set the size of the picture.

   The size follows the model. SD 1.5 was trained on pictures of 512 by 512, SDXL and the models built on it, Pony and Illustrious, on 1024 by 1024. At another size a model draws worse: it repeats figures and breaks the composition. The app tells you when the size is far from your model's.

   The model does not draw on a clean sheet. It starts from noise of this size and removes it step by step.

7. **Add the sampler**

   Add a **KSampler** node.

   This is the main node of the graph: here noise becomes an image. Everything you have added so far meets in it.

8. **Bring four links to the sampler**

   Connect to the inputs of **KSampler**:
   - to `model`, the `MODEL` output of **Load Checkpoint**;
   - to `positive`, the output of the node with your prompt;
   - to `negative`, the output of the other text node;
   - to `latent_image`, the output of **Empty Latent Image**.

   If `positive` and `negative` are swapped, the model avoids what you described.

9. **Turn the result into a picture**

   Add a **VAE Decode** node. Connect the sampler's output to its `samples` input and the `VAE` output of **Load Checkpoint** to its `vae` input.

   The sampler gives not a picture but its compressed form. This node unfolds it into pixels.

10. **Save the picture**

   Add a **Save Image** node and connect the output of **VAE Decode** to its `images` input.

   Without it ComfyUI works the picture out and puts it nowhere.

11. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try in the sampler:
   - `seed`: another number gives another picture from the same prompt;
   - `steps`: more steps, a cleaner picture and a longer wait. 20-30 is usually enough;
   - `cfg`: how strictly the model follows the text. Usually 5-8.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint** holds a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model; such a file lies in `models/checkpoints`, for example `juggernautXL_v9.safetensors`.
- Step 3, **Add two texts**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
- Step 4, **Connect the texts to the model**:
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt) (a Load LoRA or CLIP Set Last Layer in between is accepted).
- Step 5, **Write what you want to see**:
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters and 2 real words.
- Step 6, **Add the blank**:
  - a **Empty Latent Image** node.
  - advice only, the step does not wait for it: `width` and `height` of **Empty Latent Image** near the size the model chosen in `ckpt_name` of **Load Checkpoint** was trained at.
- Step 7, **Add the sampler**:
  - a **KSampler** node.
- Step 8, **Bring four links to the sampler**:
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **KSampler**.
  - `LATENT` of **Empty Latent Image** into `latent_image` of **KSampler**.
- Step 9, **Turn the result into a picture**:
  - a **VAE Decode** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode**.
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode**.
- Step 10, **Save the picture**:
  - a **Save Image** or **Preview Image** node.
  - `IMAGE` of **VAE Decode** into `images` of **Save Image** or **Preview Image**.

## Mistakes people make
- positive and negative swapped: the picture avoids what you wrote.
- `CLIP` connected to only one text node.
- Leaving the 512×512 default with an SDXL model: the lesson only advises the size of the chosen model under "Still to do" and does not hold the step back; use 1024×1024 for SDXL. See [Resolution](../concepts/Resolution.md).

## What next
These lessons go on from this one: [Reading someone else's workflow](Reading-A-Workflow.md), [When the graph does not fit the graphics card](Graph-Too-Big.md), [The prompt: how a model reads it](Prompt.md), [The sampler's settings](Sampler-Settings.md), [Refining with a second model](Refine.md), [SDXL done properly](SDXL.md), [Choosing a sampler and a scheduler](Choosing-A-Sampler.md), [Which loader for which file](Which-Loader.md), [A reference picture with IP-Adapter](IP-Adapter.md), [Fixing faces and hands with a detailer](Detailer.md), [Two versions of a prompt with one switch](Prompt-Switch.md), [A picture from a picture](Image-To-Image.md), [Upscaling with a model](Upscale.md), [ControlNet: drawing along the edges of a picture](ControlNet.md), [LoRA for pictures](LoRA-Image.md), [Removing a background](Remove-Background.md), [Music from text: ACE-Step 1.5](Audio-Music.md), [A sound from text: Stable Audio](Audio-Sound.md), [A picture into a 3D model: Hunyuan3D 2](Image-To-3D.md), [The same character in a new picture: FLUX.1 Kontext](Character-Kontext.md), [The same face from one photo: IP-Adapter FaceID](Face-From-Photo.md).

## See also
- [How lessons work](How-Lessons-Work.md)
- [Text to image](../concepts/Text-To-Image.md)
- [Checkpoint](../concepts/Checkpoint.md)
- [Latent](../concepts/Latent.md)
- [Sampler and sampler names](../concepts/Sampler.md)
- [VAE](../concepts/VAE.md)
