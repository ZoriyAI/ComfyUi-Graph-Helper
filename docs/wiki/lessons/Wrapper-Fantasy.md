[Русский](Wrapper-Fantasy.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A talking portrait: FantasyTalking

<!-- lesson: wrapper-fantasy -->
Lesson "wrapper-fantasy", in the group **WanVideoWrapper** of the lesson list. Steps: 15.

## Consent first
Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
A portrait says a short voice recording. The graph is simpler than InfiniteTalk's, the clip shorter.

## What you need
- Model files the lesson checks:
  - Wan 2.1 image to video (i2v) 14B: `models/diffusion_models`, for example `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`;
  - clip_vision_h: `models/clip_vision`, for example `clip_vision_h.safetensors`;
  - the FantasyTalking module: `models/diffusion_models`, for example `fantasytalking_fp16.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, FantasyTalking Model Loader, WanVideo ImageToVideo Encode, Load Audio, (Down)load Wav2Vec Model, FantasyTalking Wav2Vec Embeds, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What FantasyTalking does** (reading)

   FantasyTalking also teaches the Wan 2.1 "image to video" model to listen to sound, but it is built more simply than InfiniteTalk: a plain start from a picture, with no stitching of pieces. The clip comes out short, but the graph reads at a glance.

   Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add the node **WanVideo Model Loader** and choose in the field `model` a Wan 2.1 `i2v` 14B model, preferably the 720p one.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the FantasyTalking example graph from the `example_workflows` folder of the WanVideoWrapper pack: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text reader and the VAE**

   Add the nodes **WanVideo T5 Text Encoder Loader** and **WanVideo VAE Loader**. In the field `model_name` of the first choose the file `umt5-xxl-enc`, of the second the file `wan_2.1_vae`.

4. **Describe the frame briefly**

   Add the node **WanVideo TextEncode** and connect the output of **WanVideo T5 Text Encoder Loader** to its input `t5`. In the field `positive_prompt` say who speaks and how: calmly, with a smile, with gestures.

   What is said the model takes from the sound, not from the text.

5. **Load the portrait**

   Add the node **Load Image** and choose in the field `image` a portrait. A face seen large and from the front works best.

6. **Show the portrait to the model**

   Add the nodes **Load CLIP Vision** and **WanVideo ClipVision Encode**. In the field `clip_name` of the first choose the file `clip_vision_h`. Connect its output to the input `clip_vision` of the second, and the portrait to the input `image_1`.

7. **Add the FantasyTalking module**

   Add the node **FantasyTalking Model Loader** and choose in the field `model` the file of the FantasyTalking module. Connect its output to the input `fantasytalking_model` of the model loader.

8. **Prepare the start**

   Add the node **WanVideo ImageToVideo Encode**. Connect the output of **WanVideo VAE Loader** to its input `vae`, the portrait to the input `start_image`, and the output of **WanVideo ClipVision Encode** to the input `clip_embeds`.

   Leave the field `num_frames` at 81. At 23 frames a second that is three and a half seconds of speech.

9. **Load the voice**

   Add three nodes: **Load Audio**, **(Down)load Wav2Vec Model** and **FantasyTalking Wav2Vec Embeds**.
   - In **Load Audio** choose in the field `audio` a sound file from the `input` folder.
   - In **(Down)load Wav2Vec Model** set the field `model` to `facebook/wav2vec2-base-960h`: FantasyTalking was trained with it. The node downloads this model itself when the graph is first run in ComfyUI.
   - Three links go into **FantasyTalking Wav2Vec Embeds**: `wav2vec_model` from **(Down)load Wav2Vec Model**, `fantasytalking_model` from **FantasyTalking Model Loader**, and the sound.
   - In **FantasyTalking Wav2Vec Embeds** set `fps` to 23, and `num_frames` to the same number as in **WanVideo ImageToVideo Encode**.

10. **Add the sampler**

   Add the node **WanVideo Sampler** and connect to it:
   - the model to the input `model`;
   - the prompt to the input `text_embeds`;
   - the output of **WanVideo ImageToVideo Encode** to the input `image_embeds`;
   - the output of **FantasyTalking Wav2Vec Embeds** to the input `fantasytalking_embeds`.

11. **Turn the result into frames**

   Add the node **WanVideo Decode**. Connect the output of the sampler to its input `samples`, and the output of **WanVideo VAE Loader** to the input `vae`.

12. **Assemble the clip**

   Add the nodes **Create Video** and **Save Video**: the frames into `images`, the clip into `video`. Set the field `fps` to 23, as the sound has.

13. **Put the sound into the clip**

   Connect the output of **Load Audio** to the input `audio` of **Create Video**.

   Without it the clip is saved silent, though the lips move.

14. **If the lips miss the words** (reading)

   What to change in **FantasyTalking Wav2Vec Embeds**:
   - the lips move weakly: raise `audio_scale` to 1.2;
   - the face is frozen and only the lips move: set `audio_cfg_scale` to 2; the clip takes longer to compute;
   - the recording is longer than the clip: only its beginning is used. Cut the recording beforehand or raise `num_frames` in both nodes.

   For long speech take InfiniteTalk: it stitches a clip out of pieces.

15. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The first run takes longer than usual: the node **(Down)load Wav2Vec Model** downloads the speech model.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **WanVideo Model Loader** node.
  - `model` of **WanVideo Model Loader** holds Wan 2.1 image to video (i2v) 14B; such a file lies in `models/diffusion_models`, for example `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`.
- Step 3, **The text reader and the VAE**:
  - a **WanVideo T5 Text Encoder Loader** node.
  - a **WanVideo VAE Loader** node.
  - `model_name` of **WanVideo T5 Text Encoder Loader** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - `model_name` of **WanVideo VAE Loader** holds the Wan 2.1 VAE (wan_2.1_vae); such a file lies in `models/vae`, for example `wan_2.1_vae.safetensors`.
- Step 4, **Describe the frame briefly**:
  - a **WanVideo TextEncode** node.
  - `wan_t5_model` of **WanVideo T5 Text Encoder Loader** into `t5` of **WanVideo TextEncode**.
  - `positive_prompt` of **WanVideo TextEncode** holds at least 3 characters and 2 real words.
- Step 5, **Load the portrait**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 6, **Show the portrait to the model**:
  - a **Load CLIP Vision** node.
  - a **WanVideo ClipVision Encode** node.
  - `CLIP_VISION` of **Load CLIP Vision** into `clip_vision` of **WanVideo ClipVision Encode**.
  - `IMAGE` of **Load Image** into `image_1` of **WanVideo ClipVision Encode**.
  - `clip_name` of **Load CLIP Vision** holds clip_vision_h; such a file lies in `models/clip_vision`, for example `clip_vision_h.safetensors`.
- Step 7, **Add the FantasyTalking module**:
  - a **FantasyTalking Model Loader** node.
  - `model` of **FantasyTalking Model Loader** into `fantasytalking_model` of **WanVideo Model Loader**.
  - `model` of **FantasyTalking Model Loader** holds the FantasyTalking module; such a file lies in `models/diffusion_models`, for example `fantasytalking_fp16.safetensors`.
- Step 8, **Prepare the start**:
  - a **WanVideo ImageToVideo Encode** node.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo ImageToVideo Encode**.
  - `IMAGE` of **Load Image** into `start_image` of **WanVideo ImageToVideo Encode**.
  - `WANVIDIMAGE_CLIPEMBEDS` of **WanVideo ClipVision Encode** into `clip_embeds` of **WanVideo ImageToVideo Encode**.
  - `num_frames` of **WanVideo ImageToVideo Encode** is from 49 to 121, a frame count of the form 4n + 1; **Do this for me** sets 81. Why: wan takes a number of frames of the form 4n + 1: 49, 81, 121. 81 frames at 16 per second make five seconds.
- Step 9, **Load the voice**:
  - a **Load Audio** node.
  - a **(Down)load Wav2Vec Model** node.
  - a **FantasyTalking Wav2Vec Embeds** node.
  - `wav2vec_model` of **(Down)load Wav2Vec Model** into `wav2vec_model` of **FantasyTalking Wav2Vec Embeds**.
  - `model` of **FantasyTalking Model Loader** into `fantasytalking_model` of **FantasyTalking Wav2Vec Embeds**.
  - `AUDIO` of **Load Audio** into `audio` of **FantasyTalking Wav2Vec Embeds**.
  - `audio` of **Load Audio**: a value is chosen.
  - `model` of **(Down)load Wav2Vec Model** is `facebook/wav2vec2-base-960h`. Why: fantasyTalking was trained with this speech model; with another one the lips miss the words.
  - `fps` of **FantasyTalking Wav2Vec Embeds** is `23`. Why: fantasyTalking was trained at 23 frames per second; with another number the lips drift away from the words.
  - `num_frames` of **FantasyTalking Wav2Vec Embeds** equals `num_frames` of **WanVideo ImageToVideo Encode**. Why: the sound is laid out on as many frames as the clip has, or the lips drift away from the words.
- Step 10, **Add the sampler**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** into `model` of **WanVideo Sampler**.
  - `text_embeds` of **WanVideo TextEncode** into `text_embeds` of **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` of **WanVideo ImageToVideo Encode** into `image_embeds` of **WanVideo Sampler**.
  - `fantasytalking_embeds` of **FantasyTalking Wav2Vec Embeds** into `fantasytalking_embeds` of **WanVideo Sampler**.
- Step 11, **Turn the result into frames**:
  - a **WanVideo Decode** node.
  - `samples` of **WanVideo Sampler** into `samples` of **WanVideo Decode**.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Decode**.
- Step 12, **Assemble the clip**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **WanVideo Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `23`. Why: fantasyTalking was trained at 23 frames per second; with another number the lips drift away from the words.
- Step 13, **Put the sound into the clip**:
  - `AUDIO` of **Load Audio** into `audio` of **Create Video**.

## Mistakes people make
- Different `num_frames` in the start and the sound nodes.
- A recording longer than the clip: only its beginning is used.
- For long speech, use InfiniteTalk instead.

## See also
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Lesson: A talking video: InfiniteTalk](Wrapper-Talk.md)
