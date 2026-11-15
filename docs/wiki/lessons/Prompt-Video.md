[Русский](Prompt-Video.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A prompt for video

<!-- lesson: prompt-video -->
Lesson "prompt-video", in the group **Video** of the lesson list. Steps: 10.

## What you will be able to do
You learn to describe a clip so that the model understands the motion and the camera.

## What you need
- It goes on from [Video from text](Video-Text.md). The card says so; it is a hint, not a lock.
- Nodes: CLIP Text Encode (Prompt), WanImageToVideo / KSampler (Advanced).
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **How the prompt of a clip differs** (reading)

   Video models read whole sentences. Wan 2.2 was trained on long, detailed captions, so it understands a short prompt worse than a long one: what is left unsaid it makes up itself, and the clip comes out at random.

   A picture needs an answer to "what is in the frame". A clip also needs "what changes": who moves, where, how fast, and what the camera does. What is not said either stands still or moves any old way.

   Wan understands English and Chinese. Weights in parentheses hardly act on it: what matters is said in words.

2. **A video graph is needed**

   This lesson goes on from the graph of "Video from text" or "Video from a picture". The canvas must have a **CLIP Text Encode (Prompt)** node whose output goes into a `positive` input.

   If it is not there, do one of those lessons first.

3. **What a prompt is made of** (reading)

   A good prompt of a clip answers five questions, usually in this order:
   - who or what is in the frame, and what it looks like;
   - what happens: one action;
   - where it happens;
   - what the camera does;
   - what the light and the mood are.

   An example: `A young woman in a red coat walks slowly along a wet city street at night. Neon signs reflect in the puddles. The camera follows her from the side at walking pace. Soft cinematic light, shallow depth of field.`

   Three to five sentences are about right. A very short prompt leaves the model too much freedom, and in a very long one it loses the main thing.

4. **Write a prompt to this pattern**

   In the `text` field of **CLIP Text Encode (Prompt)** write a prompt of several sentences: who is in the frame, what happens, where, what the camera does, what the light is. At least 80 characters are needed.

   Write in English and in the present tense: `walks`, not `will walk`.

5. **One action per clip** (reading)

   The clip of the lesson lasts five seconds: 81 frames at 16 frames a second. One action fits into that. Describe three in a row and the model squeezes them together, mixes them up or does only the first.

   Motion is named with a verb and made exact: how fast, which way, with which part of the body. `She turns her head to the left and smiles` works. `She is happy` does not: that is a state, not a motion.

   If there are several people in the frame, say of each what they do. Otherwise one of them moves and the rest freeze.

   A long scene is put together from several clips, not from one long prompt.

6. **Words for the camera** (reading)

   The camera gets a sentence of its own. Wan knows the language of film, and these words act on it:
   - `static shot`: the camera stands still;
   - `pan left`, `pan right`: a turn to the side;
   - `tilt up`, `tilt down`: a tilt up or down;
   - `push in`, `pull back`: moving in and moving out;
   - `tracking shot`: the camera moves along with the subject;
   - `orbit`: a flight around;
   - `handheld`: shot from the hands, a slight shake.

   The shot size is set with words too: `close-up`, `medium shot`, `wide shot`. The angle: `low angle`, `high angle`.

   Take one camera move per clip. If the camera must stand still, say so plainly: left untold, the model often moves it itself.

7. **When the clip starts from a picture** (reading)

   In the graph of "Video from a picture" the look is already set by the picture. It need not be described again: name the subject in two or three words so that the model knows who is meant, and describe what changes.

   An example: `The woman in the red coat slowly turns around and looks at the camera. Her hair moves in the wind. Static shot.`

   The prompt must not argue with the picture. If it is night in the picture and day in the text, the model breaks the frame trying to please both.

   What the prompt does not name the model tries to leave as it is in the picture. So for video from a picture the prompt can be shorter.

8. **The second text for video** (reading)

   The second text, the one that goes into the `negative` input, lists the defects of a clip. In the ready ComfyUI templates for Wan it holds a long list in Chinese: overexposure, a still frame, blurred detail, subtitles, extra fingers, distorted faces and hands. It can be left as it is, or the same can be written in English: `overexposed, static, blurry details, subtitles, extra fingers, deformed hands`.

   The second text acts only when `cfg` in the samplers is above 1. "Video from text" sets 3.5, and the text works. With the speed-up LoRA of "Fast video in four steps" `cfg` is 1, and the second text does not act at all. Then everything that matters must be in the main prompt.

9. **When the clip does not obey** (reading)

   What to change, and in what order:
   - the clip stands still: the prompt has no action. Add a verb and a camera move;
   - the motion is limp, as if in slow motion: that is often the price of a speed-up LoRA. Describe a livelier motion, or make the clip without the speed-up, in twenty steps;
   - the camera moves when it should not: write `static shot`;
   - the face and the figure drift towards the end: too much motion for five seconds. Keep one action or lower `length`;
   - the model does something other than what is written: make that the first sentence and take out everything secondary;
   - the subject changes from clip to clip: describe it in the very same words each time, or start from a picture;
   - everything is off: change `noise_seed` in the first sampler.

10. **What the app will tell you** (reading)

   The "Check" button on the top toolbar reads the prompts of a clip too. It says when a prompt is empty, when forms of other programs are left in it, when it is not written in English, when the second text does not act because of `cfg` 1, and when the prompt has none of the words of your LoRA.

   The words of a LoRA and the prompts its author used are shown in the card of the file in the "Models" tab. For a motion LoRA this matters most: without its words it often does not switch on.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **A video graph is needed**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **WanImageToVideo** or **KSampler (Advanced)** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **WanImageToVideo** or **KSampler (Advanced)**.
- Step 4, **Write a prompt to this pattern**:
  - `text` of **CLIP Text Encode (Prompt)** holds at least 80 characters and 10 real words, written in English.

## Mistakes people make
- Three actions in five seconds: the model squeezes or drops them.
- A state instead of a motion ("she is happy" rather than "she turns and smiles").
- No camera sentence: the model moves the camera on its own. Write `static shot` if it must stand.
- Expecting the negative prompt to work with a speed-up LoRA (cfg 1).

## See also
- [How lessons work](How-Lessons-Work.md)
- [The prompt](../concepts/Prompt.md)
- [The negative prompt](../concepts/Negative-Prompt.md)
- [Video models](../concepts/Video-Models.md)
