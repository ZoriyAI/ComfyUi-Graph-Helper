[Русский](Video-Speech.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A portrait that speaks: HuMo

<!-- lesson: video-speech -->
Lesson "video-speech", in the group **Video** of the lesson list. Steps: 16.

## Consent first
Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
A person from an image says the words of a sound file, with ComfyUI's own nodes, no pack.

## What you need
- It goes on from [Video from a picture](Video-Image.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - for `unet_name` of **Load Diffusion Model**: a file whose name has `humo`;
  - for `lora_name` of **LoraLoaderModelOnly**: a file whose name has `lightx2v`;
  - for `clip_name` of **Load CLIP**: a file whose name has `umt5`;
  - for `vae_name` of **Load VAE**: a file whose name has `wan_2.1_vae`;
  - for `audio_encoder_name` of **Audio Encoder Loader**: a file whose name has `whisper`.
- Nodes: Load Diffusion Model, LoraLoaderModelOnly, ModelSamplingSD3, Load CLIP, Load VAE, CLIP Text Encode (Prompt), Load Audio, Audio Encoder Loader, Audio Encoder Encode, Load Image, WanHuMoImageToVideo, KSampler, VAE Decode / VAE Decode (Tiled), Create Video, Save Video.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Before you start** (reading)

   Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law. For adult (18+) use, obtain consent and follow local law. Exclude anyone under 18 or who appears underage; label synthetic depictions so they do not mislead others. The lessons teach technique in factual, non-graphic terms.

   HuMo draws a person from a reference image and moves the lips with the sound. The sound goes into the clip as its track.

   What it costs: the HuMo 17B model, about 17 GB in `fp8`, in `models/diffusion_models`; the lightx2v speed-up LoRA in `models/loras`; the Whisper audio encoder in `models/audio_encoders`; `umt5_xxl` and `wan_2.1_vae`. Plan on a card with 16 GB or more, or a long run with parts moved to system memory. The clip is about four seconds.

   If the canvas already holds another graph, start from an empty one: "File ▸ New project".

2. **Load the model**

   Add a **Load Diffusion Model** node and choose the `humo_17B` file in `unet_name`.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the "HuMo Video Generation" template: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

3. **Add the speed-up LoRA**

   Add a **LoraLoaderModelOnly** node and connect the `MODEL` output of **Load Diffusion Model** to its `model` input. Choose the `lightx2v` file in `lora_name` and leave `strength_model` at 1.

   With it, 6 steps and `cfg` 1 are enough, as in the template; without it the model needs far more steps.

4. **Set the shift**

   Add a **ModelSamplingSD3** node and connect the output of **LoraLoaderModelOnly** to its `model` input. Set `shift` to 8.

5. **Load the text encoder**

   Add a **Load CLIP** node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.

   The text encoder turns the prompt into what the model reads. The `fp8` version of the file takes half the memory of the full one and is what the templates use.

6. **Load the VAE**

   Add a **Load VAE** node and choose `wan_2.1_vae` in `vae_name`. HuMo is built on Wan 2.1 and uses its VAE.

7. **Describe the scene**

   Add two **CLIP Text Encode (Prompt)** nodes and connect the `CLIP` output of **Load CLIP** to the `clip` input of each. In the `text` field of one, describe who speaks, where and how: calmly, smiling, looking at the camera. What is said comes from the sound, not from the prompt.

8. **Load the voice**

   Add three nodes: **Load Audio**, **Audio Encoder Loader** and **Audio Encoder Encode**.
   - In **Load Audio** choose the sound file from the `input` folder.
   - In `audio_encoder_name` of **Audio Encoder Loader** choose the Whisper file (`whisper_large_v3`).
   - Connect the output of **Audio Encoder Loader** to the `audio_encoder` input of **Audio Encoder Encode**, and the sound to its `audio` input.

   A clean recording of one voice, without music, works best.

9. **Load the portrait**

   Add a **Load Image** node and choose the image of the person in `image`. A face seen from the front, well lit, mouth closed or slightly open.

10. **Bring it together**

   Add a **WanHuMoImageToVideo** node and connect to it the two prompts, the VAE, the output of **Audio Encoder Encode** to `audio_encoder_output` and the portrait to `ref_image`.

   Set `width` and `height` to 640 and `length` to 97: at 25 fps that is about four seconds.

11. **Add the sampler**

   Add a **KSampler** node. Its `model` input takes the output of **ModelSamplingSD3**; `positive`, `negative` and `latent_image` take the three outputs of **WanHuMoImageToVideo**.

12. **Set up the sampler**

   Set `steps` to 6 and `cfg` to 1. The speed-up LoRA is made for these numbers; a higher `cfg` with it burns the picture.

13. **Turn the result into frames**

   Add a **VAE Decode** node. Connect the sampler's output to its `samples` input and the output of **Load VAE** to its `vae` input.

   The sampler gives the clip in compressed form, the latent. This node unfolds it into frames.

14. **Make the clip with its sound**

   Add **Create Video** and **Save Video**. The frames go into `images`, the output of **Load Audio** into `audio`, and the clip into the `video` input of **Save Video**. Set `fps` to 25.

   HuMo draws 25 fps; with another number the lips miss the words.

15. **When the lips miss the words** (reading)

   - The sound is longer than the clip: only the first four seconds are spoken. Cut the sound or make the clip longer, 97 frames per four seconds.
   - The face changes: use a sharper portrait, closer to the camera.
   - The mouth barely moves: the voice is quiet or has music under it.

16. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the model**:
  - a **Load Diffusion Model** node.
  - `unet_name` of **Load Diffusion Model** holds a file whose name has `humo` (capitals, dots and dashes do not matter).
- Step 3, **Add the speed-up LoRA**:
  - a **LoraLoaderModelOnly** node.
  - `MODEL` of **Load Diffusion Model** into `model` of **LoraLoaderModelOnly**.
  - `lora_name` of **LoraLoaderModelOnly** holds a file whose name has `lightx2v` (capitals, dots and dashes do not matter).
  - `strength_model` of **LoraLoaderModelOnly** is from 0.5 to 1; **Do this for me** sets 1.
- Step 4, **Set the shift**:
  - a **ModelSamplingSD3** node.
  - `MODEL` of **LoraLoaderModelOnly** into `model` of **ModelSamplingSD3** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `shift` of **ModelSamplingSD3** is from 5 to 8; **Do this for me** sets 8.
- Step 5, **Load the text encoder**:
  - a **Load CLIP** node.
  - `clip_name` of **Load CLIP** holds a file whose name has `umt5` (capitals, dots and dashes do not matter).
  - `type` of **Load CLIP** is `wan`.
- Step 6, **Load the VAE**:
  - a **Load VAE** node.
  - `vae_name` of **Load VAE** holds a file whose name has `wan_2.1_vae` (capitals, dots and dashes do not matter).
- Step 7, **Describe the scene**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **CLIP Text Encode (Prompt)** node.
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (prompt).
  - `CLIP` of **Load CLIP** into `clip` of **CLIP Text Encode (Prompt)** (negative prompt).
  - `text` of **CLIP Text Encode (Prompt)** (prompt) holds at least 3 characters.
- Step 8, **Load the voice**:
  - a **Load Audio** node.
  - a **Audio Encoder Loader** node.
  - a **Audio Encoder Encode** node.
  - `AUDIO_ENCODER` of **Audio Encoder Loader** into `audio_encoder` of **Audio Encoder Encode**.
  - `AUDIO` of **Load Audio** into `audio` of **Audio Encoder Encode**.
  - `audio` of **Load Audio**: a value is chosen.
  - `audio_encoder_name` of **Audio Encoder Loader** holds a file whose name has `whisper` (capitals, dots and dashes do not matter).
- Step 9, **Load the portrait**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 10, **Bring it together**:
  - a **WanHuMoImageToVideo** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (prompt) into `positive` of **WanHuMoImageToVideo**.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** (negative prompt) into `negative` of **WanHuMoImageToVideo**.
  - `VAE` of **Load VAE** into `vae` of **WanHuMoImageToVideo**.
  - `AUDIO_ENCODER_OUTPUT` of **Audio Encoder Encode** into `audio_encoder_output` of **WanHuMoImageToVideo**.
  - `IMAGE` of **Load Image** into `ref_image` of **WanHuMoImageToVideo** (a Upscale Image or Upscale Image By or ImageFromBatch or ImageResizeKJv2 or Resize Image or GetImageRangeFromBatch or ResizeImageMaskNode in between is accepted).
  - `width` of **WanHuMoImageToVideo** is from 480 to 1280; **Do this for me** sets 640.
  - `height` of **WanHuMoImageToVideo** is from 480 to 1280; **Do this for me** sets 640.
  - `length` of **WanHuMoImageToVideo** is from 25 to 97; **Do this for me** sets 97.
- Step 11, **Add the sampler**:
  - a **KSampler** node.
  - `MODEL` of **ModelSamplingSD3** into `model` of **KSampler** (a LoraLoaderModelOnly or EasyCache in between is accepted).
  - `positive` of **WanHuMoImageToVideo** into `positive` of **KSampler**.
  - `negative` of **WanHuMoImageToVideo** into `negative` of **KSampler**.
  - `latent` of **WanHuMoImageToVideo** into `latent_image` of **KSampler**.
- Step 12, **Set up the sampler**:
  - `steps` of **KSampler** is from 4 to 10; **Do this for me** sets 6.
  - `cfg` of **KSampler** is `1`.
- Step 13, **Turn the result into frames**:
  - a **VAE Decode** or **VAE Decode (Tiled)** node.
  - `LATENT` of **KSampler** into `samples` of **VAE Decode** or **VAE Decode (Tiled)**.
  - `VAE` of **Load VAE** into `vae` of **VAE Decode** or **VAE Decode (Tiled)**.
- Step 14, **Make the clip with its sound**:
  - a **Create Video** node.
  - a **Save Video** node.
  - `IMAGE` of **VAE Decode** or **VAE Decode (Tiled)** into `images` of **Create Video**.
  - `AUDIO` of **Load Audio** into `audio` of **Create Video**.
  - `VIDEO` of **Create Video** into `video` of **Save Video**.
  - `fps` of **Create Video** is `25`.

## See also
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Audio](../concepts/Audio.md)
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
