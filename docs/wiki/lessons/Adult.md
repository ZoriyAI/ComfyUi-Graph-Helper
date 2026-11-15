[Русский](Adult.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Video for adults: what changes

<!-- lesson: adult -->
Lesson "adult", in the group **For adults (18+)**, the last group of the list. Steps: 12. This page gives the technique in general words.

## A closed group until you open it
The group is open only while the switch **Adult content (18+)** in **Settings ▸ Privacy** is on. It is off in a new profile. While it is off, the list shows the group as one row with a lock, the text "Lessons about adult content: pictures, LoRAs and video. They open with the switch “Adult content (18+)” in Settings ▸ Privacy." and the button **Open the setting**. Turning the switch on first asks **Turn on adult content?** and shows the rules; **I am 18 or older** turns it on, **Leave it off** does not.

A lesson of this group is never offered as the next lesson after an ordinary one, and an ordinary one never after it.

## The rules come first
The first step, **First, the rules**, shows the content rules of the app, the same words as Help ▸ Content rules:

> Adults (18+) may make any lawful adult content with the consent of everyone involved, and the app explains the technique. Keep these out of your work:
> - minors and anyone who looks like a minor, drawn characters included;
> - real people in explicit content; use a person's face or voice only with their consent;
> - sexual violence and coercion;
> - animals in explicit content;
> - anything the law forbids where you live.
>
> What you make and where you post it is your responsibility: the laws of your country and the rules of the sites.

See [Content rules](../trust/Content-Rules.md).

## What you will be able to do
You learn what the content of a clip depends on and check your graph.

## What you need
- The graph of [Video from text](Video-Text.md) or [Video from a picture](Video-Image.md).
- A further-trained Wan 2.2 pair or a LoRA of your choice, already in your ComfyUI.
- The app downloads nothing.

## The steps
1. **First, the rules** (reading): the content rules of the app, in full (quoted above).
2. **The technique is the same** (reading): the graph is the one of the video lessons; what ends up in the frame is decided by the model, the LoRA and the prompt.
3. **What the model can do** (reading): most open models draw such scenes poorly; a further-trained version or a LoRA for the subject fixes that. Either must fit the model: `t2v` and `i2v` files differ, and the size must match (14B with 14B, 5B with 5B). Many Wan 2.1 14B LoRAs, the common four-step speed-up ones among them, also work on Wan 2.2 14B.
4. **A video graph is needed**: the video graph of "Video from text" or "Video from a picture" must be on the canvas.
5. **If you take a further-trained model** (reading): a further-trained Wan 2.2 usually comes as a pair of files for the two passes; one with the speed-up built in (`light`, `fast` or `4steps` in its name) takes the settings of "Fast video in four steps".
6. **If you take a LoRA** (reading): a LoRA goes into the path of both models; how is shown in "LoRA: add a style or a subject".
7. **LoRAs for the two passes** (reading): the `high` file of a pair goes into the first pass, the `low` file into the second; a single file goes into both. A speed-up LoRA and a subject LoRA stand in one chain; tune the subject LoRA on one `noise_seed` in steps of 0.1 to 0.2.
8. **The anchor picture and a LoRA** (reading): in a clip from a picture the looks come from the start picture; a picture model's LoRA does not fit Wan. See "The start picture is the anchor" and "A reference for the whole clip: Wan VACE".
9. **How to write the prompt** (reading): describe the scene in plain words and in order: who, what happens, where, the camera, the light; say plainly that the people in the frame are adults. The second text lists defects.
10. **The LoRA's words in the prompt**: the trigger words of a LoRA on the canvas go into the prompt.
11. **If the result is poor** (reading): what to change and in what order: the LoRA strength or the length, the words and the file, `cfg` 1 with a speed-up, a calmer motion at `fps` 16, then the seed.
12. **About the assistant in the app** (reading): lessons need no assistant; a question in Ask goes to the model you chose, which answers by its own rules. The assistant gets the graph with its values, not your clips; sending values can be switched off in **Settings ▸ Privacy**.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 4, **A video graph is needed**:
  - a **Load Diffusion Model** node.
  - a **Load Diffusion Model** node.
  - a **ModelSamplingSD3** node.
  - a **ModelSamplingSD3** node.
  - `unet_name` of **Load Diffusion Model** (first pass) holds the high_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-HIGH_fp8_e4m3fn_scaled_KJ.safetensors`.
  - `unet_name` of **Load Diffusion Model** (second pass) holds the low_noise half of Wan 2.2; such a file lies in `models/diffusion_models`, for example `Wan2_2-T2V-A14B-LOW_fp8_e4m3fn_scaled_KJ.safetensors`.
- Step 10, **The LoRA's words in the prompt**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **WanImageToVideo** or **KSampler (Advanced)** or **KSampler** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **WanImageToVideo** or **KSampler (Advanced)** or **KSampler**.
  - `text` of **CLIP Text Encode (Prompt)** holds a trigger word of the file chosen in `lora_name` of any **LoraLoaderModelOnly**, when the file's description names any.

## See also
- [Content rules](../trust/Content-Rules.md)
- [Video models](../concepts/Video-Models.md)
- [Speed-up LoRAs](../concepts/Speed-Up-LoRAs.md)
- [Lesson: LoRA: add a style or a subject](LoRA.md)
- [Lesson: The start picture is the anchor](Anchor-Start.md)
- [Lesson: Pictures for adults](Adult-Image.md)
- [How lessons work](How-Lessons-Work.md)
