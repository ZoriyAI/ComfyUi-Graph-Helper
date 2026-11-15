[Русский](Two-Models.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Two models in one graph

<!-- lesson: two-models -->
Lesson "two-models", in the group **Video** of the lesson list. Steps: 13.

## What you will be able to do
A picture model draws the first frame and Wan brings it to life. Each has its own LoRAs and its own prompt.

## What you need
- It goes on from [Video from a picture](Video-Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model: `models/checkpoints`, for example `juggernautXL_v9.safetensors`.
- Nodes: Load CLIP, Load VAE, CLIP Text Encode (Prompt), WanImageToVideo, VAE Decode, Load Checkpoint, Empty Latent Image, KSampler, Save Image / Preview Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Why join models** (reading)

   Each model is strong at its own thing. A picture model keeps looks, style and composition more exactly, and it has the most LoRAs. A video model can move things. In one graph the first draws a frame and the second brings it to life.

   Each model has a set of its own: its file, its text reader, its VAE and its LoRAs. The parts of one set do not fit another. A text read for one model is not understood by another.

   What passes between models is a picture. A picture is plain pixels, and any model understands it. In this lesson you build a second model onto the video graph and lead a picture from it.

2. **A video-from-a-picture graph is needed**

   This lesson goes on from the graph of "Video from a picture". The canvas must have **Load CLIP** and **Load VAE**, two texts connected to **WanImageToVideo**, and a **VAE Decode** node at the end.

   If they are not there, do that lesson first.

3. **Add a picture model**

   Add a **Load Checkpoint** node and choose in `ckpt_name` the model that will draw the first frame.

   This is the second model of the graph. It has nothing to do with Wan: it has its own `MODEL`, `CLIP` and `VAE` outputs, and from here on they go only to its own nodes.

4. **Give it texts of its own**

   Add two new **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load Checkpoint** to the `clip` input of each. In the `text` field of one describe the frame: who is in it, where, what the light is.

   The texts of the video will not do: they were read for Wan. Each model has text nodes of its own, connected to its own text reader.

   Write in the manner of this model. How to tell it is shown in "The prompt: how a model reads it".

5. **Build the part that draws the frame**

   Add **Empty Latent Image** and **KSampler**. Connect to the inputs of **KSampler**:
   - to `model`, the `MODEL` output of **Load Checkpoint**;
   - to `positive` and `negative`, the two new texts;
   - to `latent_image`, the output of **Empty Latent Image**.

   This is the graph of "A first picture from text", only it stands next to the video graph.

6. **The size of the frame**

   The frame must have the proportions of the clip. The **WanImageToVideo** node brings the picture to its own `width` and `height` by itself, but when the proportions differ it cuts the edges off.

   The exact size may be another one: draw the frame at the size the model was trained at. For a clip of 832 by 480, in **Empty Latent Image** these fit:
   - for SDXL, Pony, Illustrious: `width` 1344 and `height` 768;
   - for SD 1.5: `width` 832 and `height` 480.

   For an upright clip swap the numbers in both nodes.

7. **Lead the picture to the video**

   Add one more **VAE Decode** node. Connect the output of **KSampler** to its `samples` input and the `VAE` output of **Load Checkpoint** to its `vae` input. Connect its `IMAGE` output to the `start_image` input of **WanImageToVideo**.

   This is the bridge between the models. The link that went into `start_image` before comes off by itself: the node with the loaded picture can be deleted.

   A frame is unfolded by the VAE of the model that drew it. The VAE of Wan will not do here.

8. **Save the frame itself too**

   Add a **Save Image** node and connect the same `IMAGE` output of **VAE Decode** to its `images` input.

   This lets you see the frame apart from the clip. When a clip fails, it is clear at once where the fault is: in the frame or in the motion.

9. **Two prompts, each with its own job** (reading)

   The graph now has two prompts. The first, for the picture model, says what is in the frame: the subject, the clothes, the place, the light, the style. The second, for Wan, says what changes: the motion and the camera.

   Do not carry one over into the other. Words about motion in the prompt of a frame mean nothing to a picture model. And details of looks in the prompt of a clip argue with the finished frame.

   The second texts, those for the `negative` input, differ too: each model has defects of its own.

10. **LoRA: each in the path of its own model** (reading)

   A LoRA is made for one family of models. It goes into the path of the model it was made for:
   - a LoRA for the picture model: between **Load Checkpoint** and **KSampler**. If the LoRA node also has a `CLIP` input and output, connect the texts of the frame to its `CLIP` output;
   - a LoRA for Wan: between the loader of each of its two models and the node that sets the noise shift, as in "LoRA: add a style or a subject".

   A LoRA put into the wrong path does nothing. ComfyUI does not stop at it: it silently skips what did not fit.

   The words of a LoRA go into the prompt of the same model. The words of a picture LoRA go into the prompt of the frame, the words of a Wan LoRA into the prompt of the clip.

   A handy division: looks and style come from the LoRAs of the picture model, motion from the LoRAs of the video model. Which family a file belongs to is shown by its card in the "Models" tab. The "Check" button says when models of different families meet in one path.

11. **Two models and memory** (reading)

   ComfyUI loads the models in turn: first the one that draws the frame, then Wan. If the graphics card has no room for both, it unloads the first by itself. So a graph with two models runs on the same card as each of them alone, only longer.

   ComfyUI works out again only what has changed. As long as the part with the frame is untouched, the next run takes the finished frame and goes straight to the video.

   To keep the frame from changing by itself, fix the number in the `seed` field of **KSampler**: in ComfyUI set the `control_after_generate` switch under it to `fixed`. Otherwise the number changes at every run, the frame is drawn anew, and the clip starts from another picture each time.

   Get a good frame first, then work on the motion. While you look for the frame, the node that saves the clip can be switched off in ComfyUI: select it and press Ctrl+M. Then only the frame is worked out.

12. **Other ways to combine models** (reading)

   A picture from one model to another is the most general way. There are three more.

   A refining pass. The second model does not draw from nothing: it redraws a finished picture on top, changing it only in part. This takes the composition from one model and the texture from another. "Refining with a second model" shows it.

   Passing without a picture. Models of one family understand each other's compressed form, and it can be passed between them directly, from a `LATENT` output. SDXL and its descendants work this way, and so do the two Wan 2.2 models of the video lessons: the first lays out, the second finishes.

   Two graphs instead of one. The frame is drawn and picked in one graph, and the video is made in another from the saved picture. This is simpler and safer when many frames have to be tried.

13. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try:
   - another frame: change `seed` in **KSampler**;
   - the same frame, another motion: change `noise_seed` in the first sampler of the video, or the prompt of the clip;
   - another style of frame: change the picture model or its LoRAs. The video part need not change.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A video-from-a-picture graph is needed**:
  - a **Load CLIP** node.
  - a **Load VAE** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - a **WanImageToVideo** node.
  - a **VAE Decode** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **WanImageToVideo**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **WanImageToVideo**.
  - `VAE` of **Load VAE** into `vae` of **WanImageToVideo**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** (decoder).
- Step 3, **Add a picture model**:
  - a **Load Checkpoint** node.
  - `ckpt_name` of **Load Checkpoint** holds a picture model (SD 1.5, SDXL, Pony, Illustrious, Flux and the like), not a video model; such a file lies in `models/checkpoints`, for example `juggernautXL_v9.safetensors`.
- Step 4, **Give it texts of its own**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (prompt of the frame) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `CLIP` of **Load Checkpoint** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt of the frame) (a Load LoRA or CLIP Set Last Layer in between is accepted).
  - `text` of **CLIP Text Encode (Prompt)** (prompt of the frame) holds at least 3 characters and 2 real words.
- Step 5, **Build the part that draws the frame**:
  - a **Empty Latent Image** node.
  - a **KSampler** node.
  - `MODEL` of **Load Checkpoint** into `model` of **KSampler** (a Load LoRA or LoraLoaderModelOnly in between is accepted).
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt of the frame) into `positive` of **KSampler**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt of the frame) into `negative` of **KSampler**.
  - `LATENT` of **Empty Latent Image** into `latent_image` of **KSampler**.
- Step 6, **The size of the frame**:
  - `width` and `height` of **Empty Latent Image** in the proportions of **WanImageToVideo**, within 5 %. Why: the node that starts the clip brings the frame to its own size. If the proportions differ, it crops the edges.
- Step 7, **Lead the picture to the video**:
  - a **VAE Decode** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode** (decoder of the frame).
  - `VAE` of **Load Checkpoint** into `vae` of **VAE Decode** (decoder of the frame).
  - `IMAGE` of **VAE Decode** (decoder of the frame) into `start_image` of **WanImageToVideo**.
- Step 8, **Save the frame itself too**:
  - a **Save Image** or **Preview Image** node.
  - `IMAGE` of **VAE Decode** (decoder of the frame) into `images` of **Save Image** or **Preview Image**.

## Mistakes people make
- Decoding the frame with Wan's VAE.
- Using the video prompts for the frame.
- A picture LoRA in Wan's path: nothing happens, silently.
- `randomize` on the frame's seed: a new frame every run.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Why families do not mix](../concepts/Why-Families-Do-Not-Mix.md)
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
- [Bypass and mute](../concepts/Bypass-And-Mute.md)
- [Seed](../concepts/Seed.md)
