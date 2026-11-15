[Русский](Wrapper-Duo.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Two people talking: InfiniteTalk

<!-- lesson: wrapper-duo -->
Lesson "wrapper-duo", in the group **WanVideoWrapper** of the lesson list. Steps: 8.

## Consent first
The rule is the same: only those who agree may be voiced, with their own voices or voices you have permission for. See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
Two people in one picture speak, each with their own voice.

## What you need
- It goes on from [A talking video: InfiniteTalk](Wrapper-Talk.md). The card says so; it is a hint, not a lock.
- Model files the lesson checks:
  - a module for several speakers (InfiniteTalk multi or MultiTalk): `models/diffusion_models`, for example `Wan2_1-InfiniteTalk_Multi_fp8_e4m3fn_scaled_KJ.safetensors`.
- Nodes: Multi/InfiniteTalk Model Loader, Load Audio, Multi/InfiniteTalk Wav2vec2 Embeds, WanVideo Sampler.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Two voices in one frame** (reading)

   InfiniteTalk and MultiTalk can voice two people at once. You need a picture with two people and two voice recordings. The model moves the lips of each to their own recording.

   The rule is the same: only those who agree may be voiced, with their own voices or voices you have permission for.

   The lesson continues the graph of the lesson "A talking video: InfiniteTalk".

2. **The graph of a talking video is needed**

   The canvas must hold the graph of the lesson "A talking video: InfiniteTalk": the nodes **Multi/InfiniteTalk Model Loader**, **Load Audio**, **Multi/InfiniteTalk Wav2vec2 Embeds** and **WanVideo Sampler**, with the sound connected to the input `audio_1`.

   If it is not there, do that lesson first.

3. **Check the module**

   The field `model` of **Multi/InfiniteTalk Model Loader** must hold a module for several speakers. For InfiniteTalk the name of such a file has the word multi in it; MultiTalk has one module for every case.

   The single module is made for one person.

4. **Choose the picture** (reading)

   In the node with the portrait choose a frame where both people are seen large and stand side by side: one in the left half, the other in the right.

   This matters. Unless told otherwise, the first voice goes to whoever is on the left and the second to whoever is on the right.

5. **Add the second voice**

   Add one more node **Load Audio** and choose in the field `audio` the recording of the second person, not the same as the first. Connect its output to the input `audio_2` of **Multi/InfiniteTalk Wav2vec2 Embeds**.

6. **Together or in turn** (reading)

   The field `multi_audio_type` of **Multi/InfiniteTalk Wav2vec2 Embeds** says how the two recordings are put together:
   - `para`: both sound at once, from the start of the clip. It fits when each recording already has pauses for the time the other one speaks;
   - `add`: the first recording whole, then the second. It fits two separate lines.

7. **Who speaks with which voice** (reading)

   The voice from the input `audio_1` goes to the person in the left half of the frame, from the input `audio_2` to the one in the right. If the voices are swapped, swap the recordings.

   When people stand otherwise, masks are needed: one per person, to the input `ref_target_masks`. A mask is drawn in ComfyUI's mask editor.

   The inputs `audio_3` and `audio_4` are for a third and a fourth speaker. They must have masks: the node itself splits the frame only in two.

8. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   While you are choosing the recordings and the picture, take lines a few seconds long.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The graph of a talking video is needed**:
  - a **Multi/InfiniteTalk Model Loader** node.
  - a **Load Audio** node.
  - a **Multi/InfiniteTalk Wav2vec2 Embeds** node.
  - a **WanVideo Sampler** node.
  - `AUDIO` of **Load Audio** (first voice) into `audio_1` of **Multi/InfiniteTalk Wav2vec2 Embeds**.
  - `multitalk_embeds` of **Multi/InfiniteTalk Wav2vec2 Embeds** into `multitalk_embeds` of **WanVideo Sampler**.
- Step 3, **Check the module**:
  - `model` of **Multi/InfiniteTalk Model Loader** holds a module for several speakers (InfiniteTalk multi or MultiTalk); such a file lies in `models/diffusion_models`, for example `Wan2_1-InfiniteTalk_Multi_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 5, **Add the second voice**:
  - a **Load Audio** node.
  - `AUDIO` of **Load Audio** (second voice) into `audio_2` of **Multi/InfiniteTalk Wav2vec2 Embeds**.
  - `audio` of **Load Audio** (second voice) is not the same file as `audio` of **Load Audio** (first voice).

## Mistakes people make
- The single module: only one face moves.
- Swapped voices: swap the recordings, or use masks.
- Long recordings while tuning: take lines a few seconds long.

## See also
- [Content rules](../trust/Content-Rules.md)
- [How lessons work](How-Lessons-Work.md)
- [Talking portraits](../concepts/Talking-Portraits.md)
- [Inpainting and masks](../concepts/Inpainting.md)
