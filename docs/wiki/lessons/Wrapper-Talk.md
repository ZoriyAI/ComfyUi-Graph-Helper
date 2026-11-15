[Русский](Wrapper-Talk.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A talking video: InfiniteTalk

<!-- lesson: wrapper-talk -->
Lesson "wrapper-talk", in the group **WanVideoWrapper** of the lesson list. Steps: 15.

## Consent first
Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
A portrait says the words of a sound file, the lips in time with them.

## What you need
- Model files the lesson checks:
  - Wan 2.1 image to video (i2v) 14B: `models/diffusion_models`, for example `wan2.1_i2v_480p_14B_fp8_scaled.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.1 VAE (wan_2.1_vae): `models/vae`, for example `wan_2.1_vae.safetensors`;
  - clip_vision_h: `models/clip_vision`, for example `clip_vision_h.safetensors`;
  - an InfiniteTalk or MultiTalk module: `models/diffusion_models`, for example `Wan2_1-InfiniteTalk_Single_fp8_e4m3fn_scaled_KJ.safetensors`;
  - a wav2vec speech model: `models/wav2vec2`, for example `chinese-wav2vec2-base-fp16.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, Load Image, Load CLIP Vision, WanVideo ClipVision Encode, Multi/InfiniteTalk Model Loader, Load Audio, Wav2vec2 Model Loader, Multi/InfiniteTalk Wav2vec2 Embeds, WanVideo Long I2V Multi/InfiniteTalk, WanVideo Sampler, WanVideo Decode, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What InfiniteTalk does** (reading)

   InfiniteTalk gives the Wan 2.1 "image to video" model the ability to listen to sound. You give a portrait and a voice recording, and the model draws the person of the portrait saying those words. The sound goes into the clip as its track.

   Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law.

   This graph runs on one Wan 2.1 model, not on the Wan 2.2 pair. The lesson builds it from an empty canvas: "File ▸ New project".

2. **Load the model**

   Add a **WanVideo Model Loader** node and choose the Wan 2.1 `i2v` 14B model in its `model` field, preferably the 480p one.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the InfiniteTalk example graph from the `example_workflows` folder of the WanVideoWrapper pack: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text reader and the VAE**

   Add **WanVideo T5 Text Encoder Loader** and **WanVideo VAE Loader**. In the `model_name` field of the first choose the `umt5-xxl-enc` file, in the second the `wan_2.1_vae` file.

4. **Describe the frame briefly**

   Add a **WanVideo TextEncode** node and connect the output of **WanVideo T5 Text Encoder Loader** to its `t5` input. In `positive_prompt` describe who speaks and how: calmly, smiling, gesturing.

   What exactly is said the model takes from the sound, not from the text.

5. **Load the portrait**

   Add a **Load Image** node and choose the portrait in its `image` field. A face in close-up, from the front, with the mouth closed or slightly open, works best.

6. **Show the portrait to the model**

   Add **Load CLIP Vision** and **WanVideo ClipVision Encode**. In the `clip_name` field of the first choose the `clip_vision_h` file. Connect its output to the `clip_vision` input of the second, and the portrait to `image_1`.

   The Wan 2.1 "image to video" models cannot do without it.

7. **Add the InfiniteTalk module**

   Add a **Multi/InfiniteTalk Model Loader** node and choose the InfiniteTalk module file in its `model` field. Connect its output to the `multitalk_model` input of the model loader.

   For one speaker the single module is taken, for two the multi one.

8. **Load the voice**

   Add three nodes: **Load Audio**, **Wav2vec2 Model Loader** and **Multi/InfiniteTalk Wav2vec2 Embeds**.
   - In **Load Audio** choose the sound file from the `input` folder in the `audio` field.
   - In **Wav2vec2 Model Loader** choose the wav2vec speech model in the `model` field, usually chinese-wav2vec2-base. It lies in the `wav2vec2` folder.
   - The `wav2vec_model` output to the `wav2vec_model` input of **Multi/InfiniteTalk Wav2vec2 Embeds**, the sound to `audio_1`.

   Leave `fps` at 25 in **Multi/InfiniteTalk Wav2vec2 Embeds**: InfiniteTalk draws 25 frames a second.

9. **Prepare the start**

   Add a **WanVideo Long I2V Multi/InfiniteTalk** node. Connect the output of **WanVideo VAE Loader** to its `vae` input, the portrait to `start_image`, and the output of **WanVideo ClipVision Encode** to `clip_embeds`.

   This node makes a long clip in pieces and stitches them, so it can speak for longer than five seconds.

10. **Add the sampler**

   Add a **WanVideo Sampler** node and connect to it:
   - to `model`, the model;
   - to `text_embeds`, the prompt;
   - to `image_embeds`, the output of **WanVideo Long I2V Multi/InfiniteTalk**;
   - to `multitalk_embeds`, the `multitalk_embeds` output of **Multi/InfiniteTalk Wav2vec2 Embeds**.

11. **Turn the result into frames**

   Add a **WanVideo Decode** node. Connect the sampler's output to its `samples` input and the output of **WanVideo VAE Loader** to its `vae` input.

12. **Make the clip**

   Add **Create Video** and **Save Video**, the frames into `images`, the clip into `video`. Set `fps` to 25, as for the sound.

13. **Put the sound into the clip**

   Connect the `audio` output of **Multi/InfiniteTalk Wav2vec2 Embeds** to the `audio` input of **Create Video**.

   Without it the clip is saved silent, though the lips move.

14. **When the lips miss the words** (reading)

   What to change in **Multi/InfiniteTalk Wav2vec2 Embeds**:
   - the lips move too little: raise `audio_scale` to 1.2;
   - the face is frozen and only the lips move: set `audio_cfg_scale` to 2, the clip takes longer to make;
   - the length of the clip: the node counts the frames from the length of the sound itself.

   A clean recording of a voice, with no music or noise, works much better.

15. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   A minute of speech takes long to make. While you look for the settings, take a piece of five to ten seconds.

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
- Step 7, **Add the InfiniteTalk module**:
  - a **Multi/InfiniteTalk Model Loader** node.
  - `model` of **Multi/InfiniteTalk Model Loader** into `multitalk_model` of **WanVideo Model Loader**.
  - `model` of **Multi/InfiniteTalk Model Loader** holds an InfiniteTalk or MultiTalk module; such a file lies in `models/diffusion_models`, for example `Wan2_1-InfiniteTalk_Single_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 8, **Load the voice**:
  - a **Load Audio** node.
  - a **Wav2vec2 Model Loader** node.
  - a **Multi/InfiniteTalk Wav2vec2 Embeds** node.
  - `wav2vec_model` of **Wav2vec2 Model Loader** into `wav2vec_model` of **Multi/InfiniteTalk Wav2vec2 Embeds**.
  - `AUDIO` of **Load Audio** into `audio_1` of **Multi/InfiniteTalk Wav2vec2 Embeds**.
  - `audio` of **Load Audio**: a value is chosen.
  - `model` of **Wav2vec2 Model Loader** holds a wav2vec speech model; such a file lies in `models/wav2vec2`, for example `chinese-wav2vec2-base-fp16.safetensors`.
  - `fps` of **Multi/InfiniteTalk Wav2vec2 Embeds** is `25`. Why: infiniteTalk draws 25 frames per second, and the sound is laid out on the same 25.
- Step 9, **Prepare the start**:
  - a **WanVideo Long I2V Multi/InfiniteTalk** node.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Long I2V Multi/InfiniteTalk**.
  - `IMAGE` of **Load Image** into `start_image` of **WanVideo Long I2V Multi/InfiniteTalk**.
  - `WANVIDIMAGE_CLIPEMBEDS` of **WanVideo ClipVision Encode** into `clip_embeds` of **WanVideo Long I2V Multi/InfiniteTalk**.
- Step 10, **Add the sampler**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** into `model` of **WanVideo Sampler**.
  - `text_embeds` of **WanVideo TextEncode** into `text_embeds` of **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` of **WanVideo Long I2V Multi/InfiniteTalk** into `image_embeds` of **WanVideo Sampler**.
  - `multitalk_embeds` of **Multi/InfiniteTalk Wav2vec2 Embeds** into `multitalk_embeds` of **WanVideo Sampler**.
- Step 11, **Turn the result into frames**:
  - a **WanVideo Decode** node.
  - `samples` of **WanVideo Sampler** into `samples` of **WanVideo Decode**.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Decode**.
- Step 12, **Make the clip**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **WanVideo Decode** into `images` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `25`. Why: infiniteTalk draws 25 frames per second, and the sound is laid out on the same 25.
- Step 13, **Put the sound into the clip**:
  - `audio` of **Multi/InfiniteTalk Wav2vec2 Embeds** into `audio` of **Create Video**.

## Mistakes people make
- Music or noise under the voice: poor lip sync.
- `fps` 16 (the Wan default) instead of 25: the lips drift.
- Forgetting the sound link: a silent clip with moving lips.

## What next
These lessons go on from this one: [Two people talking: InfiniteTalk](Wrapper-Duo.md).

## See also
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Audio](../concepts/Audio.md)
