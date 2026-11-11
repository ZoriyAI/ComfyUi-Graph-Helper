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
        body: 'A graph reads from left to right. Each node does one thing, and the lines carry the result on.\n\nThis lesson has seven nodes: the model loader, two texts, a blank, the sampler, the turn into a picture and the saving.\n\nA node is added by a double click in the library on the left or with the "Node" button on the canvas toolbar. You build. The app watches the canvas and ticks a step off when it is done.\n\nIf the canvas already holds another graph, start from an empty one: "File ▸ New project".',
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
        body: 'To a model a video is a stack of frames. It draws them all at once so that the motion holds together.\n\nWan 2.2 does this in two passes with two models. The first, `high_noise`, lays out the composition and the motion. The second, `low_noise`, finishes the detail. That is why the graph has two model loaders and two samplers.\n\nThe graph is larger than for a picture: fourteen nodes. The steps are small, and the app ticks each one off.\n\nIf the canvas already holds another graph, start from an empty one: "File ▸ New project".',
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
  prompt: {
    title: 'The description: how a model reads it',
    result: 'You learn what a model does with text and how to steer a picture with words.',
    steps: {
      intro: {
        title: 'What a model does with text',
        body: 'A model does not understand text the way a person does. It was trained on pictures with captions and remembers which words stood next to which pictures. Your description pulls the result towards captions like it.\n\nThree things follow:\n- a word that was not in the captions does nothing, however exact it sounds;\n- a description is not an order: each word pulls its own way, and strong words outpull weak ones;\n- what you leave unsaid the model decides for itself.\n\nNext you take a description apart, piece by piece, on your own graph.',
      },
      graph: {
        title: 'A picture graph is needed',
        body: 'This lesson goes on from the graph of "A first picture from text". The canvas must have two {positive} nodes connected to the `positive` and `negative` inputs of {sampler}.\n\nIf they are not there, do that lesson first.',
      },
      readers: {
        title: 'Two ways of reading',
        body: 'The text is read by a separate part of the model: it turns words into numbers. There are two kinds of this part, and one writes for them differently.\n\nThe first kind reads words and short phrases separated by commas. SD 1.5, SDXL and the models built on them, Pony and Illustrious, work this way. A description that suits them: `portrait of a woman, red coat, night street, rain, soft light`.\n\nThe second kind reads whole sentences and understands who does what and what is where. Flux, SD 3, Qwen-Image and Wan work this way. A description that suits them: `A woman in a red coat stands on a night street in the rain. Soft light from a shop window falls on her face.`\n\nWhich kind your model is shows in its card in the "Models" tab: the line "Family". Most models were trained on English captions: write in English.',
      },
      order: {
        title: 'Order and length',
        body: 'Words at the start of a description weigh more than words at the end. So the main thing goes first: who or what is in the frame, then what happens, then the place, the light and the style.\n\nLength matters too. Models of the first kind read text in chunks of 75 tokens. A token is a word or a piece of one, so 75 tokens come to about 50 English words. Whatever comes after falls into the next chunk and holds together with the start less well. Models of the second kind have room for 512 tokens, yet they too keep a weaker hold on what stands at the very end.\n\nExtra words are not harmless: each takes attention away from the rest. Ten exact words work better than forty random ones.',
      },
      write: {
        title: 'Rewrite the description',
        body: 'In the `text` field of the {positive} node that goes into the `positive` input write the description anew: the main thing first, then the action, the place, the light. At least 40 characters are needed.\n\nAn example for a model of the first kind: `portrait of a woman, red coat, night street, rain, soft light`.',
      },
      weights: {
        title: 'Weight: how to stress what matters',
        body: 'When the model misses something of the description, that thing can be given more weight. In ComfyUI a weight is written like this: `(red coat:1.2)`. The words in the parentheses get a pull of 1.2 instead of the usual 1. A number below 1 weakens: `(rain:0.8)`.\n\nKeep a weight between 0.5 and 1.5. Above that a picture burns out and distorts. 1.1–1.3 is enough most of the time.\n\nThe forms of other programs do not work in ComfyUI. `<lora:name:1>` connects nothing: a LoRA is added with a node of its own. `BREAK`, `AND` and square brackets are read by the model as plain characters. Descriptions from other people\'s pages are often full of such forms: take them out.\n\nThree forms ComfyUI understands itself. Besides the weight these are `embedding:name` for the files of the `embeddings` folder, and curly braces: of the options written in them with a vertical bar between, one is taken at each run. Plain parentheses that must stay in the text are written with a backslash: `\\(` and `\\)`.\n\nOn models of the second kind a weight acts weakly and unpredictably. For them what matters is said in words and put at the start.',
      },
      weigh: {
        title: 'Stress one thing',
        body: 'In the same `text` field put the most important thing into parentheses and give it a weight: for example `(red coat:1.2)`. The weight must be between 0.5 and 1.5 and other than 1.\n\nIf your model is of the second kind, do not expect a strong effect. The step is there so that you remember the form: you will meet it in other people\'s descriptions.',
      },
      negative: {
        title: 'The second text: what must not be there',
        body: 'The text that goes into the `negative` input works differently from the first. At every step the model makes two sketches: one from your description and one from the second text. Then it moves away from the second sketch towards the first.\n\nSo the second text names the very things to move away from: `blurry, extra fingers, watermark, text`. There is no need to write "no" there.\n\nIn the main description negations do harm. Write `no hat` and a hat will most likely appear: the word `hat` pulls towards hats, and `no` weighs next to nothing. Whatever must not be there goes into the second text.\n\nA long second text is not better than a short one. Name what really creeps into your pictures.',
      },
      'negative-text': {
        title: 'Fill in the second text',
        body: 'In the `text` field of the node that goes into the `negative` input list two or three defects separated by commas. For example: `blurry, extra fingers, watermark`.\n\nThen compare the pictures with this text and without it.',
      },
      cfg: {
        title: 'cfg: how strictly to follow the text',
        body: 'The `cfg` field of the sampler sets how far the model moves from the second sketch towards the first. The larger the number, the more strictly it follows the description.\n\nToo small a value gives a limp picture that follows the text poorly. Too large a value gives burnt colours and harsh outlines.\n\nUsual values:\n- SD 1.5: 7–8;\n- SDXL, Pony, Illustrious: 5–7;\n- speeded-up models and speed-up LoRAs: 1–2;\n- Flux: 1. Its strictness is set by a separate node, not by this field.\n\nAt `cfg` 1 the second sketch is not made at all. The text of the `negative` input then does nothing, whatever it says. The author gives the exact numbers on the model\'s page: start from those.',
      },
      seed: {
        title: 'seed: one change at a time',
        body: 'The `seed` field sets the noise a picture starts from. The same number with the same settings and the same description gives the same picture.\n\nThis is used to see what a change did. Keep `seed` as it was, change one thing in the description and compare. If the number and the words change together, there is no telling which of them acted.\n\nIn ComfyUI a switch named `control_after_generate` stands under the `seed` field. With `randomize` the number changes after every run, with `fixed` it stays.\n\nOnce the description is ready, change `seed` to get different pictures from one description. Some of them simply fail by chance: that is normal.',
      },
      problems: {
        title: 'When the picture does not obey',
        body: 'What to check, and in what order:\n- the model misses part of the description: move that part nearer the start, take out extra words, raise its weight to 1.2–1.3;\n- colours and details are mixed up between objects: models of the first kind read words with no ties between them. Describe each object in a phrase of its own and take out extra colours;\n- the picture is burnt out: `cfg` is too high, or a weight is above 1.5;\n- the picture is dull and limp: `cfg` is too low, or `steps` is too few;\n- extra arms, two heads, doubled figures: the size is larger than the one the model was trained at. For SD 1.5 that is 512, for SDXL 1024;\n- the second text changes nothing: check that `cfg` is above 1;\n- nothing helps: change `seed`. Then check in the model\'s card that the description is written in its manner.',
      },
      check: {
        title: 'The app reads descriptions with you',
        body: 'The "Check" button on the top toolbar reads the descriptions of a graph the way ComfyUI will. It says when forms of other programs are left in a text, the parentheses do not match, a weight is too high, the same thing stands in both texts, or the second text does not act because of `cfg` 1. These are advice, not errors: the graph runs with them too.\n\nThe card of a model in the "Models" tab shows what its author wrote down: the words that switch a LoRA on, the strength the author advises, and the descriptions the author\'s own examples were made from. Someone else\'s description that worked is the best textbook: copy it and change one thing at a time.',
      },
    },
  },
  refine: {
    title: 'Refining with a second model',
    result: 'A second model redraws a finished picture: the composition comes from the first, the texture and style from the second.',
    steps: {
      intro: {
        title: 'What refining is',
        body: 'One model follows a description better and builds the composition. Another is better at skin, cloth or a style of its own. Refining takes the best of both: the first model draws a picture, the second redraws it on top.\n\nThe second model does not start from pure noise. Some noise is added to the finished picture, and the model removes it in its own way. The more noise is added, the more the picture changes.\n\nIn this lesson you build a second model onto a picture graph.',
      },
      graph: {
        title: 'A picture graph is needed',
        body: 'This lesson goes on from the graph of "A first picture from text". The canvas must have {checkpoint}, {sampler}, {decode} and {save} with the links between them.\n\nThe graph of "Two models in one graph" will do as well: it has the same part with the picture.\n\nIf these nodes are not there, do the first lesson first.',
      },
      'second-model': {
        title: 'Add the second model',
        body: 'Add a second {checkpointB} node and choose another model in `ckpt_name`: the one whose texture or style you want.\n\nThe models may be of different families. A picture will pass between them, and any model understands a picture.',
      },
      'second-texts': {
        title: 'Give the second model texts of its own',
        body: 'Add two new {positiveB} nodes and connect the `CLIP` output of the second model to the `clip` input of each. In the `text` field of one describe the same picture in the manner the second model understands.\n\nThe texts of the first model must not be connected here: another model read them. The description can be copied when both models read alike, and must be rewritten when they do not.',
      },
      encode: {
        title: 'Translate the picture for the second model',
        body: 'Add an {encode} node. Connect the `IMAGE` output of {decode} to its `pixels` input and the `VAE` output of the second model to its `vae` input.\n\nEach model works with a compressed form of its own. This node compresses the finished picture the way the second model needs, which is why the VAE here is that model\'s.',
      },
      'second-sampler': {
        title: 'Add the second sampler',
        body: 'Add a second {samplerB} node and connect to it:\n- to `model`, the `MODEL` output of the second model;\n- to `positive` and `negative`, its two texts;\n- to `latent_image`, the output of {encode}.\n\nThe second sampler gets not an empty blank but your picture in compressed form.',
      },
      denoise: {
        title: 'Set the strength of refining',
        body: 'Set `denoise` of the second sampler to 0.5.\n\nThis number says how much of the picture the model redraws. At 1 it draws from nothing and the first picture is lost. At 0.2 only fine detail changes. From 0.3 to 0.5 the composition stays, while texture and faces become the way the second model draws them.\n\nSet `steps` and `cfg` to what the author of the second model advises.',
      },
      out: {
        title: 'Save the result',
        body: 'Add one more {decodeB} and one more {saveB}. Connect the output of the second sampler to the `samples` input of {decodeB} and the `VAE` output of the second model to its `vae` input. Its output goes into the `images` input of the new {saveB}.\n\nThe graph now saves two pictures: before refining and after. Compare them while you look for the right `denoise`.',
      },
      'same-family': {
        title: 'When the models are of one family',
        body: 'Models of one family work with the same compressed form of a picture. Then there is no need to unfold it and compress it again: the `LATENT` output of the first sampler goes straight into the `latent_image` input of the second. Less detail is lost this way.\n\nOne family is, for example, SDXL and the models built on it: Pony, Illustrious. Or two SD 1.5 models. The family of a file is shown by its card in the "Models" tab.\n\nBetween different families this must not be done: the second model gets numbers it does not understand and gives noise or an error. Going through a picture, as in this lesson, always works.',
      },
      loras: {
        title: 'LoRA in a graph with two models',
        body: 'Each model has LoRAs of its own. A LoRA of the first model goes between the first {checkpoint} node and the first sampler, a LoRA of the second between the second {checkpointB} node and the second sampler.\n\nThe words of a LoRA go into the description of the model in whose path it stands.\n\nIf a LoRA sets the subject in the first pass and the second pass blurs it, lower `denoise`, or put into the second path a LoRA of the same subject made for the second model.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try:\n- \`denoise\` 0.3 and 0.5: how much the second model changes the picture;\n- swap the models: which one builds the composition better, and which one finishes.\n\nIf a video follows the picture, connect the \`IMAGE\` output of the new {decodeB} to the \`start_image\` input: the clip then starts from the refined picture.`,
      },
    },
  },
  'prompt-video': {
    title: 'A description for video',
    result: 'You learn to describe a clip so that the model understands the motion and the camera.',
    steps: {
      intro: {
        title: 'How the description of a clip differs',
        body: 'Video models read whole sentences. Wan 2.2 was trained on long, detailed captions, so it understands a short description worse than a long one: what is left unsaid it makes up itself, and the clip comes out at random.\n\nA picture needs an answer to "what is in the frame". A clip also needs "what changes": who moves, where, how fast, and what the camera does. What is not said either stands still or moves any old way.\n\nWan understands English and Chinese. Weights in parentheses hardly act on it: what matters is said in words.',
      },
      graph: {
        title: 'A video graph is needed',
        body: 'This lesson goes on from the graph of "Video from text" or "Video from a picture". The canvas must have a {positive} node whose output goes into a `positive` input.\n\nIf it is not there, do one of those lessons first.',
      },
      structure: {
        title: 'What a description is made of',
        body: 'A good description of a clip answers five questions, usually in this order:\n- who or what is in the frame, and what it looks like;\n- what happens: one action;\n- where it happens;\n- what the camera does;\n- what the light and the mood are.\n\nAn example: `A young woman in a red coat walks slowly along a wet city street at night. Neon signs reflect in the puddles. The camera follows her from the side at walking pace. Soft cinematic light, shallow depth of field.`\n\nThree to five sentences are about right. A very short description leaves the model too much freedom, and in a very long one it loses the main thing.',
      },
      write: {
        title: 'Write a description to this pattern',
        body: 'In the `text` field of {positive} write a description of several sentences: who is in the frame, what happens, where, what the camera does, what the light is. At least 80 characters are needed.\n\nWrite in English and in the present tense: `walks`, not `will walk`.',
      },
      action: {
        title: 'One action per clip',
        body: 'The clip of the lesson lasts five seconds: 81 frames at 16 frames a second. One action fits into that. Describe three in a row and the model squeezes them together, mixes them up or does only the first.\n\nMotion is named with a verb and made exact: how fast, which way, with which part of the body. `She turns her head to the left and smiles` works. `She is happy` does not: that is a state, not a motion.\n\nIf there are several people in the frame, say of each what they do. Otherwise one of them moves and the rest freeze.\n\nA long scene is put together from several clips, not from one long description.',
      },
      camera: {
        title: 'Words for the camera',
        body: 'The camera gets a sentence of its own. Wan knows the language of film, and these words act on it:\n- `static shot`: the camera stands still;\n- `pan left`, `pan right`: a turn to the side;\n- `tilt up`, `tilt down`: a tilt up or down;\n- `push in`, `pull back`: moving in and moving out;\n- `tracking shot`: the camera moves along with the subject;\n- `orbit`: a flight around;\n- `handheld`: shot from the hands, a slight shake.\n\nThe shot size is set with words too: `close-up`, `medium shot`, `wide shot`. The angle: `low angle`, `high angle`.\n\nTake one camera move per clip. If the camera must stand still, say so plainly: left untold, the model often moves it itself.',
      },
      picture: {
        title: 'When the clip starts from a picture',
        body: 'In the graph of "Video from a picture" the look is already set by the picture. It need not be described again: name the subject in two or three words so that the model knows who is meant, and describe what changes.\n\nAn example: `The woman in the red coat slowly turns around and looks at the camera. Her hair moves in the wind. Static shot.`\n\nThe description must not argue with the picture. If it is night in the picture and day in the text, the model breaks the frame trying to please both.\n\nWhat the description does not name the model tries to leave as it is in the picture. So for video from a picture the description can be shorter.',
      },
      negative: {
        title: 'The second text for video',
        body: 'The second text, the one that goes into the `negative` input, lists the defects of a clip. In the ready ComfyUI templates for Wan it holds a long list in Chinese: overexposure, a still frame, blurred detail, subtitles, extra fingers, distorted faces and hands. It can be left as it is, or the same can be written in English: `overexposed, static, blurry details, subtitles, extra fingers, deformed hands`.\n\nThe second text acts only when `cfg` in the samplers is above 1. "Video from text" sets 3.5, and the text works. With the speed-up LoRA of "Fast video in four steps" `cfg` is 1, and the second text does not act at all. Then everything that matters must be in the main description.',
      },
      problems: {
        title: 'When the clip does not obey',
        body: 'What to change, and in what order:\n- the clip stands still: the description has no action. Add a verb and a camera move;\n- the motion is limp, as if in slow motion: that is often the price of a speed-up LoRA. Describe a livelier motion, or make the clip without the speed-up, in twenty steps;\n- the camera moves when it should not: write `static shot`;\n- the face and the figure drift towards the end: too much motion for five seconds. Keep one action or lower `length`;\n- the model does something other than what is written: make that the first sentence and take out everything secondary;\n- the subject changes from clip to clip: describe it in the very same words each time, or start from a picture;\n- everything is off: change `noise_seed` in the first sampler.',
      },
      check: {
        title: 'What the app will tell you',
        body: 'The "Check" button on the top toolbar reads the descriptions of a clip too. It says when a description is empty, when forms of other programs are left in it, when it is not written in English, when the second text does not act because of `cfg` 1, and when the description has none of the words of your LoRA.\n\nThe words of a LoRA and the descriptions its author used are shown in the card of the file in the "Models" tab. For a motion LoRA this matters most: without its words it often does not switch on.',
      },
    },
  },
  wrapper: {
    title: 'Video on WanVideoWrapper',
    result: 'You build a Wan 2.2 graph on the nodes of the WanVideoWrapper pack and see how it differs from the built-in one.',
    steps: {
      intro: {
        title: 'What WanVideoWrapper is',
        body: 'WanVideoWrapper is a pack of nodes by an author called Kijai. It runs the same Wan models as ComfyUI\'s built-in nodes, in its own way. People like it for two things: it can keep a large model in parts, now in the graphics card and now in ordinary memory, and new Wan features appear in it first.\n\nImportant: its nodes do not connect to the built-in ones. The model from its loader has a type of its own, and the `model` input of a built-in sampler will not take it. So a graph is built wholly on one or wholly on the other.\n\nThis lesson repeats "Video from text", only on the pack\'s nodes. If the canvas already holds another graph, start from an empty one: "File ▸ New project".',
      },
      models: {
        title: 'Load two models',
        body: `Add two {high} nodes. In the \`model\` field of one choose the file with \`high_noise\` in its name, in the other the file with \`low_noise\`.\n\nLeave \`quantization\` at \`disabled\`: the node works out the file's format itself. Leave \`load_device\` at \`offload_device\` if the model is larger than the graphics card's memory.\n\n${noFile('the example graph from the pack\'s own `example_workflows` folder')}`,
      },
      'text-encoder': {
        title: 'Load the text reader',
        body: 'Add a {t5} node and choose the `umt5-xxl-enc` file in `model_name`.\n\nThe pack has a text reader of its own. It needs a file from the pack author\'s set, published on Hugging Face in Kijai/WanVideo_comfy. The file from ComfyUI\'s templates may not fit this node: then ComfyUI reports an error when the graph runs.',
      },
      vae: {
        title: 'Load the VAE',
        body: 'Add a {vae} node and choose the `wan_2.1_vae` file in `model_name`.\n\nAs in the built-in graph, the large Wan 2.2 models need the VAE of version 2.1.',
      },
      prompt: {
        title: 'Write the description',
        body: 'Add a {text} node. Connect the output of {t5} to its `t5` input.\n\nHere both texts are in one node: the description of the clip in `positive_prompt`, what must not be there in `negative_prompt`. Write the way "A description for video" shows.',
      },
      embeds: {
        title: 'Set the size and the length',
        body: 'Add an {embeds} node. Set `width` to 832, `height` to 480 and `num_frames` to 81.\n\nThis node takes the place of the empty blank of the built-in graph. 81 frames at 16 frames a second make five seconds.',
      },
      'first-pass': {
        title: 'The first pass',
        body: 'Add a {first} node and connect to it:\n- to `model`, the output of the {high} node with the `high_noise` model;\n- to `text_embeds`, the output of {text};\n- to `image_embeds`, the output of {embeds}.\n\nThere is no separate node for the noise shift here: the sampler\'s own `shift` field sets it.',
      },
      'second-pass': {
        title: 'The second pass',
        body: 'Add a second {second} node and connect to it:\n- to `model`, the `low_noise` model;\n- to `text_embeds` and `image_embeds`, the same outputs as for the first;\n- to `samples`, the `samples` output of the first sampler.\n\nThis way the second sampler receives the unfinished clip and finishes it.',
      },
      split: {
        title: 'Split the steps',
        body: 'Set `steps` to 20 in both samplers. Set `end_step` to 10 in the first and `start_step` to 10 in the second.\n\nThe first does the steps from zero to ten, the second from ten to the end. An `end_step` of -1 means "to the end": with it the first sampler would do everything itself.\n\nThere are no separate noise fields here as in the built-in sampler: the pack knows by itself that the clip came unfinished.',
      },
      guidance: {
        title: 'Strictness and the noise shift',
        body: 'Set `cfg` to 3.5 and `shift` to 8 in both samplers.\n\nThese are the numbers of the built-in graph. The pack\'s sampler starts at `cfg` 6: for Wan 2.2 that is too strict, and the clip burns out.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add a {decode} node. Connect the second sampler\'s output to its `samples` input and the output of {vae} to its `vae` input.',
      },
      save: {
        title: 'Make the clip and save it',
        body: 'Add {video} and {save}. The frames from {decode} go into the `images` input of {video}, and its output into the `video` input of {save}. Set `fps` to 16.\n\nThe pack needs no nodes of its own for saving: the built-in ones do.',
      },
      memory: {
        title: 'When the graphics card runs out of memory',
        body: 'The Wan 2.2 14B model is larger than most graphics cards hold. The pack deals with this so: some blocks of the model stay in ordinary memory and move into the graphics card only when they are needed.\n\nFor that add a WanVideo BlockSwap node and connect its output to the `block_swap_args` input of each model loader. Its blocks_to_swap field is the number of blocks kept outside the graphics card: start at 20 and raise it until the clip stops failing for lack of memory. The larger the number, the slower.\n\nTwo more ways to save memory: a model file in fp8 format, and `quantization` set to `fp8_e4m3fn`.',
      },
      lora: {
        title: 'LoRA in this pack',
        body: 'Here a LoRA does not stand in the model\'s path: it is connected to the loader. Add a WanVideo Lora Select node, choose the file in its `lora` field and connect its output to the `lora` input of the model loader.\n\nEach model gets a node of its own: the `high` file to the loader of the `high_noise` model, the `low` file to the loader of `low_noise`. Several LoRAs are chained: the output of one select node to the `prev_lora` input of the next.\n\nLoRAs for the built-in Wan graph fit here too: they are the same files.',
      },
      trigger: {
        title: 'The LoRA\'s words in the description',
        body: 'If the canvas has a LoRA select node, add the words of its file to the `positive_prompt` field.\n\nThe app compares the description with the words written in the LoRA files on the canvas. If there is no LoRA, or its file holds no words, the step counts on its own.',
      },
      fast: {
        title: 'Fast in four steps',
        body: 'The `lightx2v` speed-up LoRA works in this pack too. Put it to both models through LoRA select nodes, and in the samplers set `steps` to 4, `end_step` to 2 in the first, `start_step` to 2 in the second and `cfg` to 1 in both.\n\nAt `cfg` 1 the text of the `negative_prompt` field does not act.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe "Check" button reads this pack's descriptions too: it says when forms of other programs are left in a text or the second text does not act at \`cfg\` 1.\n\nNext: "Video from a picture on WanVideoWrapper" starts the clip from your picture.`,
      },
    },
  },
  'wrapper-image': {
    title: 'Video from a picture on WanVideoWrapper',
    result: 'A clip made on WanVideoWrapper nodes starts from your picture.',
    steps: {
      intro: {
        title: 'What changes',
        body: 'The graph is the one from "Video on WanVideoWrapper". Three things change: the model files, a node with the picture, and a node that puts the picture at the start of the clip in place of the empty blank.',
      },
      graph: {
        title: 'A WanVideoWrapper graph is needed',
        body: 'This lesson goes on from the graph of "Video on WanVideoWrapper". The canvas must have two {high} loaders, a {vae} node and two {first} samplers, the second taking the result of the first.\n\nIf they are not there, do that lesson first.',
      },
      models: {
        title: 'Models for a picture',
        body: 'In the `model` field of both loaders choose `i2v` files: one with `high_noise` in its name, the other with `low_noise`.\n\nThe `t2v` models do not take a picture. The rest of the graph stays as it is.',
      },
      picture: {
        title: 'Load the picture',
        body: 'Add a {picture} node and choose your picture in its `image` field. The list shows the files of the `input` folder of your ComfyUI.',
      },
      start: {
        title: 'Prepare the start',
        body: 'Add a {start} node and connect to it:\n- to `vae`, the output of {vae};\n- to `start_image`, the `IMAGE` output of {picture}.\n\nSet `width` to 832, `height` to 480 and `num_frames` to 81. Proportions like those of the picture work best.',
      },
      wire: {
        title: 'Connect the start to the samplers',
        body: 'Connect the `image_embeds` output of {start} to the `image_embeds` input of both samplers.\n\nThe old links from the empty blank come off by themselves. The empty blank node can be deleted after that.',
      },
      motion: {
        title: 'How to get more motion',
        body: 'If the clip hardly moves, {start} has two fields that change that:\n- `noise_aug_strength`: a little noise over the picture, for example 0.02, gives the model freedom to move;\n- `start_latent_strength`: a value below 1, for example 0.8, holds the first frame less.\n\nChange one field at a time. Values too large take the clip away from the picture.\n\nThe node also has an `end_image` input: a picture for the last frame. It needs models trained for it. The model\'s page says whether it can.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe description of a clip from a picture says what changes, not what is already seen. More on this in "A description for video".`,
      },
    },
  },
  'two-models': {
    title: 'Two models in one graph',
    result: 'A picture model draws the first frame and Wan brings it to life. Each has its own LoRAs and its own description.',
    steps: {
      intro: {
        title: 'Why join models',
        body: 'Each model is strong at its own thing. A picture model keeps looks, style and composition more exactly, and it has the most LoRAs. A video model can move things. In one graph the first draws a frame and the second brings it to life.\n\nEach model has a set of its own: its file, its text reader, its VAE and its LoRAs. The parts of one set do not fit another. A text read for one model is not understood by another.\n\nWhat passes between models is a picture. A picture is plain pixels, and any model understands it. In this lesson you build a second model onto the video graph and lead a picture from it.',
      },
      'video-graph': {
        title: 'A video-from-a-picture graph is needed',
        body: 'This lesson goes on from the graph of "Video from a picture". The canvas must have {clip} and {vae}, two texts connected to {start}, and a {decode} node at the end.\n\nIf they are not there, do that lesson first.',
      },
      'image-model': {
        title: 'Add a picture model',
        body: 'Add a {checkpoint} node and choose in `ckpt_name` the model that will draw the first frame.\n\nThis is the second model of the graph. It has nothing to do with Wan: it has its own `MODEL`, `CLIP` and `VAE` outputs, and from here on they go only to its own nodes.',
      },
      'image-texts': {
        title: 'Give it texts of its own',
        body: 'Add two new {imagePositive} nodes and connect the `CLIP` output of {checkpoint} to the `clip` input of each. In the `text` field of one describe the frame: who is in it, where, what the light is.\n\nThe texts of the video will not do: they were read for Wan. Each model has text nodes of its own, connected to its own text reader.\n\nWrite in the manner of this model. How to tell it is shown in "The description: how a model reads it".',
      },
      'image-sampler': {
        title: 'Build the part that draws the frame',
        body: 'Add {imageLatent} and {imageSampler}. Connect to the inputs of {imageSampler}:\n- to `model`, the `MODEL` output of {checkpoint};\n- to `positive` and `negative`, the two new texts;\n- to `latent_image`, the output of {imageLatent}.\n\nThis is the graph of "A first picture from text", only it stands next to the video graph.',
      },
      size: {
        title: 'The size of the frame',
        body: 'The frame must have the proportions of the clip. The {start} node brings the picture to its own `width` and `height` by itself, but when the proportions differ it cuts the edges off.\n\nThe exact size may be another one: draw the frame at the size the model was trained at. For a clip of 832 by 480, in {imageLatent} these fit:\n- for SDXL, Pony, Illustrious: `width` 1344 and `height` 768;\n- for SD 1.5: `width` 832 and `height` 480.\n\nFor an upright clip swap the numbers in both nodes.',
      },
      bridge: {
        title: 'Lead the picture to the video',
        body: 'Add one more {imageDecode} node. Connect the output of {imageSampler} to its `samples` input and the `VAE` output of {checkpoint} to its `vae` input. Connect its `IMAGE` output to the `start_image` input of {start}.\n\nThis is the bridge between the models. The link that went into `start_image` before comes off by itself: the node with the loaded picture can be deleted.\n\nA frame is unfolded by the VAE of the model that drew it. The VAE of Wan will not do here.',
      },
      look: {
        title: 'Save the frame itself too',
        body: 'Add a {frame} node and connect the same `IMAGE` output of {imageDecode} to its `images` input.\n\nThis lets you see the frame apart from the clip. When a clip fails, it is clear at once where the fault is: in the frame or in the motion.',
      },
      descriptions: {
        title: 'Two descriptions, each with its own job',
        body: 'The graph now has two descriptions. The first, for the picture model, says what is in the frame: the subject, the clothes, the place, the light, the style. The second, for Wan, says what changes: the motion and the camera.\n\nDo not carry one over into the other. Words about motion in the description of a frame mean nothing to a picture model. And details of looks in the description of a clip argue with the finished frame.\n\nThe second texts, those for the `negative` input, differ too: each model has defects of its own.',
      },
      loras: {
        title: 'LoRA: each in the path of its own model',
        body: 'A LoRA is made for one family of models. It goes into the path of the model it was made for:\n- a LoRA for the picture model: between {checkpoint} and {imageSampler}. If the LoRA node also has a `CLIP` input and output, connect the texts of the frame to its `CLIP` output;\n- a LoRA for Wan: between the loader of each of its two models and the node that sets the noise shift, as in "LoRA: add a style or a subject".\n\nA LoRA put into the wrong path does nothing. ComfyUI does not stop at it: it silently skips what did not fit.\n\nThe words of a LoRA go into the description of the same model. The words of a picture LoRA go into the description of the frame, the words of a Wan LoRA into the description of the clip.\n\nA handy division: looks and style come from the LoRAs of the picture model, motion from the LoRAs of the video model. Which family a file belongs to is shown by its card in the "Models" tab. The "Check" button says when models of different families meet in one path.',
      },
      memory: {
        title: 'Two models and memory',
        body: 'ComfyUI loads the models in turn: first the one that draws the frame, then Wan. If the graphics card has no room for both, it unloads the first by itself. So a graph with two models runs on the same card as each of them alone, only longer.\n\nComfyUI works out again only what has changed. As long as the part with the frame is untouched, the next run takes the finished frame and goes straight to the video.\n\nTo keep the frame from changing by itself, fix the number in the `seed` field of {imageSampler}: in ComfyUI set the `control_after_generate` switch under it to `fixed`. Otherwise the number changes at every run, the frame is drawn anew, and the clip starts from another picture each time.\n\nGet a good frame first, then work on the motion. While you look for the frame, the node that saves the clip can be switched off in ComfyUI: select it and press Ctrl+M. Then only the frame is worked out.',
      },
      approaches: {
        title: 'Other ways to combine models',
        body: 'A picture from one model to another is the most general way. There are three more.\n\nA refining pass. The second model does not draw from nothing: it redraws a finished picture on top, changing it only in part. This takes the composition from one model and the texture from another. "Refining with a second model" shows it.\n\nPassing without a picture. Models of one family understand each other\'s compressed form, and it can be passed between them directly, from a `LATENT` output. SDXL and its descendants work this way, and so do the two Wan 2.2 models of the video lessons: the first lays out, the second finishes.\n\nTwo graphs instead of one. The frame is drawn and picked in one graph, and the video is made in another from the saved picture. This is simpler and safer when many frames have to be tried.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try:\n- another frame: change \`seed\` in {imageSampler};\n- the same frame, another motion: change \`noise_seed\` in the first sampler of the video, or the description of the clip;\n- another style of frame: change the picture model or its LoRAs. The video part need not change.`,
      },
    },
  },
};
