[Русский](Wrapper-Ovi.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A video with sound: Ovi

<!-- lesson: wrapper-ovi -->
Lesson "wrapper-ovi", in the group **WanVideoWrapper** of the lesson list. Steps: 16.

## Consent first
The rule stays: do not put words into the mouths of real people without their consent. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
One run draws the clip and its sound at once: the character's speech, steps, street noise.

## What you need
- Model files the lesson checks:
  - the Ovi video model: `models/diffusion_models`, for example `Wan2_2-Ovi-960x960-10s_fp8_e4m3fn_scaled_KJ.safetensors`;
  - the Ovi audio model: `models/diffusion_models`, for example `Wan2_2-Ovi-audio_model_bf16.safetensors`;
  - the umt5-xxl text encoder of Wan: `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`;
  - the Wan 2.2 VAE (Wan2_2_VAE): `models/vae`, for example `Wan2_2_VAE_bf16.safetensors`;
  - the MMAudio VAE: `models/mmaudio`, for example `mmaudio_vae_16k_fp32.safetensors`;
  - the MMAudio vocoder: `models/mmaudio`, for example `mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors`.
- Nodes: WanVideo Model Loader, WanVideo Extra Model Select, WanVideo T5 Text Encoder Loader, WanVideo VAE Loader, WanVideo TextEncode, WanVideo Ovi CFG, WanVideo Empty Embeds, WanVideo Empty MMAudio Latents, WanVideo Sampler, WanVideo Decode, Ovi MMAudio VAE Loader, WanVideo Decode Ovi Audio, Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **What Ovi does** (reading)

   Ovi is two models working together: one draws the clip, the other makes its sound at the same time. You write the character's speech right in the prompt, and the lips match the words.

   The clip always has one length: 121 frames, which is five seconds at 24 frames a second.

   The model makes the voice up itself. The rule stays: do not put words into the mouths of real people without their consent.

   The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the two models**

   Add the nodes **WanVideo Model Loader** and **WanVideo Extra Model Select**.
   - In **WanVideo Model Loader** choose in the field `model` the Ovi video model.
   - In **WanVideo Extra Model Select** choose in the field `extra_model` the Ovi audio model. It is another file.
   - Connect the output of **WanVideo Extra Model Select** to the input `extra_model` of **WanVideo Model Loader**.
   - In **WanVideo Model Loader** leave the field `base_precision` at `bf16`. With `fp16` this model may give a black screen.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the Ovi example graph from the `example_workflows` folder of the WanVideoWrapper pack: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **The text reader and the VAE**

   Add the nodes **WanVideo T5 Text Encoder Loader** and **WanVideo VAE Loader**. In the field `model_name` of the first choose the file `umt5-xxl-enc`. The second needs the VAE of Wan 2.2, the file `Wan2_2_VAE`: the VAE of Wan 2.1 does not fit here.

4. **Describe the frame**

   Add the node **WanVideo TextEncode** and connect the output of **WanVideo T5 Text Encoder Loader** to its input `t5`. In the field `positive_prompt` say in English who is in the frame, where, and what they do.

5. **Write the speech in**

   The words the character says go into the field `positive_prompt` between the marks `<S>` and `<E>`. For example: A man in a kitchen says `<S>Good morning, the coffee is ready.<E>`

   Without these marks Ovi does not work.

   What else is heard in the clip may be described between `<AUDCAP>` and `<ENDAUDCAP>`: a voice, noise, music. This is optional.

6. **Connect the sound setting**

   Add the node **WanVideo Ovi CFG** and connect the output of **WanVideo TextEncode** to its input `original_text_embeds`.

   Leave the field `ovi_audio_cfg` at 3. It says how strictly the sound follows the prompt.

7. **Say what the sound must not be**

   Add a second node **WanVideo TextEncode** and connect the output of **WanVideo T5 Text Encoder Loader** to its input `t5`. In its field `positive_prompt` write what the sound must not have: robotic, muffled, echo, distorted.

   Connect the output of this node to the input `ovi_negative_text_embeds` of **WanVideo Ovi CFG**.

   This is no mistake: the words go into the upper field, and **WanVideo Ovi CFG** takes exactly that one. If this node is not connected, the prompt itself stands in for it, and the setting `ovi_audio_cfg` nearly stops acting.

8. **Set the size and the length**

   Add the node **WanVideo Empty Embeds**. Set the field `num_frames` to 121: Ovi is not made for another length.

   Set the fields `width` and `height` to 992 and 512 for a horizontal clip.

9. **Add the blank sound**

   Add the node **WanVideo Empty MMAudio Latents** and leave its field `length` at 157. It is the length of sound for a clip of 121 frames.

   Out of this blank the model makes the sound, the way it makes the clip out of noise.

10. **Add the sampler**

   Add the node **WanVideo Sampler** and connect to it:
   - the model to the input `model`;
   - the output of **WanVideo Ovi CFG**, not of **WanVideo TextEncode**, to the input `text_embeds`;
   - the output of **WanVideo Empty Embeds** to the input `image_embeds`;
   - the output of **WanVideo Empty MMAudio Latents** to the input `samples`.

   Set `steps` to 50 and `cfg` to 4.

11. **Turn the result into frames**

   Add the node **WanVideo Decode**. Connect the output of the sampler to its input `samples`, and the output of **WanVideo VAE Loader** to the input `vae`.

12. **Turn the result into sound**

   Add the nodes **Ovi MMAudio VAE Loader** and **WanVideo Decode Ovi Audio**.
   - In **Ovi MMAudio VAE Loader** choose in the field `vae` the file `mmaudio_vae`, and in the field `vocoder` the file `mmaudio_vocoder`. They are two different files.
   - Connect its output to the input `mmaudio_vae` of **WanVideo Decode Ovi Audio**.
   - Connect the output of the sampler to the input `samples` of **WanVideo Decode Ovi Audio**, the same output that goes into **WanVideo Decode**.

13. **Assemble the clip with its sound**

   Add the nodes **Create Video** and **Save Video**. Connect the frames to the input `images`, the output of **WanVideo Decode Ovi Audio** to the input `audio`, and the clip to the input `video`. Set the field `fps` to 24.

14. **If the clip should start from a picture** (reading)

   Ovi can start a clip from your picture. It is loaded, brought to the size of the clip and turned into the compressed form by the node WanVideo Encode. The output of that node goes to the input `extra_latents` of **WanVideo Empty Embeds**.

   The lesson does not check this step: the graph works without a picture too.

15. **If the sound or the speech did not come out** (reading)

   What to check:
   - the character is not heard: the words must stand between `<S>` and `<E>`, preferably in English;
   - the speech is cut off: five seconds hold one or two short phrases;
   - the sound is dull or echoes: add what you hear to **WanVideo TextEncode**: muffled, echo, noise;
   - a black screen: check `base_precision`, it must be `bf16`.

16. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   Ovi takes long: 50 steps for two models at once. For a trial set 30.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the two models**:
  - a **WanVideo Model Loader** node.
  - a **WanVideo Extra Model Select** node.
  - `extra_model` of **WanVideo Extra Model Select** into `extra_model` of **WanVideo Model Loader**.
  - `model` of **WanVideo Model Loader** holds the Ovi video model; such a file lies in `models/diffusion_models`, for example `Wan2_2-Ovi-960x960-10s_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `extra_model` of **WanVideo Extra Model Select** is not the same file as `model` of **WanVideo Model Loader**.
  - `extra_model` of **WanVideo Extra Model Select** holds the Ovi audio model; such a file lies in `models/diffusion_models`, for example `Wan2_2-Ovi-audio_model_bf16.safetensors`.
  - `base_precision` of **WanVideo Model Loader** is `bf16`. Why: with `fp16` this model can give a black screen.
- Step 3, **The text reader and the VAE**:
  - a **WanVideo T5 Text Encoder Loader** node.
  - a **WanVideo VAE Loader** node.
  - `model_name` of **WanVideo T5 Text Encoder Loader** holds the umt5-xxl text encoder of Wan; such a file lies in `models/text_encoders`, for example `umt5_xxl_fp8_e4m3fn_scaled.safetensors`.
  - `model_name` of **WanVideo VAE Loader** holds the Wan 2.2 VAE (Wan2_2_VAE); such a file lies in `models/vae`, for example `Wan2_2_VAE_bf16.safetensors`.
- Step 4, **Describe the frame**:
  - a **WanVideo TextEncode** node.
  - `wan_t5_model` of **WanVideo T5 Text Encoder Loader** into `t5` of **WanVideo TextEncode** (prompt).
  - `positive_prompt` of **WanVideo TextEncode** (prompt) holds at least 3 characters and 2 real words.
- Step 5, **Write the speech in**:
  - `positive_prompt` of **WanVideo TextEncode** (prompt) holds at least 3 characters, with `<S>` and `<E>`.
- Step 6, **Connect the sound setting**:
  - a **WanVideo Ovi CFG** node.
  - `text_embeds` of **WanVideo TextEncode** (prompt) into `original_text_embeds` of **WanVideo Ovi CFG**.
  - `ovi_audio_cfg` of **WanVideo Ovi CFG** is from 2 to 4; **Do this for me** sets 3. Why: this is how strictly the sound follows the prompt. 3 gives sound without distortion.
- Step 7, **Say what the sound must not be**:
  - a **WanVideo TextEncode** node.
  - `wan_t5_model` of **WanVideo T5 Text Encoder Loader** into `t5` of **WanVideo TextEncode** (what the sound must not be).
  - `text_embeds` of **WanVideo TextEncode** (what the sound must not be) into `ovi_negative_text_embeds` of **WanVideo Ovi CFG**.
  - `positive_prompt` of **WanVideo TextEncode** (what the sound must not be) holds at least 3 characters.
- Step 8, **Set the size and the length**:
  - a **WanVideo Empty Embeds** node.
  - `num_frames` of **WanVideo Empty Embeds** is `121`. Why: ovi is made for exactly 121 frames, five seconds.
- Step 9, **Add the blank sound**:
  - a **WanVideo Empty MMAudio Latents** node.
  - `length` of **WanVideo Empty MMAudio Latents** is `157`. Why: this is the length of the sound for a clip of 121 frames.
- Step 10, **Add the sampler**:
  - a **WanVideo Sampler** node.
  - `model` of **WanVideo Model Loader** into `model` of **WanVideo Sampler**.
  - `text_embeds` of **WanVideo Ovi CFG** into `text_embeds` of **WanVideo Sampler**.
  - `WANVIDIMAGE_EMBEDS` of **WanVideo Empty Embeds** into `image_embeds` of **WanVideo Sampler**.
  - `samples` of **WanVideo Empty MMAudio Latents** into `samples` of **WanVideo Sampler**.
  - `steps` of **WanVideo Sampler** is from 30 to 50; **Do this for me** sets 50. Why: ovi works out the sound and the picture together and needs 50 steps for it.
  - `cfg` of **WanVideo Sampler** is from 3 to 5; **Do this for me** sets 4. Why: the Ovi example uses cfg 4: higher burns the clip, lower follows the prompt worse.
- Step 11, **Turn the result into frames**:
  - a **WanVideo Decode** node.
  - `samples` of **WanVideo Sampler** into `samples` of **WanVideo Decode**.
  - `vae` of **WanVideo VAE Loader** into `vae` of **WanVideo Decode**.
- Step 12, **Turn the result into sound**:
  - a **Ovi MMAudio VAE Loader** node.
  - a **WanVideo Decode Ovi Audio** node.
  - `mmaudio_vae` of **Ovi MMAudio VAE Loader** into `mmaudio_vae` of **WanVideo Decode Ovi Audio**.
  - `samples` of **WanVideo Sampler** into `samples` of **WanVideo Decode Ovi Audio**.
  - `vae` of **Ovi MMAudio VAE Loader** holds the MMAudio VAE; such a file lies in `models/mmaudio`, for example `mmaudio_vae_16k_fp32.safetensors`.
  - `vocoder` of **Ovi MMAudio VAE Loader** holds the MMAudio vocoder; such a file lies in `models/mmaudio`, for example `mmaudio_vocoder_bigvgan_best_netG_fp32.safetensors`.
- Step 13, **Assemble the clip with its sound**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **WanVideo Decode** into `images` of **Create Video**.
  - `audio` of **WanVideo Decode Ovi Audio** into `audio` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `24`. Why: ovi makes a clip at 24 frames per second, and its sound is made for them.

## Mistakes people make
- Writing the unwanted sound into `negative_prompt` of the second node: the Ovi node reads its positive field.
- Too much speech for five seconds: one or two short phrases fit.
- `fp16` precision: a black screen.

## See also
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
- [Audio](../concepts/Audio.md)
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Video models](../concepts/Video-Models.md)
