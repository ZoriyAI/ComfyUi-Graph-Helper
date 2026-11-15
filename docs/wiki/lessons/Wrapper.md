[Русский](Wrapper.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video on WanVideoWrapper

<!-- lesson: wrapper -->
Lesson "wrapper", in the group **WanVideoWrapper** of the lesson list. Steps: 17.

## What you will be able to do
You build a Wan 2.2 graph on the nodes of the WanVideoWrapper pack and see how it differs from the built-in one.

## What you need
- Model files the lesson checks:
  - the high_noise half of Wan 2.2: `models/diffusion_models`, for example `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`;
  - the low_noise half of Wan 2.2: `models/diffusion_models`, for example `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, WanVideo Empty Embeds / WanVideo ImageToVideo Encode / WanVideo VACE Encode, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What WanVideoWrapper is** (reading)

   WanVideoWrapper is a pack of nodes by an author called Kijai. It runs the same Wan models as ComfyUI's built-in nodes, in its own way. People like it for two things: it can keep a large model in parts, now in the graphics card and now in ordinary memory, and new Wan features appear in it first.

   Important: its nodes do not connect to the built-in ones. The model from its loader has a type of its own, and the `model` input of a built-in sampler will not take it. So a graph is built wholly on one or wholly on the other.

   This lesson repeats "Video from text", only on the pack's nodes. If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load two models**

   Add two **WanVideo Model Loader** nodes. In the `model` field of one choose the file with `high_noise` in its name, in the other the file with `low_noise`.

   Leave `quantization` at `disabled`: the node works out the file's format itself. Leave `load_device` at `offload_device` if the model is larger than the graphics card's memory.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the example graph from the pack's own `example_workflows` folder: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Load the text reader**

   Add a **WanVideo T5 Text Encoder Loader** node and choose the `umt5-xxl-enc` file in `model_name`.

   The pack has a text reader of its own. It needs a file from the pack author's set, published on Hugging Face in Kijai/WanVideo_comfy. The file from ComfyUI's templates may not fit this node: then ComfyUI reports an error when the graph runs.

4. **Load the VAE**

   Add a **WanVideo VAE Loader** node and choose the `wan_2.1_vae` file in `model_name`.

   As in the built-in graph, the large Wan 2.2 models need the VAE of version 2.1.

5. **Write the prompt**

   Add a **WanVideo TextEncode** node. Connect the output of **WanVideo T5 Text Encoder Loader** to its `t5` input.

   Here both texts are in one node: the prompt of the clip in `positive_prompt`, what must not be there in `negative_prompt`. Write the way "A prompt for video" shows.

6. **Set the size and the length**

   Add an **WanVideo Empty Embeds** node. Set `width` to 832, `height` to 480 and `num_frames` to 81.

   This node takes the place of the empty blank of the built-in graph. 81 frames at 16 frames a second make five seconds.

7. **The first pass**

   Add a **WanVideo Sampler** node and connect to it:
   - to `model`, the output of the **WanVideo Model Loader** node with the `high_noise` model;
   - to `text_embeds`, the output of **WanVideo TextEncode**;
   - to `image_embeds`, the output of **WanVideo Empty Embeds**.

   There is no separate node for the noise shift here: the sampler's own `shift` field sets it.

8. **The second pass**

   Add a second **WanVideo Sampler** node and connect to it:
   - to `model`, the `low_noise` model;
   - to `text_embeds` and `image_embeds`, the same outputs as for the first;
   - to `samples`, the `samples` output of the first sampler.

   This way the second sampler receives the unfinished clip and finishes it.

9. **Split the steps**

   Set `steps` to 20 in both samplers. Set `end_step` to 10 in the first and `start_step` to 10 in the second.

   The first does the steps from zero to ten, the second from ten to the end. An `end_step` of -1 means "to the end": with it the first sampler would do everything itself.

   There are no separate noise fields here as in the built-in sampler: the pack knows by itself that the clip came unfinished.

10. **Strictness and the noise shift**

   Set `cfg` to 3.5 and `shift` to 8 in both samplers.

   These are the numbers of the built-in graph. The pack's sampler starts at `cfg` 6: for Wan 2.2 that is too strict, and the clip burns out.

11. **Turn the result into frames**

   Add a **WanVideo Decode** node. Connect the second sampler's output to its `samples` input and the output of **WanVideo VAE Loader** to its `vae` input.

12. **Make the clip and save it**

   Add **Create Video** and **Save Video**. The frames from **WanVideo Decode** go into the `images` input of **Create Video**, and its output into the `video` input of **Save Video**. Set `fps` to 16.

   The pack needs no nodes of its own for saving: the built-in ones do.

13. **When the graphics card runs out of memory** (reading)

   The Wan 2.2 14B model is larger than most graphics cards hold. The pack deals with this so: some blocks of the model stay in ordinary memory and move into the graphics card only when they are needed.

   For that add a WanVideo BlockSwap node and connect its output to the `block_swap_args` input of each model loader. Its `blocks_to_swap` field is the number of blocks kept outside the graphics card: start at 20 and raise it until the clip stops failing for lack of memory. The larger the number, the slower.

   Two more ways to save memory: a model file in fp8 format, and `quantization` set to `fp8_e4m3fn`.

14. **LoRA in this pack** (reading)

   Here a LoRA does not stand in the model's path: it is connected to the loader. Add a WanVideo Lora Select node, choose the file in its `lora` field and connect its output to the `lora` input of the model loader.

   Each model gets a node of its own: the `high` file to the loader of the `high_noise` model, the `low` file to the loader of `low_noise`. Several LoRAs are chained: the output of one select node to the `prev_lora` input of the next.

   LoRAs for the built-in Wan graph fit here too: they are the same files.

15. **The LoRA's words in the prompt**

   If the canvas has a LoRA select node, add the words of its file to the `positive_prompt` field.

   The app compares the prompt with the words written in the LoRA files on the canvas. If there is no LoRA, or its file holds no words, the step counts on its own.

16. **Fast in four steps** (reading)

   The `lightx2v` speed-up LoRA works in this pack too. Put it to both models through LoRA select nodes, and in the samplers set `steps` to 4, `end_step` to 2 in the first, `start_step` to 2 in the second and `cfg` to 1 in both.

   At `cfg` 1 the text of the `negative_prompt` field does not act.

17. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The "Check" button reads this pack's prompts too: it says when forms of other programs are left in a text or the second text does not act at `cfg` 1.

   Next: "Video from a picture on WanVideoWrapper" starts the clip from your picture.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load two models**:
  - a **WanVideo Model Loader** node.
  - a **WanVideo Model Loader** node.
  - `model` of **WanVideo Model Loader** (first pass) holds the high_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `model` of **WanVideo Model Loader** (second pass) is not the same file as `model` of **WanVideo Model Loader** (first pass).
  - `model` of **WanVideo Model Loader** (second pass) holds the low_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 3, **Load the text reader**:
  - a **WanVideo T5 Text Encoder Loader** node.
  - `model_name` of **WanVideo T5 Text Encoder Loader** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
- Step 4, **Load the VAE**:
  - a **WanVideo VAE Loader** node.
  - `model_name` of **WanVideo VAE Loader** holds the Wan 2.1 VAE (wan_2.1_vae); such a file lies in `models/vae`, for example `wan_2.1_vae.safetensors`.
- Step 5, **Write the prompt**:
  - a **WanVideo TextEncode** node.
  - `wan_t5_model` of **WanVideo T5 Text Encoder Loader** into `t5` of **WanVideo TextEncode**.
  - `positive_prompt` of **WanVideo TextEncode** holds at least 3 characters and 2 real words.
- Step 6, **Set the size and the length**:
  - a **WanVideo Empty Embeds** or **WanVideo ImageToVideo Encode** or **WanVideo VACE Encode** node.
  - `num_frames` of **WanVideo Empty Embeds** or **WanVideo ImageToVideo Encode** or **WanVideo VACE Encode** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
- Step 7, **The first pass**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** (first pass) into `model` of **WanVideo Sampler** (first pass).
  - `text_embeds` of **WanVideo TextEncode** into `text_embeds` of **WanVideo Sampler** (first pass).
  - `WANVIDIMAGE_EMBEDS` of **WanVideo Empty Embeds** or **WanVideo ImageToVideo Encode** or **WanVideo VACE Encode** into `image_embeds` of **WanVideo Sampler** (first pass).
- Step 8, **The second pass**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** (second pass) into `model` of **WanVideo Sampler** (second pass).
  - `text_embeds` of **WanVideo TextEncode** into `text_embeds` of **WanVideo Sampler** (second pass).
  - `WANVIDIMAGE_EMBEDS` of **WanVideo Empty Embeds** or **WanVideo ImageToVideo Encode** or **WanVideo VACE Encode** into `image_embeds` of **WanVideo Sampler** (second pass).
  - `samples` of **WanVideo Sampler** (first pass) into `samples` of **WanVideo Sampler** (second pass).
- Step 9, **Split the steps**:
  - `steps` of **WanVideo Sampler** (first pass) is from 4 to 40; **Do this for me** sets 20. Why: twenty steps are split between two passes; with another number the hand-over moves.
  - `end_step` of **WanVideo Sampler** (first pass) is from 1 to 20; **Do this for me** sets 10. Why: at this step the first model hands the clip to the second: twenty steps are split in half.
  - `end_step` of **WanVideo Sampler** (first pass) is below `steps` of **WanVideo Sampler** (first pass). Why: if the first sampler stops no earlier than its last step, it does everything itself and leaves the second nothing to finish.
  - `steps` of **WanVideo Sampler** (second pass) equals `steps` of **WanVideo Sampler** (first pass). Why: both samplers count the same steps, or the hand-over between them does not line up.
  - `start_step` of **WanVideo Sampler** (second pass) equals `end_step` of **WanVideo Sampler** (first pass). Why: the second sampler goes on from the step the first one stopped at. Otherwise some steps are lost or done twice.
- Step 10, **Strictness and the noise shift**:
  - `cfg` of **WanVideo Sampler** (first pass) is from 1 to 4; **Do this for me** sets 3.5. Why: the pack's sampler starts at cfg 6, which is too strict for Wan 2.2: the clip burns out.
  - `cfg` of **WanVideo Sampler** (second pass) is from 1 to 4; **Do this for me** sets 3.5. Why: the pack's sampler starts at cfg 6, which is too strict for Wan 2.2: the clip burns out.
  - `shift` of **WanVideo Sampler** (first pass) is from 5 to 8; **Do this for me** sets 8. Why: with a small shift Wan holds composition and motion worse, and the clip comes out sluggish.
  - `shift` of **WanVideo Sampler** (second pass) is from 5 to 8; **Do this for me** sets 8. Why: with a small shift Wan holds composition and motion worse, and the clip comes out sluggish.
- Step 11, **Turn the result into frames**:
  - a **WanVideo Decode** node.
  - `samples` of **WanVideo Sampler** (second pass) into `samples` of **WanVideo Decode**.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Decode**.
- Step 12, **Make the clip and save it**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **WanVideo Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `16`. Why: wan draws 16 frames per second. With another number the clip runs faster or slower than it was meant to.
- Step 15, **The LoRA's words in the prompt**:
  - `positive_prompt` of **WanVideo TextEncode** holds a trigger word of the file chosen in `lora` of any **WanVideo Lora Select**, when the file's description names any.

## Mistakes people make
- Connecting a pack loader to a built-in sampler: the link does not attach (`WANVIDEOMODEL` is not `MODEL`).
- `end_step` left at -1: the first sampler does everything.
- The ComfyUI `umt5_xxl` file in the pack's T5 loader: an error at run time.
- cfg 6 left from the default: a burnt clip.

## What next
These lessons go on from this one: [Video from a picture on WanVideoWrapper](Wrapper-Image.md), [VACE: motion from another video](Wrapper-VACE.md).

## See also
- [How lessons work](How-Lessons-Work.md)
- [Node packs](../concepts/Node-Packs.md)
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
- [Wan 2.2 two passes](../concepts/Wan-Two-Passes.md)
- [Lesson: Video from text](Video-Text.md)
