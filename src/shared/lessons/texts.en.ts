import type { LessonWords } from './texts';

/**
 * The words of the lessons. Each step: what to do and why. `{role}` in a text is replaced by the name of the node
 * as this ComfyUI's library shows it. Field names and values stand in backticks: the person looks for them on
 * the node.
 *
 * The lesson on adult content is about technique and about limits. There are no explicit texts and no ready
 * scene descriptions here, and there will be none.
 */

const SAVE = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.';

/** When the file a step asks for is not in the list. The app downloads nothing: the person does, in ComfyUI. */
const noFile = (template: string) => `If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, ${template}: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.`;

const NEED_VIDEO = {
  title: 'A video graph is needed',
  body: 'This lesson goes on from the graph of "Video from text" or "Video from a picture". The canvas must have two {high} nodes and two {shiftHigh} nodes.\n\nIf they are not there, do one of those lessons first.',
};

const FIRST_SETTINGS = {
  title: 'Set up the first sampler',
  body: 'In the first sampler set:\n- `add_noise`: `enable`;\n- `steps`: 20;\n- `cfg`: 3.5;\n- `start_at_step`: 0 and `end_at_step`: 10;\n- `return_with_leftover_noise`: `enable`.\n\nIt does the first half of twenty steps and hands the clip over with the noise that is left. Without the last setting the second sampler gets a clip that is already clean and has nothing to finish.',
};

const SECOND_SETTINGS = {
  title: 'Set up the second sampler',
  body: 'In the second sampler set:\n- `add_noise`: `disable`;\n- `steps` and `cfg`: as in the first;\n- `start_at_step`: 10, the very step the first one stopped at;\n- `return_with_leftover_noise`: `disable`.\n\nThe noise is already there and must not be added twice. If `start_at_step` differs from the first sampler\'s `end_at_step`, some steps are lost or done twice.',
};

const DECODE = {
  title: 'Turn the result into frames',
  body: 'Add a {decode} node. Connect the second sampler\'s output to its `samples` input and the output of {vae} to its `vae` input.\n\nThe sampler gives the clip in a compressed form. This node unfolds it into frames.',
};

const SAVE_VIDEO = {
  title: 'Make the clip and save it',
  body: 'Add {video} and {save}. The frames from {decode} go into the `images` input of {video}, and its output into the `video` input of {save}. Set `fps` to 16.\n\nWan draws 16 frames a second. With another number the clip runs faster or slower than it was meant to.',
};

const TRIGGER = {
  title: 'Put the LoRA\'s words into the description',
  body: 'Add your LoRA\'s words to the `text` field of the {positive} node whose output goes into a `positive` input.\n\nThe app compares the description with the words written in the LoRA file itself. If its author wrote none there, there is nothing to compare with and the step counts on its own.',
};

export const LESSONS_EN: Record<string, LessonWords> = {
  image: {
    title: 'A first picture from text',
    result: 'You build a graph of seven nodes that draws a picture from a description.',
    steps: {
      intro: {
        title: 'How a graph works',
        body: 'A graph reads from left to right. Each node does one thing, and the lines carry the result on.\n\nThis lesson has seven nodes: the model loader, two texts, a blank, the sampler, the turn into a picture and the saving.\n\nA node is added by a double click in the library on the left or with the "Node" button on the canvas toolbar. You build. The app watches the canvas and ticks a step off when it is done.',
      },
      model: {
        title: 'Load the model',
        body: `Add a {checkpoint} node. Choose the model file in its \`ckpt_name\` field.\n\nThis is the model that draws. One file holds three parts, so the node has three outputs: \`MODEL\` draws, \`CLIP\` understands text, \`VAE\` turns the result into a picture.\n\n${noFile('a ready template for a picture from text')}`,
      },
      prompts: {
        title: 'Add two texts',
        body: 'Add two {positive} nodes. One will hold what you want to see. The other holds what must not be in the picture.\n\nThere are two nodes because the sampler takes these texts through different inputs.',
      },
      'prompts-clip': {
        title: 'Connect the texts to the model',
        body: 'Drag a link from the `CLIP` output of {checkpoint} to the `clip` input of each of the two text nodes.\n\nA link is dragged with the mouse: from the dot on the right edge of one node to the dot on the left edge of another. This is how the text reaches the part of the model that can read it.',
      },
      'prompt-text': {
        title: 'Write what you want to see',
        body: 'Fill in the `text` field of one of the two text nodes. For example: a quiet lake at dawn, mist, soft light.\n\nLeave the other empty or list in it what is not wanted: blur, distortion. Most models understand English best.',
      },
      latent: {
        title: 'Add the blank',
        body: 'Add a {latent} node. Its `width` and `height` fields set the size of the picture.\n\nThe model does not draw on a clean sheet. It starts from noise of this size and removes it step by step.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node.\n\nThis is the main node of the graph: here noise becomes an image. Everything you have added so far meets in it.',
      },
      'sampler-links': {
        title: 'Bring four links to the sampler',
        body: 'Connect to the inputs of {sampler}:\n- to `model`, the `MODEL` output of {checkpoint};\n- to `positive`, the output of the node with your description;\n- to `negative`, the output of the other text node;\n- to `latent_image`, the output of {latent}.\n\nIf `positive` and `negative` are swapped, the model avoids what you described.',
      },
      decode: {
        title: 'Turn the result into a picture',
        body: 'Add a {decode} node. Connect the sampler\'s output to its `samples` input and the `VAE` output of {checkpoint} to its `vae` input.\n\nThe sampler gives not a picture but its compressed form. This node unfolds it into pixels.',
      },
      save: {
        title: 'Save the picture',
        body: 'Add a {save} node and connect the output of {decode} to its `images` input.\n\nWithout it ComfyUI works the picture out and puts it nowhere.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try in the sampler:\n- \`seed\`: another number gives another picture from the same description;\n- \`steps\`: more steps, a cleaner picture and a longer wait. 20–30 is usually enough;\n- \`cfg\`: how strictly the model follows the text. Usually 5–8.`,
      },
    },
  },
  'video-text': {
    title: 'Video from text',
    result: 'You build a Wan 2.2 graph that makes a five-second clip from a description.',
    steps: {
      intro: {
        title: 'What a video is to a model',
        body: 'To a model a video is a stack of frames. It draws them all at once so that the motion holds together.\n\nWan 2.2 does this in two passes with two models. The first, `high_noise`, lays out the composition and the motion. The second, `low_noise`, finishes the detail. That is why the graph has two model loaders and two samplers.\n\nThe graph is larger than for a picture: fourteen nodes. The steps are small, and the app ticks each one off.',
      },
      models: {
        title: 'Load two models',
        body: `Add two {high} nodes. In the \`unet_name\` field of one choose the file with \`high_noise\` in its name, in the other the file with \`low_noise\`. This lesson needs \`t2v\` files, that is "text to video".\n\nThese are two halves of one model. The same file in both nodes will not work.\n\n${noFile('the ready Wan 2.2 "text to video" template')}`,
      },
      'text-encoder': {
        title: 'Load the text reader',
        body: 'Add a {clip} node. Choose the `umt5_xxl` file in `clip_name` and set `type` to `wan`.\n\nVideo models keep their text reader in a separate file. The `type` field tells the node which model the text is for. With another value the model gets nonsense.',
      },
      vae: {
        title: 'Load the VAE',
        body: 'Add a {vae} node and choose the `wan_2.1_vae` file in `vae_name`.\n\nThe VAE turns the result into frames. The large Wan 2.2 models need the VAE of version 2.1. The `wan2.2_vae` file fits only the small 5B model.',
      },
      prompts: {
        title: 'Write the description',
        body: 'Add two {positive} nodes and connect the output of {clip} to the `clip` input of each. In the `text` field of one describe the clip: what is in the frame, what happens, how the camera moves. The other is for what must not be there.\n\nFor video the action matters. "A person walks along a beach, the camera follows from the side" works better than "a person on a beach".',
      },
      shift: {
        title: 'Set the noise shift',
        body: 'Add two {shiftHigh} nodes. Pass the first model through one and the second through the other: the loader\'s `MODEL` output to the `model` input. Set `shift` to 8 in both.\n\nThis number shifts the noise schedule. With a small value Wan gives sluggish motion and detail that falls apart.\n\nThe SD3 in the node\'s name is left from another model: Wan is set up with the same node.',
      },
      latent: {
        title: 'Set the size and the length',
        body: 'Add a {latent} node. Set `width` to 832, `height` to 480 and `length` to 81.\n\n`length` is the number of frames. 81 frames at 16 frames a second make five seconds. For Wan the number of frames must be of the form 4n + 1: 49, 81, 121.\n\nSize and length weigh most on time and on the memory of the graphics card. Start small.\n\nThe Hunyuan in the node\'s name is left from another video model: Wan uses the same blank.',
      },
      'first-pass': {
        title: 'The first pass',
        body: 'Add a {first} node and connect to it:\n- to `model`, the output of the {shiftHigh} node that carries the `high_noise` model;\n- to `positive` and `negative`, the two texts;\n- to `latent_image`, the output of {latent}.\n\nThis sampler starts from pure noise and lays the clip out.',
      },
      'second-pass': {
        title: 'The second pass',
        body: 'Add a second {second} node and connect to it:\n- to `model`, the output of the {shiftLow} node with the `low_noise` model;\n- to `positive` and `negative`, the same two texts;\n- to `latent_image`, the output of the first sampler.\n\nThe second sampler receives the unfinished clip and finishes it.',
      },
      'first-settings': FIRST_SETTINGS,
      'second-settings': SECOND_SETTINGS,
      decode: DECODE,
      save: SAVE_VIDEO,
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe first run is long: the models are loaded into memory. If the graphics card runs out of memory, lower \`width\`, \`height\` or \`length\`.\n\nNext: "Video from a picture" brings a finished frame to life, and "Fast video in four steps" cuts the wait several times over.`,
      },
    },
  },
  'video-image': {
    title: 'Video from a picture',
    result: 'You bring a finished picture to life: it becomes the first frame of the clip.',
    steps: {
      intro: {
        title: 'What is different',
        body: 'Here the clip starts from your picture. The description no longer says what is in the frame but what happens in it.\n\nThe graph is almost the one from "Video from text". If it is on your canvas, most steps are already done and the app goes straight to the new ones.\n\nThree things change: the model files, a node with the picture and a node that prepares the start.',
      },
      models: {
        title: 'Choose the models for a picture',
        body: `Two {high} nodes are needed. In the \`unet_name\` field of one choose the \`i2v\` file with \`high_noise\` in its name, in the other the \`i2v\` file with \`low_noise\`. \`i2v\` means "image to video".\n\nThe \`t2v\` models of the last lesson do not take a picture.\n\n${noFile('the ready Wan 2.2 "image to video" template')}`,
      },
      'text-encoder': {
        title: 'The text reader',
        body: 'A {clip} node is needed, with the `umt5_xxl` file in `clip_name` and `wan` in `type`. It is the same as for video from text.',
      },
      vae: {
        title: 'The VAE',
        body: 'A {vae} node is needed, with the `wan_2.1_vae` file in `vae_name`.\n\nHere it works twice: it reads your picture at the start and puts the frames together at the end.',
      },
      prompts: {
        title: 'Describe the motion',
        body: 'Two {positive} nodes are needed, with their `clip` input connected from {clip}. In the `text` field of one describe what happens: who moves and how, what the camera does.\n\nWhat the picture already shows need not be repeated.',
      },
      shift: {
        title: 'The noise shift',
        body: 'Two {shiftHigh} nodes are needed, one for each model, with `shift` from 5 to 8. The `MODEL` output of each loader goes into the `model` input of its node.',
      },
      picture: {
        title: 'Load the picture',
        body: 'Add a {picture} node and choose your picture in its `image` field. The list shows the files of the `input` folder of your ComfyUI.\n\nThis picture becomes the first frame. The model keeps it best when the clip has the proportions of the picture.',
      },
      start: {
        title: 'Prepare the start',
        body: 'Add a {start} node and connect to it:\n- to `positive` and `negative`, the two texts;\n- to `vae`, the output of {vae};\n- to `start_image`, the `IMAGE` output of {picture}.\n\nSet `width` to 832, `height` to 480 and `length` to 81.\n\nThis node puts your picture into the blank of the clip and into both texts. That is why the samplers take the texts from its outputs from here on, and not directly.',
      },
      'first-pass': {
        title: 'The first pass',
        body: 'A {first} node is needed. Its `model` input takes the `high_noise` model through its {shiftHigh} node. Its `positive`, `negative` and `latent_image` inputs take the three outputs of {start}: `positive`, `negative` and `latent`.\n\nA sampler left connected to the texts directly does not learn of the picture and draws the clip from nothing.\n\nThe node with the blank from "Video from text" is connected to nothing after this. It can be deleted.',
      },
      'second-pass': {
        title: 'The second pass',
        body: 'A second {second} node is needed. Its `model` input takes the `low_noise` model through {shiftLow}. Its `positive` and `negative` inputs take the same outputs of {start}, and `latent_image` takes the output of the first sampler.',
      },
      'first-settings': FIRST_SETTINGS,
      'second-settings': SECOND_SETTINGS,
      decode: DECODE,
      save: SAVE_VIDEO,
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the clip stands still, add action and camera motion to the description. If a figure or a face drifts towards the end, shorten \`length\` or describe a calmer motion.`,
      },
    },
  },
  lora: {
    title: 'LoRA: add a style or a subject',
    result: 'You connect a LoRA to both models and put its words into the description.',
    steps: {
      intro: {
        title: 'What a LoRA is',
        body: 'A LoRA is a small addition to a model. It teaches the model one thing: a style, a character, an object, a kind of motion.\n\nA LoRA is made for its own model. A LoRA for Wan does not work with SDXL, nor the other way round. In the "Models" tab on the left the card of a file shows which model it belongs to.\n\nWan 2.2 has two models, so a LoRA often comes as a pair of files: `high` and `low`.',
      },
      graph: NEED_VIDEO,
      add: {
        title: 'Add two LoRA nodes',
        body: 'Add two {loraHigh} nodes: one for each model.',
      },
      wire: {
        title: 'Put them into the model\'s path',
        body: 'Each LoRA node stands between a model loader and its {shiftHigh} node:\n- the `MODEL` output of {high} to the `model` input of the LoRA node;\n- the `MODEL` output of the LoRA node to the `model` input of {shiftHigh}.\n\nDo this for both models. The model passes through the LoRA and comes out changed.',
      },
      files: {
        title: 'Choose the files and the strength',
        body: 'Choose a file in `lora_name`. The node in the path of the `high_noise` model takes the `high` file, the one in the path of `low_noise` the `low` file. If the LoRA is a single file, put it into both nodes.\n\n`strength_model` is the strength. 1 means full strength. If the LoRA overrides everything else or spoils the picture, lower it to 0.6–0.8.\n\nSeveral LoRAs are chained: the output of one LoRA node to the input of the next.',
      },
      'trigger-words': {
        title: 'The words that switch a LoRA on',
        body: 'Many LoRAs act only when the description holds their words. These are called trigger words.\n\nOpen the card of the file in the "Models" tab: if the author wrote these words into the file, they are shown there. If they are not, look at the page you took the LoRA from.',
      },
      trigger: TRIGGER,
      result: {
        title: 'The LoRA is connected',
        body: 'Run the graph in ComfyUI and compare with the clip without the LoRA.\n\nIf nothing changed, check three things: the file fits the model, the trigger words are in the description, the strength is not too low.',
      },
    },
  },
  'video-fast': {
    title: 'Fast video in four steps',
    result: 'You cut twenty steps down to four with a speed-up LoRA.',
    steps: {
      intro: {
        title: 'Where the speed comes from',
        body: 'A speed-up LoRA teaches the model to do in four steps what usually takes twenty. The best known one for Wan is called `lightx2v`.\n\nThe price: less variety and slightly rougher motion. For trying things out and finding the right description it nearly always pays: the clip is ready several times sooner.',
      },
      graph: NEED_VIDEO,
      loras: {
        title: 'Put a LoRA into both models',
        body: 'Two {loraHigh} nodes are needed, each between its {high} node and its {shiftHigh} node. How to put them in is shown in "LoRA: add a style or a subject".',
      },
      files: {
        title: 'Choose the speed-up files',
        body: 'In the node in the path of the `high_noise` model choose the `lightx2v` file with `high` in its name in `lora_name`, and in the path of `low_noise` the file with `low`.\n\nThe files for `t2v` and `i2v` models differ: take the ones that fit your models. Leave `strength_model` at 1.',
      },
      samplers: {
        title: 'The two samplers',
        body: 'The two samplers of a video lesson are needed: the first takes the `high_noise` model, the second takes the `low_noise` model and the result of the first.',
      },
      steps: {
        title: 'Set four steps',
        body: 'Set `steps` to 4 in both samplers. Set `end_at_step` to 2 in the first and `start_at_step` to 2 in the second.\n\nFour steps are split in half: the first model does two, the second does two.',
      },
      cfg: {
        title: 'Set cfg to 1',
        body: 'Set `cfg` to 1 in both samplers.\n\nA speed-up LoRA is trained to work without text guidance. With a larger value the clip burns out and fills with artifacts. At `cfg` 1 the text of the `negative` input stops acting.',
      },
      result: {
        title: 'Now it is fast',
        body: 'The clip is made several times sooner.\n\nOnce the description is right you can go back to twenty steps for quality: take the speed-up LoRAs out and set `steps` back to 20, `cfg` to 3.5 and the hand-over to step 10.',
      },
    },
  },
  adult: {
    title: 'Video for adults: what changes',
    result: 'You learn what the content of a clip depends on and check your graph.',
    steps: {
      rules: {
        title: 'First, the limits',
        body: 'The app teaches technique and does not decide for you what to make. There are two things it never helps with:\n- depicting minors, or anyone who looks like a minor;\n- depicting real people without their consent.\n\nThe rest is your responsibility: the laws of your country and the rules of the places where you post clips.',
      },
      levers: {
        title: 'The technique is the same',
        body: 'The graph for such a clip is the one from the video lessons. What ends up in the frame is decided by three things:\n- the model: what it can draw at all;\n- the LoRA: what it was taught on top of that;\n- the description: what you asked for.\n\nEach in turn below.',
      },
      model: {
        title: 'What the model can do',
        body: 'Most open models were trained on material with few explicit scenes or none. Left to itself such a model draws them badly: it muddles anatomy and drifts off the subject.\n\nThis is put right in two ways: a further-trained version of the model, or a LoRA for the subject. Either must be made for your model: the files for `t2v` and for `i2v` differ, and so do those for Wan 2.1 and 2.2.\n\nThe app downloads nothing. It works with the files already in your ComfyUI and shows in the card of a file which model it belongs to.',
      },
      graph: NEED_VIDEO,
      tuned: {
        title: 'If you take a further-trained model',
        body: 'A further-trained version of Wan 2.2 usually also comes as a pair of files. They are chosen in the same two {high} nodes, in `unet_name`: the file for the first pass in one, the file for the second in the other. Their names may lack `high_noise` and `low_noise` and say only `high` and `low`. Some models come as a single file: their graph is built differently, and the model\'s page describes it.\n\nSome of these models have the speed-up built in. The name usually shows it: it has `light`, `fast` or `4steps` in it. Such a model needs the settings of "Fast video in four steps": `steps` 4, the hand-over at step 2 and `cfg` 1. No speed-up LoRA is added to it.\n\nThe others take the settings of the video lesson. The author gives the exact numbers on the model\'s page: start from those.',
      },
      lora: {
        title: 'If you take a LoRA',
        body: 'A LoRA goes into the path of both models: one LoRA node between each {high} node and its {shiftHigh} node. How to put them in and which files to choose is shown in "LoRA: add a style or a subject". That lesson also checks the links.\n\nA LoRA can stand on top of a further-trained model too. If a speed-up LoRA is there as well, chain the nodes. The order in the chain does not matter.',
      },
      prompt: {
        title: 'How to write the description',
        body: 'Describe the scene in plain words and in order: who is in the frame, what happens, where, how the camera moves, what the light is. Say plainly that the people in the frame are adults.\n\nThe model draws what is named. What the description leaves out it makes up itself, not always well.\n\nThe text for the `negative` input lists defects: distorted hands, extra fingers, blur. At `cfg` 1 this text does not act.',
      },
      trigger: {
        title: 'The LoRA\'s words in the description',
        body: 'If the graph has a LoRA, add its words to the `text` field of the {positive} node whose output goes into a `positive` input.\n\nThe app compares the description with the words written in the LoRA files on the canvas. If the graph has no LoRA, or its author wrote no words into the file, there is nothing to compare with and the step counts on its own.',
      },
      defects: {
        title: 'If the result is poor',
        body: 'What to change, and in what order:\n- anatomy drifts: lower `strength_model` of the LoRA to 0.6–0.8 or shorten `length`;\n- the subject does not appear: check the trigger words and that the file fits the model;\n- the clip is burnt out: with a speed-up LoRA, and with a model that has the speed-up built in, `cfg` must be 1;\n- the motion jerks: describe a calmer motion and check that `fps` is 16;\n- everything is off: change `noise_seed` in the first sampler. Some clips simply fail by chance.',
      },
      helper: {
        title: 'About the helper in the app',
        body: 'The lessons work without a helper model. Questions in "Ask" mode go to the model you chose.\n\nCloud models usually do not answer on such subjects: those are their owners\' rules. A model of your own on this computer answers the way it was trained.\n\nThe helper is sent the graph with the values of its fields, your descriptions among them. It does not see your clips. Sending values can be switched off in "Settings ▸ Privacy".',
      },
    },
  },
};
