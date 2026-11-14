import type { LessonWords } from '../texts';

/**
 * The words of the video lessons of sets/video.ts. Each lesson says first what it costs in memory and time, and a
 * lesson that puts a person's face, motion or voice onto something starts with the consent rule, in the words of
 * the talking-portrait lessons. Every number a step names is the one its rule prefers.
 */

const SAVE = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.';

/** When the file a step asks for is not in the list. The app downloads nothing: the person does, in ComfyUI. */
const noFile = (template: string) => `If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, ${template}: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.`;

/** A pack runs other people's code: said once, where a lesson needs one. */
const PACK = (pack: string) => `This lesson needs the ${pack} pack. Install it yourself through ComfyUI's manager. A pack runs other people's code on your computer, so take it from its official page and keep it up to date.`;

const CONSENT_VOICE = 'Only someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law.';
const CONSENT_BODY = 'Only someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law.';

/** Said once, right after the consent rule, in every lesson that uses a picture of a person. */
const LIMITS = 'For adult (18+) use, obtain consent and follow local law. Exclude anyone under 18 or who appears underage; label synthetic depictions so they do not mislead others. The lessons teach technique in factual, non-graphic terms.';

const EMPTY = 'If the canvas already holds another graph, start from an empty one: "File ▸ New project".';

const PROMPTS = {
  title: 'Write the prompt',
  body: 'Add two {positive} nodes and connect the `CLIP` output of {clip} to the `clip` input of each. In the `text` field of one, describe the clip: who or what is in the frame, what happens, how the camera moves. The other is the negative prompt: what must not be there.\n\nFor video the action matters most. "A cat jumps onto a windowsill, the camera follows" works better than "a cat on a windowsill".',
};

const WAN_TEXT = {
  title: 'Load the text encoder',
  body: 'Add a {clip} node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.\n\nThe text encoder turns the prompt into what the model reads. The `fp8` version of the file takes half the memory of the full one and is what the templates use.',
};

const WAN_SHIFT = {
  title: 'Set the shift',
  body: 'Add a {shift} node and connect the `MODEL` output of the loader to its `model` input. Set `shift` to 8.\n\nShift decides how much of the work goes to the early, noisy steps where the composition and the motion are laid out. With a small value Wan keeps the composition and the motion worse and the clip comes out sluggish.\n\nThe SD3 in the node\'s name is left from another model: Wan uses the same node.',
};

const DECODE = {
  title: 'Turn the result into frames',
  body: 'Add a {decode} node. Connect the sampler\'s output to its `samples` input and the output of {vae} to its `vae` input.\n\nThe sampler gives the clip in compressed form, the latent. This node unfolds it into frames.',
};

const saveAt = (fps: number, why: string) => ({
  title: 'Make the clip and save it',
  body: `Add {video} and {save}. The frames from {decode} go into the \`images\` input of {video}, and its output into the \`video\` input of {save}. Set \`fps\` to ${fps}.\n\n${why} With another number the clip runs faster or slower than it was meant to.`,
});

export const VIDEO_LESSONS_EN: Record<string, LessonWords> = {
  'video-small': {
    title: 'Video on a modest graphics card: Wan 2.2 5B',
    result: 'You build a one-model Wan 2.2 graph that makes a five-second 720p clip from a prompt, or from an image.',
    steps: {
      intro: {
        title: 'What it costs, first',
        body: `Wan 2.2 has a small model, 5B (five billion parameters), made for ordinary graphics cards. It draws 24 fps and takes a prompt, an image, or both.\n\nWhat you need:\n- the model file, about 10 GB, in \`models/diffusion_models\`;\n- the \`umt5_xxl\` text encoder, about 7 GB in its \`fp8\` form, in \`models/text_encoders\`;\n- the \`wan2.2_vae\` file in \`models/vae\`.\n\nMemory: with ComfyUI moving parts of the model to system memory as needed, a card with 8 GB can run it. Time: a five-second clip takes minutes, not seconds, and the first run is longer because the files are read from disk.\n\nThe graph has one model and one sampler, not the pair of the large 14B models. ${EMPTY}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the \`wan2.2_ti2v_5B\` file in \`unet_name\`. \`ti2v\` means it takes text, an image, or both.\n\n${noFile('the "Wan 2.2 5B Video Generation" template')}`,
      },
      'text-encoder': WAN_TEXT,
      vae: {
        title: 'Load the VAE of the small model',
        body: 'Add a {vae} node and choose the `wan2.2_vae` file in `vae_name`.\n\nThe 5B model compresses video more strongly than the 14B models and has its own VAE. The `wan_2.1_vae` file of the large models gives broken frames here.',
      },
      prompts: PROMPTS,
      shift: WAN_SHIFT,
      latent: {
        title: 'Set the size and the length',
        body: 'Add a {latent} node and connect the output of {vae} to its `vae` input. Set `width` to 1280, `height` to 704 and `length` to 121.\n\n121 frames at 24 fps make five seconds. For Wan the number of frames is of the form 4n + 1: 49, 81, 121. The model was trained at this 720p size; a smaller size is faster and less sharp.',
      },
      picture: {
        title: 'Starting from an image, if you like',
        body: 'The same node has a `start_image` input. Connect a Load Image node to it and the clip starts from your image; leave it empty and the clip is drawn from the prompt alone. In the template this node is there and switched off.\n\nWith an image, the prompt describes what happens, not what is in the frame. Keep the proportions of the image close to 1280 × 704.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect to it:\n- to `model`, the output of {shift};\n- to `positive` and `negative`, the two prompts;\n- to `latent_image`, the output of {latent}.',
      },
      settings: {
        title: 'Set up the sampler',
        body: 'In {sampler} set `steps` to 20, `cfg` to 5, `sampler_name` to `uni_pc` and `scheduler` to `simple`.\n\nThese are the numbers of the official template. Fewer steps are faster and blurrier; a `cfg` far above 5 burns the colours.',
      },
      decode: DECODE,
      save: saveAt(24, 'The 5B model draws 24 fps, the large Wan models 16.'),
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the graphics card runs out of memory, the lesson "When a video does not fit in memory" goes on from this very graph.`,
      },
    },
  },
  'video-memory': {
    title: 'When a video does not fit in memory',
    result: 'You change the graph of the small Wan model so that it needs less graphics memory, and you know what each change costs.',
    steps: {
      intro: {
        title: 'Why video runs out of memory',
        body: 'Practice on the graph of "Video on a modest graphics card". Three things are in graphics memory during a run: the weights of the model, the latent of the whole clip with what the model works out for it, and at the end the decoding of every frame at once. Each of them can be made smaller, and each change costs something: a little quality, or time.\n\nThe usual message when it does not fit says "out of memory" (OOM) in ComfyUI\'s window.',
      },
      graph: {
        title: 'The graph of the small model is needed',
        body: 'The canvas must hold the graph of "Video on a modest graphics card": {model}, {vae}, {latent}, {sampler} and {video}. If it is not there, do that lesson first.',
      },
      where: {
        title: 'Where the memory goes',
        body: '- The model: a file in `fp16` takes two bytes per parameter, so 5B is about 10 GB. In `fp8` it is half.\n- The text encoder: it works once at the start and ComfyUI moves it out afterwards, but it must fit while it works.\n- The clip: memory grows with width × height × number of frames. Half the frames is about half the memory of this part.\n- The decoding: the VAE turns all frames into pixels at once, a peak at the very end.',
      },
      fp8: {
        title: 'Hold the model in fp8',
        body: 'In {model} set `weight_dtype` to `fp8_e4m3fn`.\n\nThe model is kept in memory with one byte per parameter instead of two. The picture changes a little; on most clips the difference is hard to see. A file that is already `fp8` (its name says so) gains nothing from this.',
      },
      files: {
        title: 'Lighter files',
        body: 'The same model comes in lighter files:\n- `fp8` or `fp8_scaled` files: half the size of `fp16`, the format of most official templates;\n- GGUF files (Q8, Q6, Q5, Q4): smaller still, the lower the number the smaller and the rougher. They are loaded by the ComfyUI-GGUF pack with its own loader, not by Load Diffusion Model;\n- the text encoder in `fp8` instead of the full one.\n\nTake files only from the model\'s official page or a well-known publisher. Old formats (`.ckpt`, `.pt`, `.pth`, `.bin`) can run code when loaded; `.safetensors` and `.gguf` cannot.',
      },
      tiles: {
        title: 'Decode in tiles',
        body: 'Add a {tiled} node. Connect the sampler\'s output to its `samples` input and the VAE to its `vae` input, and its output to the `images` input of {video} in place of the old decoder. Set `tile_size` to 512 and `temporal_size` to 32.\n\nThe frames are decoded in pieces, a square of 512 pixels and 32 frames at a time, so the peak at the end is much lower. Smaller pieces need less memory and take longer; seams between tiles are rare at these numbers. The old decoder can be deleted.',
      },
      smaller: {
        title: 'A smaller clip',
        body: 'In {latent} set `width` to 960, `height` to 544 and `length` to 81.\n\nThat is about three seconds at 24 fps, at a size below 720p. Both numbers stay multiples of 32 for this node, and the length stays of the form 4n + 1. This is the change that saves the most, and the clip shows it: less detail, a shorter scene.',
      },
      offload: {
        title: 'When it still does not fit',
        body: '- ComfyUI moves parts of a model to system memory by itself when graphics memory is short. It is slower but works, as long as there is enough system memory. Close other programs that use the graphics card.\n- ComfyUI can be started with `--lowvram`, which moves even more out of graphics memory.\n- Block swapping: some packs keep part of the model\'s blocks in system memory and bring each one in when it is needed. WanVideoWrapper has a Block Swap node, SeedVR2 has a `blocks_to_swap` field. The more blocks, the less graphics memory and the slower.\n- A speed-up LoRA (4 to 8 steps) does not save memory but saves most of the time.',
      },
      check: {
        title: 'Check one change at a time',
        body: `${SAVE}\n\nChange one thing, run, and look at the clip and at the time. Then the next. That way you know which change cost what, and you keep the ones your card needs.`,
      },
    },
  },
  'video-flf': {
    title: 'Two anchors: first and last frame',
    result: 'You give two images, and the model draws the clip that goes from the first to the last.',
    steps: {
      intro: {
        title: 'What it costs, first',
        body: `${CONSENT_BODY} ${LIMITS}\n\nThe clip starts at one image and ends at another; the model invents the motion between them. It suits transformations, a turn of the camera, a day turning to night.\n\nThis is the large Wan 2.2 pair: two 14B models in \`i2v\` files, about 14 GB each in \`fp8\`, plus the \`umt5_xxl\` text encoder and \`wan_2.1_vae\`. Comfortable with a 24 GB card; with less, ComfyUI moves parts to system memory and the run gets much slower. 81 frames at 20 steps take tens of minutes on a mid-range card. The "Fast video in four steps" lesson cuts that several times over and works on this graph too.\n\n${EMPTY}`,
      },
      models: {
        title: 'Load the two image-to-video models',
        body: `Add two {high} nodes. In \`unet_name\` choose the \`i2v\` file with \`high_noise\` in its name in one, and the \`i2v\` file with \`low_noise\` in the other.\n\nThe first lays out the motion, the second finishes the detail. The \`t2v\` files do not take images.\n\n${noFile('the "Wan 2.2 14B First-Last Frame to Video" template')}`,
      },
      'text-encoder': WAN_TEXT,
      vae: {
        title: 'Load the VAE',
        body: 'Add a {vae} node and choose the `wan_2.1_vae` file in `vae_name`. The Wan 2.2 models of 14B use the VAE of version 2.1.',
      },
      prompts: {
        title: 'Describe the way from one frame to the other',
        body: 'Add two {positive} nodes and connect the `CLIP` output of {clip} to the `clip` input of each. In the `text` field of one, describe what happens between the two images: how one becomes the other, how the camera moves. The other is the negative prompt.',
      },
      shift: {
        title: 'Set the shift of both models',
        body: 'Add two {shiftHigh} nodes and pass each model through its own: the loader\'s `MODEL` output to the `model` input. Set `shift` to 8 in both.',
      },
      pictures: {
        title: 'Load the two images',
        body: 'Add two {first} nodes. In the `image` field of one choose the image the clip starts with, in the other the one it ends with.\n\nThe two images should have the same proportions and show the same scene or subject. The more they differ, the stranger the motion between them.',
      },
      start: {
        title: 'Prepare the start and the end',
        body: 'Add a {start} node and connect to it:\n- to `positive` and `negative`, the two prompts;\n- to `vae`, the output of {vae};\n- to `start_image`, the first image, and to `end_image`, the last.\n\nSet `width` and `height` to 640 and `length` to 81. The size should have the proportions of your images.',
      },
      'first-pass': {
        title: 'The first pass',
        body: 'Add a {pass1} node. Its `model` input takes the `high_noise` model through its {shiftHigh} node; its `positive`, `negative` and `latent_image` inputs take the three outputs of {start}.',
      },
      'second-pass': {
        title: 'The second pass',
        body: 'Add a second {sampler} node. Its `model` input takes the `low_noise` model through its own shift node; `positive` and `negative` take the same outputs of {start}; `latent_image` takes the output of the first sampler.',
      },
      split: {
        title: 'Split the steps between the two',
        body: 'In the first sampler: `add_noise` `enable`, `steps` 20, `cfg` 4, `start_at_step` 0, `end_at_step` 10, `return_with_leftover_noise` `enable`.\n\nIn the second: `add_noise` `disable`, the same `steps` and `cfg`, `start_at_step` 10 (where the first one stopped), `return_with_leftover_noise` `disable`.\n\nThe first does half of the twenty steps and hands over the noise that is left; the second goes on from that very step.',
      },
      decode: DECODE,
      save: saveAt(16, 'The 14B Wan models draw 16 fps.'),
      between: {
        title: 'What the model invents between the anchors',
        body: 'Two anchors fix the first and the last frame. Everything between is the model\'s: the path of the motion, the turn of a head, what is hidden behind an object. The prompt is your only say in it, so describe the way, not the two pictures again.\n\nThe closer the two images (same light, same proportions, a change one motion can make), the more believable the middle. Two images that differ in everything give a dissolve or a sudden jump instead of motion.',
      },
      loop: {
        title: 'A loop',
        body: 'Put the same image into both Load Image nodes, and describe a motion that comes back: a sway, a breath, waves, a turning wheel. The clip ends where it started and plays in a loop without a seam.\n\nThe app asks for two different files in this lesson; for a loop, copy the image under a second name.',
      },
      tips: {
        title: 'When the result is not right',
        body: '- The clip jumps to the last frame at the end: lengthen `length` to 121 or describe a slower change.\n- The middle is a blur: the two images differ too much; bring them closer or describe the way between them in more detail.\n- The colours drift: use images of the same light.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-control': {
    title: 'Video guided by another video: Wan 2.2 Fun Control',
    result: 'Your image comes to life with the motion of another video: its depth, its pose or its edges.',
    steps: {
      intro: {
        title: 'Before you start',
        body: `${CONSENT_BODY} ${LIMITS}\n\nThe model takes two things: a reference image that says what is drawn, and a control video that says how it moves. A control video is a depth map, a skeleton of a pose, or the edges of the frames of an ordinary video.\n\nWhat it costs: the Fun Control 5B model, about 10 GB in \`models/diffusion_models\`, with the \`umt5_xxl\` text encoder and \`wan2.2_vae\`. A card with 8 GB can run it with ComfyUI moving parts to system memory; a five-second clip takes minutes.\n\n${EMPTY}`,
      },
      model: {
        title: 'Load the Fun Control model',
        body: `Add a {model} node and choose the \`wan2.2_fun_control_5B\` file in \`unet_name\`.\n\n${noFile('the "Wan 2.2 5B Fun Control" template')}`,
      },
      'text-encoder': WAN_TEXT,
      vae: { title: 'Load the VAE', body: 'Add a {vae} node and choose `wan2.2_vae` in `vae_name`: the 5B models have their own VAE.' },
      prompts: PROMPTS,
      shift: WAN_SHIFT,
      source: {
        title: 'Load the control video',
        body: 'Add {source} and {frames}. In `file` choose the video, and connect the output of {source} to the `video` input of {frames}: it gives the frames, the sound and the frame rate separately.\n\nThe video must lie in the `input` folder of ComfyUI.',
      },
      control: {
        title: 'What makes a control video',
        body: '- A video that is already a control (a depth map, a skeleton, edges): its frames go in as they are, as in the template.\n- An ordinary video: put a node between it and the model that makes a control of each frame. ComfyUI\'s own Canny draws edges; the comfyui_controlnet_aux pack draws depth (Depth Anything) and poses (DWPose, OpenPose).\n- Edges keep shapes most strictly, depth keeps the space, a pose moves only the body.\n\nThe app accepts such a node on the way from {frames} to the model.',
      },
      reference: {
        title: 'Load the reference image',
        body: 'Add a {picture} node and choose in `image` the picture of what must move: a character, an object. It should have the proportions of the control video.',
      },
      start: {
        title: 'Bring it together',
        body: 'Add a {start} node and connect to it:\n- to `positive` and `negative`, the two prompts;\n- to `vae`, the output of {vae};\n- to `ref_image`, the reference image;\n- to `control_video`, the `images` output of {frames} (or of the node that makes the control).\n\nSet `width` and `height` to 704 and `length` to 121. The control video must have at least as many frames.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node. Its `model` input takes the output of {shift}; `positive`, `negative` and `latent_image` take the three outputs of {start}.',
      },
      settings: {
        title: 'Set up the sampler',
        body: 'In {sampler} set `steps` to 20, `cfg` to 5 and `sampler_name` to `uni_pc`, as in the template.',
      },
      decode: DECODE,
      save: saveAt(24, 'The 5B model draws 24 fps.'),
      tips: {
        title: 'When the result is not right',
        body: '- The motion is right but the character changes: the reference image and the control video differ too much in proportions or pose; bring them closer.\n- The clip copies the control too literally (edges of the original show): use depth or a pose instead of edges.\n- The motion is too fast or too slow: the control video was not at 24 fps. Load it at 24 fps (the VideoHelperSuite lesson shows how).',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-speech': {
    title: 'A portrait that speaks: HuMo',
    result: 'A person from an image says the words of a sound file, with ComfyUI\'s own nodes, no pack.',
    steps: {
      intro: {
        title: 'Before you start',
        body: `${CONSENT_VOICE} ${LIMITS}\n\nHuMo draws a person from a reference image and moves the lips with the sound. The sound goes into the clip as its track.\n\nWhat it costs: the HuMo 17B model, about 17 GB in \`fp8\`, in \`models/diffusion_models\`; the lightx2v speed-up LoRA in \`models/loras\`; the Whisper audio encoder in \`models/audio_encoders\`; \`umt5_xxl\` and \`wan_2.1_vae\`. Plan on a card with 16 GB or more, or a long run with parts moved to system memory. The clip is about four seconds.\n\n${EMPTY}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the \`humo_17B\` file in \`unet_name\`.\n\n${noFile('the "HuMo Video Generation" template')}`,
      },
      lora: {
        title: 'Add the speed-up LoRA',
        body: 'Add a {lora} node and connect the `MODEL` output of {model} to its `model` input. Choose the `lightx2v` file in `lora_name` and leave `strength_model` at 1.\n\nWith it, 6 steps and `cfg` 1 are enough, as in the template; without it the model needs far more steps.',
      },
      shift: {
        title: 'Set the shift',
        body: 'Add a {shift} node and connect the output of {lora} to its `model` input. Set `shift` to 8.',
      },
      'text-encoder': WAN_TEXT,
      vae: { title: 'Load the VAE', body: 'Add a {vae} node and choose `wan_2.1_vae` in `vae_name`. HuMo is built on Wan 2.1 and uses its VAE.' },
      prompts: {
        title: 'Describe the scene',
        body: 'Add two {positive} nodes and connect the `CLIP` output of {clip} to the `clip` input of each. In the `text` field of one, describe who speaks, where and how: calmly, smiling, looking at the camera. What is said comes from the sound, not from the prompt.',
      },
      voice: {
        title: 'Load the voice',
        body: 'Add three nodes: {voice}, {listener} and {heard}.\n- In {voice} choose the sound file from the `input` folder.\n- In `audio_encoder_name` of {listener} choose the Whisper file (`whisper_large_v3`).\n- Connect the output of {listener} to the `audio_encoder` input of {heard}, and the sound to its `audio` input.\n\nA clean recording of one voice, without music, works best.',
      },
      portrait: {
        title: 'Load the portrait',
        body: 'Add a {picture} node and choose the image of the person in `image`. A face seen from the front, well lit, mouth closed or slightly open.',
      },
      start: {
        title: 'Bring it together',
        body: 'Add a {start} node and connect to it the two prompts, the VAE, the output of {heard} to `audio_encoder_output` and the portrait to `ref_image`.\n\nSet `width` and `height` to 640 and `length` to 97: at 25 fps that is about four seconds.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node. Its `model` input takes the output of {shift}; `positive`, `negative` and `latent_image` take the three outputs of {start}.',
      },
      settings: {
        title: 'Set up the sampler',
        body: 'Set `steps` to 6 and `cfg` to 1. The speed-up LoRA is made for these numbers; a higher `cfg` with it burns the picture.',
      },
      decode: DECODE,
      save: {
        title: 'Make the clip with its sound',
        body: 'Add {video} and {save}. The frames go into `images`, the output of {voice} into `audio`, and the clip into the `video` input of {save}. Set `fps` to 25.\n\nHuMo draws 25 fps; with another number the lips miss the words.',
      },
      tips: {
        title: 'When the lips miss the words',
        body: '- The sound is longer than the clip: only the first four seconds are spoken. Cut the sound or make the clip longer, 97 frames per four seconds.\n- The face changes: use a sharper portrait, closer to the camera.\n- The mouth barely moves: the voice is quiet or has music under it.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-ltx': {
    title: 'Video with sound: LTX-2.5',
    result: 'One run draws a clip and its sound together, from a prompt.',
    steps: {
      intro: {
        title: 'What it costs, first',
        body: `LTX-2.5 by Lightricks draws the picture and the sound in one go: steps, rain, a voice. The graph works in two stages: the first draws the clip at half size, a latent upscaler doubles it, and the second stage finishes the detail.\n\nWhat you need: the distilled model (over 20 GB) in \`models/diffusion_models\`; the Gemma text encoder (about 12 GB) in \`models/text_encoders\`; two VAE files, one for the video and one for the sound, in \`models/vae\`; the upscaler in \`models/latent_upscale_models\`. A card with 24 GB is comfortable; with less, ComfyUI moves parts to system memory and the run is slower. The distilled model needs only eight steps and three, so a five-second clip takes minutes.\n\nThe graph is the largest of these lessons. ${EMPTY}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the \`ltx-2.5\` distilled file in \`unet_name\`.\n\n${noFile('the "LTX-2.5: Text to Video" template')}`,
      },
      readers: {
        title: 'The text encoder and the two VAEs',
        body: 'Add {clip}, {vae} and a second {soundVae}.\n- In `clip_name` of {clip} choose the Gemma file made for LTX-2.5 and set `type` to `ltxv`.\n- In `vae_name` of {vae} choose the `video-vae` file.\n- In `vae_name` of the second VAE loader choose the `audio-vae` file.\n\nThe picture and the sound have their own VAE; mixing them up gives noise in place of sound.',
      },
      prompts: {
        title: 'Write the prompt with its sound',
        body: 'Add two {positive} nodes and connect the `CLIP` output of {clip} to each. In the `text` field of one, describe the scene in several sentences, and say what is heard: "rain drums on a tin roof", "she says quietly: we are late". The other is the negative prompt.\n\nLTX reads long, detailed prompts best.',
      },
      rate: {
        title: 'Tell the model the frame rate',
        body: 'Add a {rate} node. Connect the two prompts to its `positive` and `negative` inputs and set `frame_rate` to 24.\n\nThe model needs to know how fast time runs in the clip, for the motion and for the sound to keep pace.',
      },
      size: {
        title: 'Size and length of the first stage',
        body: 'Add a {latent} node. Set `width` to 768, `height` to 512 and `length` to 121.\n\nThis is half the final size: the upscaler doubles it. For LTX the number of frames is of the form 8n + 1 (97, 121) and the sides are multiples of 32. 121 frames at 24 fps make five seconds.',
      },
      silence: {
        title: 'A blank for the sound, joined to the video',
        body: 'Add {silence} and {join}.\n- Connect the output of the sound VAE loader to the `audio_vae` input of {silence}. Set `frames_number` to 121 and `frame_rate` to 24, as for the video.\n- Connect the output of {latent} to `video_latent` of {join}, and the output of {silence} to `audio_latent`.\n\nThe model draws picture and sound in one latent, so the two blanks travel together.',
      },
      parts: {
        title: 'Noise, sampler and steps',
        body: `Add {noise}, {pick} and {sigmas}.\n- In \`sampler_name\` of {pick} choose \`euler_ancestral\`.\n- In \`sigmas\` of {sigmas} write: \`${'1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0'}\`.\n\nThis custom sampler is built of parts. The list of numbers is the noise left after each step: the distilled model was trained for exactly these eight steps.`,
      },
      guider: {
        title: 'The guider',
        body: 'Add a {guider} node. Connect the model to its `model` input, and the `positive` and `negative` outputs of {rate} to its inputs. Set `video_cfg` and `audio_cfg` to 1.\n\nThe distilled model needs no extra push from the prompt; a higher value burns the picture.',
      },
      'first-stage': {
        title: 'The first stage',
        body: 'Add a {stage1} node and connect to it: `noise` from {noise}, `guider` from {guider}, `sampler` from {pick}, `sigmas` from {sigmas}, and `latent_image` from {join}.',
      },
      upscale: {
        title: 'Double the size of the video',
        body: 'Add {split1}, {upscaler}, {larger} and a second {rejoin}.\n- The `output` of the first stage goes into `av_latent` of {split1}: it parts the video and the sound.\n- In `model_name` of {upscaler} choose the LTX-2.5 spatial upscaler file. Its output goes into `upscale_model` of {larger}, the video VAE into `vae`, and `video_latent` of {split1} into `samples`.\n- The output of {larger} goes into `video_latent` of the new join, and `audio_latent` of {split1} into its `audio_latent`.\n\nOnly the video is enlarged; the sound goes on as it is.',
      },
      'second-stage': {
        title: 'The second stage',
        body: 'Add a second {sigmas2} with `sigmas` `0.85, 0.7250, 0.4219, 0.0`, and a second {stage2}. Connect to the new sampler the same noise, guider and sampler choice, the new list of steps, and the output of the second join to `latent_image`.\n\nThree short steps finish the detail of the larger clip. The template has a copy of the noise, the guider and the sampler choice for each stage, with the same settings; one of each serves both.',
      },
      decode: {
        title: 'Turn the result into frames and sound',
        body: 'Add a second {split2}, a {decode} and a {sound}.\n- The `output` of the second stage goes into `av_latent` of the new separating node.\n- Its `video_latent` goes into `samples` of {decode}, with the video VAE into `vae`.\n- Its `audio_latent` goes into `samples` of {sound}, with the sound VAE into `audio_vae`.\n\nThe tiled decoder turns a large clip into frames piece by piece, so the end of the run needs less memory.',
      },
      save: {
        title: 'Make the clip with its sound',
        body: 'Add {video} and {save}: the frames into `images`, the sound into `audio`, the clip into `video`. Set `fps` to 24, as in {rate}.',
      },
      tips: {
        title: 'When the result is not right',
        body: '- The sound does not fit the picture: describe the sound in the prompt as clearly as the picture.\n- The clip is still: describe one clear action and the camera\'s motion.\n- It does not fit in memory: lower `length` to 97, or the size to 640 × 384.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-hunyuan': {
    title: 'Video from text: HunyuanVideo 1.5',
    result: 'You build the HunyuanVideo 1.5 graph with a custom sampler and get a five-second 720p clip.',
    steps: {
      intro: {
        title: 'What it costs, first',
        body: `HunyuanVideo 1.5 by Tencent is an 8B video model, between the small and the large Wan in size. Its graph uses the custom sampler: noise, a guider, a sampler and a list of steps as separate nodes.\n\nWhat you need: the \`720p_t2v\` model, about 17 GB in \`fp16\`, in \`models/diffusion_models\`; two text encoders (\`qwen_2.5_vl_7b\` in \`fp8\` and the small \`byt5\` for lettering) in \`models/text_encoders\`; \`hunyuanvideo15_vae\` in \`models/vae\`. A card with 16 GB or more is comfortable; 121 frames at 1280 × 720 take a long time, a smaller size much less.\n\n${EMPTY}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the \`hunyuanvideo1.5_720p_t2v\` file in \`unet_name\`.\n\n${noFile('the "Hunyuan Video 1.5 Text to Video" template')}`,
      },
      'text-encoders': {
        title: 'Load the two text encoders',
        body: 'Add a {clip} node. In `clip_name1` choose `qwen_2.5_vl_7b`, in `clip_name2` choose `byt5_small_glyphxl`, and set `type` to `hunyuan_video_15`.\n\nThe first reads the prompt, the second helps with text written in the picture.',
      },
      vae: { title: 'Load the VAE', body: 'Add a {vae} node and choose `hunyuanvideo15_vae` in `vae_name`. The VAE of HunyuanVideo 1.0 does not fit version 1.5.' },
      prompts: PROMPTS,
      shift: {
        title: 'Set the shift',
        body: 'Add a {shift} node and connect the `MODEL` output of the loader to its `model` input. Set `shift` to 7.',
      },
      size: {
        title: 'Size and length',
        body: 'Add a {latent} node. Set `width` to 1280, `height` to 720 and `length` to 121.\n\n121 frames at 24 fps make five seconds; the number of frames is of the form 4n + 1. For a lighter run take the 480p model and 848 × 480.',
      },
      parts: {
        title: 'Noise, sampler and steps',
        body: 'Add {noise}, {pick} and {schedule}.\n- In `sampler_name` of {pick} choose `euler`.\n- Connect the model to the `model` input of {schedule}, set `scheduler` to `simple` and `steps` to 20.\n\nThe scheduler works out the list of noise levels for the twenty steps; the noise node holds the seed.',
      },
      guider: {
        title: 'The guider',
        body: 'Add a {guider} node. Its `model` input takes the output of {shift}; its `positive` and `negative` inputs take the two prompts. Set `cfg` to 6.',
      },
      sampler: {
        title: 'The sampler',
        body: 'Add a {sampler} node and connect to it: `noise` from {noise}, `guider` from {guider}, `sampler` from {pick}, `sigmas` from {schedule}, `latent_image` from {latent}.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add a {decode} node. Connect the `output` of {sampler} to its `samples` input and the VAE to its `vae` input. With little memory take VAE Decode (Tiled) instead.',
      },
      save: saveAt(24, 'HunyuanVideo 1.5 draws 24 fps.'),
      tips: {
        title: 'What else the template does',
        body: 'The official template adds two things on top of this graph:\n- EasyCache between the loader and the shift: it skips work on steps that change little, faster with a small loss of detail;\n- a second stage that enlarges the clip to 1080p with its own model and latent upscaler.\n\nBoth can be added later; the app accepts EasyCache on the way of the model.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-kandinsky': {
    title: 'Video from text: Kandinsky 5 Lite',
    result: 'You build a light one-model graph that makes a five-second clip from a prompt.',
    steps: {
      intro: {
        title: 'What it costs, first',
        body: `Kandinsky 5.0 Video Lite by Sber AI is a small video model, 2B, about 4 GB on disk. It reads the prompt with two text encoders and decodes with the VAE of HunyuanVideo.\n\nWhat you need: the \`kandinsky5lite_t2v\` file in \`models/diffusion_models\`; \`qwen_2.5_vl_7b\` (about 9 GB in \`fp8\`) and \`clip_l\` in \`models/text_encoders\`; \`hunyuan_video_vae\` in \`models/vae\`. The model itself fits modest cards; the text encoder is the largest file. 50 steps make the run long: expect many minutes.\n\n${EMPTY}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the \`kandinsky5lite_t2v\` file in \`unet_name\`.\n\n${noFile('the "Kandinsky 5.0 Video Lite Text to Video" template')}`,
      },
      'text-encoders': {
        title: 'Load the two text encoders',
        body: 'Add a {clip} node. In `clip_name1` choose `qwen_2.5_vl_7b`, in `clip_name2` choose `clip_l`, and set `type` to `kandinsky5`.',
      },
      vae: { title: 'Load the VAE', body: 'Add a {vae} node and choose `hunyuan_video_vae` in `vae_name`. Kandinsky 5 uses the VAE of HunyuanVideo 1.0.' },
      prompts: PROMPTS,
      shift: {
        title: 'Set the shift',
        body: 'Add a {shift} node and connect the `MODEL` output of the loader to its `model` input. Set `shift` to 5.',
      },
      start: {
        title: 'Size and length',
        body: 'Add a {start} node and connect to it the two prompts and the VAE. Set `width` to 768, `height` to 512 and `length` to 121.\n\nThe Lite file of this lesson is made for five-second clips: 121 frames at 24 fps. Its `start_image` input stays empty for video from text.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node. Its `model` input takes the output of {shift}; `positive`, `negative` and `latent_image` take the outputs of {start} with the same names.',
      },
      settings: {
        title: 'Set up the sampler',
        body: 'Set `steps` to 50, `cfg` to 5, `sampler_name` to `euler_ancestral` and `scheduler` to `beta`, as in the template. With fewer steps the run is faster and the clip rougher.',
      },
      decode: DECODE,
      save: saveAt(24, 'Kandinsky 5 draws 24 fps.'),
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-interpolate': {
    title: 'Smoother motion: more frames between frames',
    result: 'A finished clip gets twice as many frames and plays smoothly at twice the frame rate.',
    steps: {
      intro: {
        title: 'What interpolation does',
        body: `An interpolation model looks at two neighbouring frames and draws the one between them. A 16 fps clip becomes a smooth 32 fps one, and its length in seconds stays the same.\n\nWhat it costs: a small model (FILM or RIFE, tens of megabytes) in \`models/frame_interpolation\`. It runs on any card that runs ComfyUI, and quickly: seconds to minutes. The memory grows with the size and the number of frames.\n\nThese are ComfyUI's own nodes. The ComfyUI-Frame-Interpolation pack does the same with its RIFE VFI and FILM VFI nodes. ${EMPTY}`,
      },
      source: {
        title: 'Load the clip',
        body: 'Add {source} and {frames}. Choose the clip in `file` and connect the output of {source} to the `video` input of {frames}. Its outputs are the frames, the sound and the frame rate.',
      },
      model: {
        title: 'Load the interpolation model',
        body: `Add an {interp} node and choose the model in \`model_name\`: \`film_net\` is the template's choice, RIFE files are faster.\n\n${noFile('the "Frame Interpolation: FILM or RIFE" template')}`,
      },
      between: {
        title: 'Draw the frames between',
        body: 'Add a {more} node. Connect the model to its `interp_model` input and the `images` output of {frames} to its `images` input. Set `multiplier` to 2.\n\n2 puts one new frame between each two; 4 puts three. A larger number on fast motion invents more and makes more mistakes.',
      },
      save: {
        title: 'Save at the new frame rate',
        body: 'Add {video} and {save}. The frames of {more} go into `images`, the `audio` output of {frames} into `audio`, and the clip into `video` of {save}.\n\nSet `fps` to the old rate times `multiplier`: for a 16 fps clip and 2, set 32. With the old rate the clip would play twice as slow.',
      },
      tips: {
        title: 'When the result is not right',
        body: '- Smeared shapes on fast motion: lower `multiplier` to 2 or try another model.\n- The clip is too slow or too fast: `fps` is not the old rate times the multiplier.\n- Interpolation also gives smooth slow motion: keep `fps` as it was, and the clip plays slower and longer.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-upscale': {
    title: 'A larger, sharper video: SeedVR2',
    result: 'A low-resolution clip is redrawn at 1080p with its details restored.',
    steps: {
      intro: {
        title: 'What it costs, first',
        body: `${PACK('ComfyUI-SeedVR2_VideoUpscaler')}\n\nSeedVR2 does not only stretch frames: it redraws them larger, restoring detail, and keeps neighbouring frames consistent.\n\nWhat it costs: the 3B model (about 7 GB) or the 7B one (about 16 GB, sharper), and a VAE. When a file is missing, the pack's loader fetches it itself into \`models/SEEDVR2\` when the graph is first run in ComfyUI; the app downloads nothing. With block swapping and tiled VAE, as here, the 3B model runs on modest cards. Each frame is redrawn, so a long clip takes long: start with a few seconds.\n\n${EMPTY}`,
      },
      source: {
        title: 'Load the clip',
        body: 'Add {source} and {frames}. Choose the clip in `file` and connect {source} to the `video` input of {frames}.',
      },
      dit: {
        title: 'Load the model with block swapping',
        body: 'Add a {dit} node. In `model` choose the 3B file to start with. Set `blocks_to_swap` to 32 and `offload_device` to `cpu`.\n\nBlock swapping keeps most of the model\'s blocks in system memory and brings each in when it is needed: much less graphics memory, a slower run. With a large card, set it to 0.',
      },
      vae: {
        title: 'Load the VAE in tiles',
        body: 'Add a {vae} node, choose the VAE file in `model`, and set `encode_tiled` and `decode_tiled` to `true`.\n\nThe frames are read and written in pieces, so the peak of memory stays low.',
      },
      upscaler: {
        title: 'The upscaler',
        body: 'Add a {larger} node. Connect the `images` output of {frames} to its `image` input, {dit} to `dit` and {vae} to `vae`. Set `resolution` to 1080, `batch_size` to 33 and `color_correction` to `lab`.\n\n`resolution` is the length of the shorter side of the result. `batch_size` is how many frames are redrawn together: more keeps the motion consistent and needs more memory. It is of the form 4n + 1 (5, 21, 33).',
      },
      save: {
        title: 'Save with the sound',
        body: 'Add {video} and {save}. The frames of {larger} go into `images`, the `audio` output of {frames} into `audio`, the clip into `video` of {save}. Set `fps` to the rate of the original clip, for example 24.',
      },
      tips: {
        title: 'When the result is not right',
        body: '- Out of memory: lower `batch_size` to 21 or 5, or `resolution` to 720.\n- Flicker between groups of frames: raise `batch_size`.\n- The colours shift: try `wavelet` in `color_correction`.\n- Too slow: cut the clip shorter first; the template takes the first 96 frames with Image From Batch, which the app accepts on the way.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-vhs': {
    title: 'Load, cut and save video: VideoHelperSuite',
    result: 'You load a piece of a video at a chosen frame rate and save it with its sound.',
    steps: {
      intro: {
        title: 'What the pack is for',
        body: `${PACK('ComfyUI-VideoHelperSuite')}\n\nComfyUI's own Load Video takes a whole video. The pack's loader takes a piece of it: from which frame, how many, at what frame rate and size. Its Video Combine saves frames as mp4, webm or gif, with sound. Many published video graphs use these two nodes.\n\nNo model is needed and nothing heavy runs: the memory is the frames themselves, so a long piece at a large size can still fill it. ${EMPTY}`,
      },
      load: {
        title: 'Load the video',
        body: 'Add a {source} node and choose the video in `video`. The list shows the videos of the `input` folder; the node can also upload a new one.',
      },
      trim: {
        title: 'Take the piece you need',
        body: 'In {source} set:\n- `force_rate` to 16: the frames are taken as if the video were shot at 16 fps, the rate of the large Wan models;\n- `skip_first_frames` to 16: the first second is skipped;\n- `frame_load_cap` to 81: no more frames than that are taken.\n\nFrames are counted after the rate is changed. 0 in `force_rate` keeps the video\'s own rate, 0 in `frame_load_cap` takes everything.',
      },
      size: {
        title: 'Size and every other frame',
        body: '- `custom_width` and `custom_height` resize the frames on loading; 0 keeps the size, and one of them alone keeps the proportions.\n- `select_every_nth` takes every second, third… frame: a quick way to a lower frame rate or a shorter piece.\n\nA video model wants its own size and frame rate; preparing frames here saves a resize node later.',
      },
      combine: {
        title: 'Save it with the sound',
        body: 'Add a {save} node. Connect the `IMAGE` output of {source} to its `images` input and `audio` to `audio`. Set `frame_rate` to 16, the same as `force_rate`, and `format` to `video/h264-mp4`.\n\nThe sound comes cut to the same piece. With another frame rate the video and its sound part ways.',
      },
      more: {
        title: 'What else the pack has',
        body: '- Video Info gives the rate, the length and the size of the video, before and after loading.\n- Load Video (Path) takes a video by its path instead of the `input` folder.\n- Meta Batch Manager splits a long video into parts that fit in memory.\n- Video Combine has `loop_count` and `pingpong` for gifs, and its `crf` (in the mp4 settings) trades size for quality.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'video-remove': {
    title: 'Remove an object from a video: ProPainter',
    result: 'An object marked by a mask video disappears, and the background behind it is filled in from the neighbouring frames.',
    steps: {
      intro: {
        title: 'What it costs, first',
        body: `${PACK('ComfyUI_ProPainter_Nodes')} The example also uses ComfyUI-VideoHelperSuite to load and save.\n\nProPainter follows the motion between frames and fills a masked area with what the other frames show behind it. It needs two videos of the same length: the clip, and a mask video where the object to remove is red (or white) and the rest black. A mask video is made in a video editor or with a segmentation pack such as SAM2.\n\nWhat it costs: its models are small; the pack fetches them itself into its own folder when the graph is first run in ComfyUI. Memory grows quickly with the size and the number of frames; the example halves the size and takes 24 frames.\n\n${EMPTY}`,
      },
      source: {
        title: 'Load the clip',
        body: 'Add a {source} node, choose the clip in `video` and set `frame_load_cap` to 24.\n\nTry a short piece first: the work grows with every frame.',
      },
      'mask-video': {
        title: 'Load the mask video',
        body: 'Add a second {maskSource} node, choose the mask video in `video` and set the same `frame_load_cap` and `skip_first_frames` as for the clip.\n\nThe mask must match the clip frame for frame; a shift of one frame leaves a ghost of the object.',
      },
      'to-mask': {
        title: 'Turn the mask video into a mask',
        body: 'Add a {mask} node, connect the frames of the mask video to its `image` input and set `channel` to `red`.\n\nThe node reads one colour of each frame as the mask: where it is bright, the object is removed.',
      },
      inpaint: {
        title: 'Remove the object',
        body: 'Add a {clean} node. Connect the frames of the clip to `image` and the output of {mask} to `mask`. Set `width` to 640 and `height` to 480 (the size of your frames) and `mask_dilates` to 5.\n\n`mask_dilates` widens the mask by a few pixels, so the edge of the object does not stay behind.\n\nIf the frames are large, put an Upscale Image By node with 0.5 before both inputs, as the example does; the app accepts it on the way.',
      },
      save: {
        title: 'Save the result',
        body: 'Add a {save} node, connect the `IMAGE` output of {clean} to `images` and set `frame_rate` to 24, the rate of the clip.',
      },
      tips: {
        title: 'When the result is not right',
        body: '- A shadow or an edge of the object remains: raise `mask_dilates` to 8–10, or widen the mask itself.\n- The filled area is blurry: the background behind the object is never seen in the clip; ProPainter can only invent it roughly.\n- Out of memory: fewer frames, or a smaller size.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
  'anchor-start': {
    title: 'The start picture is the anchor',
    result: 'Your picture becomes the first frame of the clip, and you know how to trade motion for likeness.',
    steps: {
      intro: {
        title: 'Before you start',
        body: `${CONSENT_BODY} ${LIMITS}\n\nThe first lesson of the thread "the anchor picture": how to keep a person or a scene the same through a video. The simplest anchor is the start image. It goes on the graph of "Video on a modest graphics card" and costs the same: a card with 8 GB with offloading, minutes per five-second clip.`,
      },
      graph: {
        title: 'The graph of the small model is needed',
        body: 'The canvas must hold the graph of "Video on a modest graphics card": {model}, {latent}, the prompt {positive} and {sampler}. If it is not there, do that lesson first.',
      },
      picture: {
        title: 'Connect the anchor picture',
        body: 'Add a {picture} node, choose your image in `image`, and connect its `IMAGE` output to the `start_image` input of {latent}.\n\nThe template has this very node, switched off. Connected, it makes the first frame of the clip.',
      },
      holds: {
        title: 'What the anchor holds, and what it does not',
        body: 'It holds the first frame exactly: the face, the clothes, the light, the place. It also sets the look of the whole clip, because every later frame grows out of it.\n\nIt does not hold identity by itself. The further the clip moves from the first frame (a head turning away, a walk out of the frame, many seconds), the more the model draws from its own idea of a person, and the face drifts. This is called identity drift.',
      },
      length: {
        title: 'A shorter clip keeps the likeness',
        body: 'In {latent} set `length` to 81: about three and a half seconds at 24 fps.\n\nDrift grows with every frame. A short clip that stays close to the anchor keeps the person; a long one is better made in parts (the lesson "A longer video in parts").',
      },
      trade: {
        title: 'Motion against likeness',
        body: 'Three things trade motion for likeness:\n- the length of the clip, as in the last step;\n- the shift of the model: the template has 8; a lower value, such as 5, usually gives calmer motion that stays nearer to the picture. Compare on your own image;\n- the motion you ask for: a turn of the head or a smile keeps a face, a dance or a run lets it drift.\n\nSome families have a strength for the image conditioning; Wan has none, so these three are the levers here.',
      },
      motion: {
        title: 'Describe the motion, not the picture',
        body: 'In the `text` field of {positive} describe what happens: who moves, how, what the camera does. "She turns her head to the window and smiles, the camera slowly moves closer."\n\nThe picture already says what is in the frame. Describing it again pulls the model towards drawing that description, and the clip may jump away from your image or stay still.',
      },
      lora: {
        title: 'A character LoRA together with the anchor',
        body: 'A LoRA trained on a character holds the face where the anchor alone lets it drift. It goes between the model loader and the shift, as in the lesson "LoRA: add a style or a subject".\n\nWith the small model there is one LoRA file. With the large Wan 2.2 pair a character LoRA comes as two files: the `high` one goes into the path of the `high_noise` model, which lays out the composition and the motion; the `low` one into the path of the `low_noise` model, which draws the detail, and the face with it. If only one file exists, the likeness comes mostly from the low-noise pass.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nNext in the thread: "Two anchors: first and last frame".`,
      },
    },
  },
  'anchor-reference': {
    title: 'A reference for the whole clip: Wan VACE',
    result: 'A person or an object from your picture stays itself in every frame, not only in the first.',
    steps: {
      intro: {
        title: 'Before you start',
        body: `${CONSENT_BODY} ${LIMITS}\n\nA start image fixes the first frame. A reference input is read by the model at every frame: the subject of the picture appears in the clip and keeps its look, while the scene, the pose and the camera may be quite different. Wan VACE does this on ComfyUI's own nodes.\n\nWhat it costs: the VACE 14B model, about 33 GB in \`fp16\` (an \`fp8\` file is half), in \`models/diffusion_models\`, with the CausVid LoRA in \`models/loras\`, \`umt5_xxl\` and \`wan_2.1_vae\`. Plan on 24 GB of graphics memory or a slow run with parts in system memory. With the LoRA, 4 steps are enough, and an 81-frame clip takes minutes on a large card.\n\n${EMPTY}`,
      },
      model: {
        title: 'Load the VACE model',
        body: `Add a {model} node and choose the \`wan2.1_vace_14B\` file in \`unet_name\`.\n\n${noFile('the "Wan VACE Reference to Video" template')}`,
      },
      lora: {
        title: 'Add the CausVid LoRA',
        body: 'Add a {lora} node and connect the output of {model} to its `model` input. Choose the CausVid file in `lora_name` and set `strength_model` to 0.3.\n\nIt lets the model finish in 4 steps; at full strength it flattens the motion.',
      },
      shift: {
        title: 'Set the shift',
        body: 'Add a {shift} node and connect the output of {lora} to its `model` input. Set `shift` to 8.',
      },
      'text-encoder': WAN_TEXT,
      vae: { title: 'Load the VAE', body: 'Add a {vae} node and choose `wan_2.1_vae` in `vae_name`. VACE is built on Wan 2.1.' },
      prompts: PROMPTS,
      reference: {
        title: 'Load the reference picture',
        body: 'Add a {picture} node and choose in `image` the picture of the subject: a person, a character, an object.\n\nA plain background works best: the model takes everything in the picture as part of the subject.',
      },
      start: {
        title: 'Bring it together',
        body: 'Add a {start} node and connect to it the two prompts, the VAE, and the picture to `reference_image`. Set `width` and `height` to 768, `length` to 81 and `strength` to 1.\n\n`strength` is how firmly the reference holds. The other inputs (`control_video`, `control_masks`) stay empty here; in other lessons they carry motion.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node. Its `model` input takes the output of {shift}; `positive`, `negative` and `latent_image` take the outputs of {start} with the same names.',
      },
      settings: {
        title: 'Set up the sampler',
        body: 'Set `steps` to 4, `cfg` to 1 and `sampler_name` to `uni_pc`, as in the template. Without the LoRA the model needs about 20 steps and a `cfg` near 6.',
      },
      trim: {
        title: 'Cut the reference off',
        body: 'Add a {trim} node and connect the output of {sampler} to its `samples` input. Connect the `trim_latent` output of {start} to its `trim_amount` input.\n\nVACE puts the reference at the start of the clip as extra frames; this node cuts them off, so the picture does not flash at the beginning.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add a {decode} node. Connect the output of {trim} to its `samples` input and the VAE to its `vae` input.',
      },
      save: saveAt(16, 'Wan VACE draws 16 fps.'),
      keeps: {
        title: 'What a reference keeps, and what else does the same',
        body: '- It keeps the look of the subject: face, hair, clothes, colours. It does not keep the pose or the place of the picture, and it is not the first frame.\n- A face seen small in the reference comes out vague; a close, sharp picture holds better.\n- Other ways to hold a subject through all frames: Wan Animate takes a reference picture and the motion of a video (the lesson "Animation by pose: Wan Animate"); HuMo holds a person while they speak (the lesson "A portrait that speaks: HuMo").\n- The cost: a reference makes the model read more at every step, and the VACE model is large. A clip takes longer than plain image to video.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nNext in the thread: "A longer video in parts".`,
      },
    },
  },
  'anchor-parts': {
    title: 'A longer video in parts',
    result: 'Two parts of a clip join through a shared anchor frame into one longer video.',
    steps: {
      intro: {
        title: 'Before you start',
        body: `${CONSENT_BODY} ${LIMITS}\n\nA video model makes a few seconds at a time. A longer clip is made in parts, and the frame that ends one part is the anchor that starts the next. This lesson adds a second part to the graph of "Two anchors: first and last frame", as the official template with six key frames does.\n\nWhat it costs: each part costs as much as the whole graph before, so two parts take twice the time. The memory stays the same: the parts run one after the other.`,
      },
      graph: {
        title: 'The first part is needed',
        body: 'The canvas must hold the graph of "Two anchors: first and last frame": the two shift nodes, the prompts, {vae}, the image {last} at the end of the clip, {start}, the two samplers {pass1} and {sampler}, {decode} and {video}. If it is not there, do that lesson first.',
      },
      key: {
        title: 'Load the next key frame',
        body: 'Add a {next} node and choose in `image` the picture the second part ends with. The last picture of the first part is where the second one starts.',
      },
      start2: {
        title: 'The start of the second part',
        body: 'Add a second {start2} node. Connect the prompts and the VAE as for the first; connect {last} to its `start_image` and {next} to its `end_image`. Set `width`, `height` and `length` the same as in the first.\n\nThe shared picture is the seam: the first part ends on it and the second starts on it, so the joint does not jump.',
      },
      passes2: {
        title: 'Two passes for the second part',
        body: 'Add two more {pass3} nodes. The first takes the `high_noise` model through its shift node and the three outputs of {start2}; the second takes the `low_noise` model through its own shift node, the prompts of {start2} and the output of the first. The models are loaded once and serve both parts.',
      },
      split2: {
        title: 'The same split of steps',
        body: 'Give the new pair the settings of the first part: `add_noise` `enable` and `disable`, the same `steps` and `cfg`, the first stops at the same `end_at_step` where the second has its `start_at_step`, `return_with_leftover_noise` `enable` and `disable`.',
      },
      seed: {
        title: 'The same seed',
        body: 'Set `noise_seed` of {pass3} to the same number as in {pass1}.\n\nWith the same seed and settings the parts start from the same kind of noise, and colour and texture change less at the seam. A part that went wrong can still be redone with another seed.',
      },
      decode2: {
        title: 'Turn the second part into frames',
        body: 'Add a {decode2} node. Connect the output of the second new sampler to its `samples` input and the VAE to its `vae` input.',
      },
      join: {
        title: 'Join the parts',
        body: 'Add a {join} node. Connect the frames of {decode} to its `image1` input and those of {decode2} to `image2`. Then connect its output to the `images` input of {video} in place of the first part alone.\n\nThe template joins its parts with Batch Images in the same way. The shared key frame appears twice at the seam, which at 16 fps is not seen.',
      },
      drift: {
        title: 'Why colour and face drift from part to part, and what holds them',
        body: '- Each part only sees its two anchors. Anything they do not show (the back of a head, a hand) is invented again in each part, a little differently.\n- What holds: the same reference for every part (key frames made from one picture, or the same character LoRA), the same prompt words for the subject, the same seed and settings.\n- Colour: a colour-match node after decoding brings every part to the colours of one reference frame. The Color Match node of KJNodes does this; the official SCAIL extension template matches each part to the last frame of the one before.\n- Detail: a light detail pass on the frames, or an upscale of the joined clip (the lesson "A larger, sharper video: SeedVR2"), evens out small differences.',
      },
      chain: {
        title: 'Without key frames: the last frame as the next anchor',
        body: 'When you have no picture for the end of each part, take the last frame of the finished part as the start image of the next one: Image From Batch with `batch_index` -1 and `length` 1 picks it. The next part is plain image to video from that frame.\n\nEach handover passes through a decoded frame, so small losses add up: after a few parts the face and the colours drift more than with key frames. Keep the chain short, or save each part with Save Video and join the files afterwards in a video editor.',
      },
      run: { title: 'The graph is ready', body: SAVE },
    },
  },
};
