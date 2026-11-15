/**
 * The words of the lessons, English; texts.ts reads them for the lesson panel. This file holds the first lessons and
 * spreads in the English words of the image-models, image-techniques, sound-3d-faces and experiments sets. Each step: what to do
 * and why. `{role}` in a text is replaced by the name of the node as this ComfyUI's library shows it. Field names
 * and values stand in backticks: the person looks for them on the node.
 *
 * The lessons on adult content (pictures and video) teach technique. There are no explicit texts, no ready scene
 * descriptions and no lists of words here, and there will be none: a model's words come from its author's page. The
 * rules in their first step come from one place (shared/content/rules.ts), the same one Settings and Help show.
 */
import type { LessonWords } from './texts';
import { IMAGE_MODEL_TEXTS_EN } from './sets/image-models.texts.en';
import { IMAGE_TECHNIQUES_EN } from './sets/image-techniques.texts.en';
import { SOUND_3D_FACES_EN } from './sets/sound-3d-faces.texts.en';
import { EXPERIMENTS_EN } from './sets/experiments.texts.en';
import { RELIABLE_EN } from './sets/reliable-practice.texts.en';
import { ENVIRONMENT_EN } from './sets/environment.texts.en';
import { contentRulesMarkdown } from '../content/rules';

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
  title: 'Put the LoRA\'s words into the prompt',
  body: 'Add your LoRA\'s words to the `text` field of the {positive} node whose output goes into a `positive` input.\n\nThe app compares the prompt with the words written in the LoRA file itself. If its author wrote none there, there is nothing to compare with and the step counts on its own.',
};

/** The English words by lesson id, the sets that texts.ts does not join itself included. */
export const LESSONS_EN: Record<string, LessonWords> = {
  ...IMAGE_MODEL_TEXTS_EN,
  ...IMAGE_TECHNIQUES_EN,
  image: {
    title: 'A first picture from text',
    result: 'You build a graph of seven nodes that draws a picture from a prompt.',
    steps: {
      intro: {
        title: 'How a graph works',
        body: 'A graph reads from left to right. Each node does one thing, and the lines between nodes, the links, carry the result on.\n\nThis lesson has seven nodes: the model loader, two texts, a blank, the sampler, the turn into a picture and the saving.\n\nA node is added by a double click in the library on the left or with the "Node" button on the canvas toolbar. You build. The app watches the canvas and ticks a step off when it is done.\n\nIf the canvas already holds another graph, start from an empty one: "File ▸ New project".',
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
        body: 'Add a {latent} node. Its `width` and `height` fields set the size of the picture.\n\nThe size follows the model. SD 1.5 was trained on pictures of 512 by 512, SDXL and the models built on it, Pony and Illustrious, on 1024 by 1024. At another size a model draws worse: it repeats figures and breaks the composition. The app tells you when the size is far from your model\'s.\n\nThe model does not draw on a clean sheet. It starts from noise of this size and removes it step by step.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node.\n\nThis is the main node of the graph: here noise becomes an image. Everything you have added so far meets in it.',
      },
      'sampler-links': {
        title: 'Bring four links to the sampler',
        body: 'Connect to the inputs of {sampler}:\n- to `model`, the `MODEL` output of {checkpoint};\n- to `positive`, the output of the node with your prompt;\n- to `negative`, the output of the other text node;\n- to `latent_image`, the output of {latent}.\n\nIf `positive` and `negative` are swapped, the model avoids what you described.',
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
        body: `${SAVE}\n\nWhat to try in the sampler:\n- \`seed\`: another number gives another picture from the same prompt;\n- \`steps\`: more steps, a cleaner picture and a longer wait. 20-30 is usually enough;\n- \`cfg\`: how strictly the model follows the text. Usually 5-8.`,
      },
    },
  },
  'video-text': {
    title: 'Video from text',
    result: 'You build a Wan 2.2 graph that makes a five-second clip from a prompt.',
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
        title: 'Write the prompt',
        body: 'Add two {positive} nodes and connect the output of {clip} to the `clip` input of each. In the `text` field of one describe the clip: what is in the frame, what happens, how the camera moves. The other is for what must not be there.\n\nFor video the action matters. "A person walks along a beach, the camera follows from the side" works better than "a person on a beach".',
      },
      shift: {
        title: 'Set the noise shift',
        body: 'Add two {shiftHigh} nodes. Pass the first model through one and the second through the other: the loader\'s `MODEL` output to the `model` input. Set `shift` to 8 in both.\n\nThis number changes how much noise is left at each step. With a small value Wan holds composition and motion worse, and the clip comes out sluggish.\n\nThe SD3 in the node\'s name is left from another model: Wan is set up with the same node.',
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
        body: 'Here the clip starts from your picture. The prompt no longer says what is in the frame but what happens in it.\n\nThe graph is almost the one from "Video from text". If it is on your canvas, most steps are already done and the app goes straight to the new ones.\n\nThree things change: the model files, a node with the picture and a node that prepares the start.',
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
        body: `${SAVE}\n\nIf the clip stands still, add action and camera motion to the prompt. If a figure or a face drifts towards the end, shorten \`length\` or describe a calmer motion.`,
      },
    },
  },
  lora: {
    title: 'LoRA: add a style or a subject',
    result: 'You connect a LoRA to both models and put its words into the prompt.',
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
        body: 'Choose a file in `lora_name`. The node in the path of the `high_noise` model takes the `high` file, the one in the path of `low_noise` the `low` file. If the LoRA is a single file, put it into both nodes.\n\n`strength_model` is the strength. 1 means full strength. If the LoRA overrides everything else or spoils the picture, lower it to 0.6-0.8.\n\nSeveral LoRAs are chained: the output of one LoRA node to the input of the next.',
      },
      'trigger-words': {
        title: 'The words that switch a LoRA on',
        body: 'Many LoRAs act only when the prompt holds their words. These are called trigger words.\n\nOpen the card of the file in the "Models" tab: if the author wrote these words into the file, they are shown there. If they are not, look at the page you took the LoRA from.',
      },
      trigger: TRIGGER,
      result: {
        title: 'The LoRA is connected',
        body: 'Run the graph in ComfyUI and compare with the clip without the LoRA.\n\nIf nothing changed, check three things: the file fits the model, the trigger words are in the prompt, the strength is not too low.',
      },
    },
  },
  'video-fast': {
    title: 'Fast video in four steps',
    result: 'You cut twenty steps down to four with a speed-up LoRA.',
    steps: {
      intro: {
        title: 'Where the speed comes from',
        body: 'A speed-up LoRA teaches the model to do in four steps what usually takes twenty. The best known one for Wan is called `lightx2v`.\n\nThe price: less variety and slightly rougher motion. For trying things out and finding the right prompt it nearly always pays: the clip is ready several times sooner.',
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
        body: 'The clip is made several times sooner.\n\nOnce the prompt is right you can go back to twenty steps for quality: take the speed-up LoRAs out and set `steps` back to 20, `cfg` to 3.5 and the hand-over to step 10.',
      },
    },
  },
  'adult-image': {
    title: 'Pictures for adults: what changes',
    result: 'You learn what the content of a picture depends on and check your graph.',
    steps: {
      rules: {
        title: 'First, the rules',
        body: contentRulesMarkdown('en'),
      },
      levers: {
        title: 'The technique is the same',
        body: 'The graph for such a picture is the one from "A first picture from text". What comes out is decided by three things:\n- the model: what it can draw at all;\n- the LoRA: what it was taught on top of that;\n- the prompt: what you asked for.\n\nEach in turn below.',
      },
      graph: {
        title: 'A picture graph is needed',
        body: 'This lesson goes on from the graph of "A first picture from text". The canvas must have {checkpoint}, two {positive} nodes, {sampler}, {decode} and {save}, connected as in that lesson.\n\nIf they are not there, do that lesson first.',
      },
      families: {
        title: 'The model and its family',
        body: 'Base models for pictures were mostly trained without such material. Left to itself such a model draws it badly: it muddles anatomy and drifts off the subject.\n\nSo people take a further-trained (fine-tuned) model of the family they need, or a LoRA made for that family. Through {checkpoint}, as one file, load SD 1.5, SDXL and two lines further trained from SDXL: Pony and Illustrious.\n\nFiles of different families do not mix: a LoRA for SD 1.5 does not work with an SDXL model. Pony and Illustrious are technically SDXL, but LoRAs made for them work best with them.\n\nThe card of a file in the "Models" tab shows which family it belongs to. The app downloads nothing: it works with the files already in your ComfyUI.',
      },
      readers: {
        title: 'Tags or phrases, and the author\'s words',
        body: 'SD 1.5, SDXL, Pony and Illustrious read a prompt as tags separated by commas. Models such as Flux.1 read plain phrases. "The prompt: how a model reads it" goes through this in detail.\n\nA further-trained model was taught with words of its own. On the model\'s page its author writes which quality words and which rating words it was trained with, and where they go. Without them such a model often works worse than it could.\n\nIn the app this is in the model\'s card in the "Models" tab: the author\'s notes, the trigger words and the example prompts the author used. The examples an author marked as adult content open with the switch "Adult content (18+)".\n\nTake the words from there: each model has its own, and the lesson lists none.',
      },
      lora: {
        title: 'LoRA: strength, several, words',
        body: 'A LoRA node goes between {checkpoint} and the rest of the graph: `MODEL` and `CLIP` go into it, and its outputs go where the model\'s outputs went.\n\nThe strength is set in `strength_model` and `strength_clip`. Start from the one the author gives, usually 0.6-1. Too much strength breaks the picture.\n\nSeveral LoRAs are chained, one after another. Their effects add up, so give each less than you would give it alone. All of them must be made for the family of your model.\n\nMany LoRAs have trigger words: without them the LoRA barely acts. The card of the file shows them.',
      },
      trigger: {
        title: 'The LoRA\'s words in the prompt',
        body: 'If the graph has a LoRA, add its words to the `text` field of the {positive} node whose output goes into the `positive` input of {sampler}.\n\nThe app compares the prompt with the words written in the LoRA files on the canvas. If the graph has no LoRA, or its author wrote no words into the file, there is nothing to compare with and the step counts on its own.',
      },
      negative: {
        title: 'The second text: defects',
        body: 'The second {positive} node, the one that goes into `negative`, lists defects: distorted hands, extra fingers, blur, watermarks. The author of a model often gives a text for this field on the model\'s page: start from it.\n\n"No" and "without" in the main prompt do not work: what must not be there is written here. At `cfg` 1 this text does not act.',
      },
      size: {
        title: 'The size for the family',
        body: 'Each family was trained at its own size. Far from it the picture breaks: figures double, extra hands appear.\n- SD 1.5: about 512 on the short side, for example 512 × 768;\n- SDXL, Pony and Illustrious: about 1024 × 1024 in area, for example 832 × 1216 or 1216 × 832.\n\nThe size is set in the `width` and `height` fields of the blank. For a larger picture, make it at the native size first, then enlarge it.',
      },
      defects: {
        title: 'If the result is poor',
        body: 'What to change, and in what order:\n- the subject does not appear: check that the model or the LoRA is made for this family, and that the prompt has the trigger words and the words the author recommends;\n- anatomy drifts: lower `strength_model` of the LoRA to 0.6-0.8, remove extra LoRAs, check the size;\n- the picture is burnt out: lower `cfg` to the value the author recommends, usually 4-7;\n- small defects: add them to the second text;\n- everything is off: change `seed`. Some pictures simply fail by chance.',
      },
      helper: {
        title: 'About the assistant in the app',
        body: 'The lessons work without an assistant model. Questions in "Ask" mode go to the model you chose.\n\nThe assistant helps with graph construction and technical choices. Each provider or local model responds according to its own rules and capabilities. The rules at the start of this lesson are the app\'s own and hold whatever a model answers.\n\nThe assistant is sent the graph with the values of its fields, your prompts among them. It does not see your pictures. Sending values can be switched off in "Settings ▸ Privacy".',
      },
    },
  },
  'adult-lora': {
    title: 'Adult LoRAs: how to load and balance them',
    result: 'You load your own LoRA, check which model it fits and learn to balance two LoRAs.',
    steps: {
      rules: {
        title: 'First, the rules',
        body: contentRulesMarkdown('en'),
      },
      files: {
        title: 'Where the files go',
        body: 'LoRAs for adult content work like any other: small files that teach a model one subject, a body, a character or a style. The files and the words in this lesson are yours: the lesson shows where to look and where to type, and names no file and no word.\n\nA LoRA file goes into the `models/loras` folder of your ComfyUI. Then choose "Sync ▸ Sync now" here, and the file appears in the "Models" tab. The app itself downloads nothing.',
      },
      graph: {
        title: 'A picture graph is needed',
        body: 'This lesson goes on from the graph of "A first picture from text". The canvas must have {checkpoint}, two {positive} nodes, {sampler}, {decode} and {save}, connected as in that lesson.\n\nIf they are not there, do that lesson first.',
      },
      add: {
        title: 'Put the LoRA between the model and the graph',
        body: 'Add a {lora} node and choose your file in `lora_name`. This is also how ComfyUI\'s official example loads a LoRA.\n\nConnect:\n- the `MODEL` and `CLIP` outputs of {checkpoint} to the `model` and `clip` inputs of {lora};\n- the `MODEL` output of {lora} to the `model` input of {sampler};\n- the `CLIP` output of {lora} to the `clip` input of both {positive} nodes.\n\nNow the model and the reading of the text go through the LoRA.',
      },
      family: {
        title: 'Does the file fit the model',
        body: 'A LoRA works only with the family it was trained for: an SDXL LoRA does not work with SD 1.5, and Pony and Illustrious work best with LoRAs made for them.\n\nWhere to see it:\n- in the card of the file in the "Models" tab: the family its author wrote down, and how that is known;\n- on the author\'s page of the file: the base model and the version it was made for.\n\nCompare it with the card of the model in {checkpoint}. If the families differ, take another file: strength cannot fix that.',
      },
      trigger: {
        title: 'The LoRA\'s words in the prompt',
        body: 'Many LoRAs have trigger words: without them the LoRA barely acts. The author writes them on the page of the file, and the app shows them in the card of the file. Read them there and type them yourself into the `text` field of the {positive} node whose output goes into the `positive` input of {sampler}.\n\nThe app compares the prompt with the words written in the file. If the author wrote none, there is nothing to compare with and the step counts on its own.',
      },
      strength: {
        title: 'Two strengths',
        body: 'The {lora} node has two strengths:\n- `strength_model`: how much the LoRA changes what the model draws;\n- `strength_clip`: how much it changes how the model reads the prompt.\n\nStart from the strength the author recommends, usually 0.6-1, and set both the same. If the LoRA follows the words too much or too little, change `strength_clip`. If it breaks the picture, lower `strength_model`.',
      },
      compare: {
        title: 'Comparing on one seed',
        body: 'To see what a file does, change only that file. Note the number in the sampler\'s `seed` field and keep it while you compare.\n\nMake a picture in ComfyUI with `strength_model` 0, then with the author\'s recommendation, then higher. The prompt and every other field stay the same. The difference between the pictures is what the LoRA does.',
      },
      two: {
        title: 'Two LoRAs: a body and a character',
        body: 'Several LoRAs are chained: the second {lora} node takes `MODEL` and `CLIP` from the first. A LoRA that teaches a body or anatomy and a character LoRA often each pull the face their own way: each was trained on its own pictures.\n\nHow to hold the face:\n- tune the strengths one at a time: first one LoRA, then the other, on one `seed`;\n- lower the strength of the body LoRA;\n- put the character LoRA last in the chain;\n- if the face still drifts, fix it with a separate pass over the face. Node packs have nodes for it, Impact Pack for example. You install the pack yourself in ComfyUI.',
      },
      fight: {
        title: 'When two LoRAs fight',
        body: 'Two LoRAs that teach different subjects can fight: the picture comes out smeared or like neither. Their effects add up.\n\nWhat to do:\n- lower both, for example to 0.5-0.7 each;\n- split them between passes: one in the first pass, the other in the second, as in "Refining with a second model";\n- for different parts of a picture, node packs have mask and region nodes. That is harder, and the lesson does not cover it.',
      },
      helper: {
        title: 'About the assistant in the app',
        body: 'The lesson works without an assistant model. Questions in "Ask" mode go to the model you chose.\n\nThe assistant helps with graph construction and technical choices. Each provider or local model responds according to its own rules and capabilities. The rules at the start of this lesson are the app\'s own and hold whatever a model answers.\n\nThe assistant is sent the graph with the values of its fields, your prompts among them. Sending values can be switched off in "Settings ▸ Privacy".',
      },
    },
  },
  adult: {
    title: 'Video for adults: what changes',
    result: 'You learn what the content of a clip depends on and check your graph.',
    steps: {
      rules: {
        title: 'First, the rules',
        body: contentRulesMarkdown('en'),
      },
      levers: {
        title: 'The technique is the same',
        body: 'The graph for such a clip is the one from the video lessons. What ends up in the frame is decided by three things:\n- the model: what it can draw at all;\n- the LoRA: what it was taught on top of that;\n- the prompt: what you asked for.\n\nEach in turn below.',
      },
      model: {
        title: 'What the model can do',
        body: 'Most open models were trained on material with few explicit scenes or none. Left to itself such a model draws them badly: it muddles anatomy and drifts off the subject.\n\nThis is put right in two ways: a further-trained version of the model, or a LoRA for the subject. Either must fit your model: the files for `t2v` and for `i2v` differ, and the size of the model must match: 14B with 14B, 5B with 5B. Many LoRAs for Wan 2.1 14B, the common four-step speed-up ones among them, also work with Wan 2.2 14B. When the page of a LoRA for Wan 2.2 says which of the two passes it was made for, put it into that pass.\n\nThe app downloads nothing. It works with the files already in your ComfyUI and shows in the card of a file which model it belongs to.',
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
      'pair-loras': {
        title: 'LoRAs for the two passes',
        body: 'A LoRA for Wan 2.2 14B often comes as a pair of files: one for the first pass, one for the second. The names usually show it: `high` and `low`, or `high_noise` and `low_noise`. The `high` file goes into the path of the first-pass {high} node, the `low` file into the path of the second {high} node. If the author gives one file, it goes into both paths. If the LoRA\'s page says it is for one pass, put it only there.\n\nA speed-up LoRA and a subject LoRA stand in one path as a chain. Keep the speed-up one at the strength its author recommends, usually 1. Tune the subject LoRA separately, on one `noise_seed`: start from the author\'s recommendation and change it in steps of 0.1-0.2.',
      },
      anchor: {
        title: 'The anchor picture and a LoRA',
        body: 'In a clip from a picture, the looks come from the start picture, and the LoRA adds what it was taught. If the picture was made by a picture model with its own LoRA, the video needs its own LoRA made for Wan: files for picture models do not fit Wan.\n\nIf a video LoRA pulls the looks away from the picture, lower its strength: then the picture holds the looks. How to work with an anchor picture is shown in "The start picture is the anchor" and "A reference for the whole clip: Wan VACE".',
      },
      prompt: {
        title: 'How to write the prompt',
        body: 'Describe the scene in plain words and in order: who is in the frame, what happens, where, how the camera moves, what the light is. Say plainly that the people in the frame are adults.\n\nThe model draws what is named. What the prompt leaves out it makes up itself, not always well.\n\nThe text for the `negative` input lists defects: distorted hands, extra fingers, blur. At `cfg` 1 this text does not act.',
      },
      trigger: {
        title: 'The LoRA\'s words in the prompt',
        body: 'If the graph has a LoRA, add its words to the `text` field of the {positive} node whose output goes into a `positive` input.\n\nThe app compares the prompt with the words written in the LoRA files on the canvas. If the graph has no LoRA, or its author wrote no words into the file, there is nothing to compare with and the step counts on its own.',
      },
      defects: {
        title: 'If the result is poor',
        body: 'What to change, and in what order:\n- anatomy drifts: lower `strength_model` of the LoRA to 0.6-0.8 or shorten `length`;\n- the subject does not appear: check the trigger words and that the file fits the model;\n- the clip is burnt out: with a speed-up LoRA, and with a model that has the speed-up built in, `cfg` must be 1;\n- the motion jerks: describe a calmer motion and check that `fps` is 16;\n- everything is off: change `noise_seed` in the first sampler. Some clips simply fail by chance.',
      },
      helper: {
        title: 'About the assistant in the app',
        body: 'The lessons work without an assistant model. Questions in "Ask" mode go to the model you chose.\n\nThe assistant helps with graph construction and technical choices. Each provider or local model responds according to its own rules and capabilities. The rules at the start of this lesson are the app\'s own and hold whatever a model answers.\n\nThe assistant is sent the graph with the values of its fields, your prompts among them. It does not see your clips. Sending values can be switched off in "Settings ▸ Privacy".',
      },
    },
  },
  prompt: {
    title: 'The prompt: how a model reads it',
    result: 'You learn what a model does with text and how to steer a picture with words.',
    steps: {
      intro: {
        title: 'What a model does with text',
        body: 'A model does not understand text the way a person does. It was trained on pictures with captions and remembers which words stood next to which pictures. Your prompt pulls the result towards captions like it.\n\nThree things follow:\n- a word that was not in the captions does nothing, however exact it sounds;\n- a prompt is not an order: each word pulls its own way, and strong words outpull weak ones;\n- what you leave unsaid the model decides for itself.\n\nNext you take a prompt apart, piece by piece, on your own graph.',
      },
      graph: {
        title: 'A picture graph is needed',
        body: 'This lesson goes on from the graph of "A first picture from text". The canvas must have two {positive} nodes connected to the `positive` and `negative` inputs of {sampler}.\n\nIf they are not there, do that lesson first.',
      },
      readers: {
        title: 'Two ways of reading',
        body: 'The text is read by a separate part of the model: it turns words into numbers. There are two kinds of this part, and one writes for them differently.\n\nThe first kind reads words and short phrases separated by commas. SD 1.5, SDXL and the models built on them, Pony and Illustrious, work this way. A prompt that suits them: `portrait of a woman, red coat, night street, rain, soft light`.\n\nThe second kind reads whole sentences and understands who does what and what is where. Flux, SD 3, Qwen-Image and Wan work this way. A prompt that suits them: `A woman in a red coat stands on a night street in the rain. Soft light from a shop window falls on her face.`\n\nWhich kind your model is shows in its card in the "Models" tab: the line "Family". Most models were trained on English captions: write in English.',
      },
      order: {
        title: 'Order and length',
        body: 'Words at the start of a prompt weigh more than words at the end. So the main thing goes first: who or what is in the frame, then what happens, then the place, the light and the style.\n\nLength matters too. Models of the first kind read text in chunks of 75 tokens. A token is a word or a piece of one, so 75 tokens come to about 50 English words. Whatever comes after falls into the next chunk and holds together with the start less well. Models of the second kind read a long prompt whole, up to a few hundred tokens, yet they too keep a weaker hold on what stands at the very end.\n\nExtra words are not harmless: each takes attention away from the rest. Ten exact words work better than forty random ones.',
      },
      write: {
        title: 'Rewrite the prompt',
        body: 'In the `text` field of the {positive} node that goes into the `positive` input write the prompt anew: the main thing first, then the action, the place, the light. At least 40 characters are needed.\n\nAn example for a model of the first kind: `portrait of a woman, red coat, night street, rain, soft light`.',
      },
      weights: {
        title: 'Weight: how to stress what matters',
        body: 'When the model misses something of the prompt, that thing can be given more weight. In ComfyUI a weight is written like this: `(red coat:1.2)`. The words in the parentheses get a pull of 1.2 instead of the usual 1. A number below 1 weakens: `(rain:0.8)`.\n\nKeep a weight between 0.5 and 1.5. Above that a picture burns out and distorts. 1.1-1.3 is enough most of the time.\n\nThe forms of other programs do not work in ComfyUI. `<lora:name:1>` connects nothing: a LoRA is added with a node of its own. `BREAK`, `AND` and square brackets are read by the model as plain characters. Prompts from other people\'s pages are often full of such forms: take them out.\n\nThree forms ComfyUI understands itself. Besides the weight these are `embedding:name` for the files of the `embeddings` folder, and curly braces: of the options written in them with a vertical bar between, one is taken at each run. Plain parentheses that must stay in the text are written with a backslash: `\\(` and `\\)`.\n\nOn models of the second kind a weight acts weakly and unpredictably. For them what matters is said in words and put at the start.',
      },
      weigh: {
        title: 'Stress one thing',
        body: 'In the same `text` field put the most important thing into parentheses and give it a weight: for example `(red coat:1.2)`. The weight must be between 0.5 and 1.5 and other than 1.\n\nIf your model is of the second kind, do not expect a strong effect. The step is there so that you remember the form: you will meet it in other people\'s prompts.',
      },
      negative: {
        title: 'The second text: what must not be there',
        body: 'The text that goes into the `negative` input works differently from the first. At every step the model makes two sketches: one from your prompt and one from the second text. Then it moves away from the second sketch towards the first.\n\nSo the second text names the very things to move away from: `blurry, extra fingers, watermark, text`. There is no need to write "no" there.\n\nIn the main prompt negations do harm. Write `no hat` and a hat will most likely appear: the word `hat` pulls towards hats, and `no` weighs next to nothing. Whatever must not be there goes into the second text.\n\nA long second text is not better than a short one. Name what really creeps into your pictures.',
      },
      'negative-text': {
        title: 'Fill in the second text',
        body: 'In the `text` field of the node that goes into the `negative` input list two or three defects separated by commas. For example: `blurry, extra fingers, watermark`.\n\nThen compare the pictures with this text and without it.',
      },
      cfg: {
        title: 'cfg: how strictly to follow the text',
        body: 'The `cfg` field of the sampler sets how far the model moves from the second sketch towards the first. The larger the number, the more strictly it follows the prompt.\n\nToo small a value gives a limp picture that follows the text poorly. Too large a value gives burnt colours and harsh outlines.\n\nUsual values:\n- SD 1.5: 7-8;\n- SDXL, Pony, Illustrious: 5-7;\n- speeded-up models and speed-up LoRAs: 1-2;\n- Flux: 1. Its strictness is set by a separate node, not by this field.\n\nAt `cfg` 1 the second sketch is not made at all. The text of the `negative` input then does nothing, whatever it says. The author gives the exact numbers on the model\'s page: start from those.',
      },
      seed: {
        title: 'seed: one change at a time',
        body: 'The `seed` field sets the noise a picture starts from. The same number with the same settings and the same prompt gives the same picture.\n\nThis is used to see what a change did. Keep `seed` as it was, change one thing in the prompt and compare. If the number and the words change together, there is no telling which of them acted.\n\nIn ComfyUI a switch named `control_after_generate` stands under the `seed` field. With `randomize` the number changes after every run, with `fixed` it stays.\n\nOnce the prompt is ready, change `seed` to get different pictures from one prompt. Some of them simply fail by chance: that is normal.',
      },
      problems: {
        title: 'When the picture does not obey',
        body: 'What to check, and in what order:\n- the model misses part of the prompt: move that part nearer the start, take out extra words, raise its weight to 1.2-1.3;\n- colours and details are mixed up between objects: models of the first kind read words with no ties between them. Describe each object in a phrase of its own and take out extra colours;\n- the picture is burnt out: `cfg` is too high, or a weight is above 1.5;\n- the picture is dull and limp: `cfg` is too low, or `steps` is too few;\n- extra arms, two heads, doubled figures: the size is larger than the one the model was trained at. For SD 1.5 that is 512, for SDXL 1024;\n- the second text changes nothing: check that `cfg` is above 1;\n- nothing helps: change `seed`. Then check in the model\'s card that the prompt is written in its manner.',
      },
      check: {
        title: 'The app reads prompts with you',
        body: 'The "Check" button on the top toolbar reads the prompts of a graph the way ComfyUI will. It says when forms of other programs are left in a text, the parentheses do not match, a weight is too high, the same thing stands in both texts, or the second text does not act because of `cfg` 1. These are advice, not errors: the graph runs with them too.\n\nThe card of a model in the "Models" tab shows what its author wrote down: the words that switch a LoRA on, the strength the author advises, and the prompts the author\'s own examples were made from. Someone else\'s prompt that worked is the best textbook: copy it and change one thing at a time.',
      },
    },
  },
  refine: {
    title: 'Refining with a second model',
    result: 'A second model redraws a finished picture: the composition comes from the first, the texture and style from the second.',
    steps: {
      intro: {
        title: 'What refining is',
        body: 'One model follows a prompt better and builds the composition. Another is better at skin, cloth or a style of its own. Refining takes the best of both: the first model draws a picture, the second redraws it on top.\n\nThe second model does not start from pure noise. Some noise is added to the finished picture, and the model removes it in its own way. The more noise is added, the more the picture changes.\n\nIn this lesson you build a second model onto a picture graph.',
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
        body: 'Add two new {positiveB} nodes and connect the `CLIP` output of the second model to the `clip` input of each. In the `text` field of one describe the same picture in the manner the second model understands.\n\nThe texts of the first model must not be connected here: another model read them. The prompt can be copied when both models read alike, and must be rewritten when they do not.',
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
        body: 'Each model has LoRAs of its own. A LoRA of the first model goes between the first {checkpoint} node and the first sampler, a LoRA of the second between the second {checkpointB} node and the second sampler.\n\nThe words of a LoRA go into the prompt of the model in whose path it stands.\n\nIf a LoRA sets the subject in the first pass and the second pass blurs it, lower `denoise`, or put into the second path a LoRA of the same subject made for the second model.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhat to try:\n- \`denoise\` 0.3 and 0.5: how much the second model changes the picture;\n- swap the models: which one builds the composition better, and which one finishes.\n\nIf a video follows the picture, connect the \`IMAGE\` output of the new {decodeB} to the \`start_image\` input: the clip then starts from the refined picture.`,
      },
    },
  },
  'prompt-video': {
    title: 'A prompt for video',
    result: 'You learn to describe a clip so that the model understands the motion and the camera.',
    steps: {
      intro: {
        title: 'How the prompt of a clip differs',
        body: 'Video models read whole sentences. Wan 2.2 was trained on long, detailed captions, so it understands a short prompt worse than a long one: what is left unsaid it makes up itself, and the clip comes out at random.\n\nA picture needs an answer to "what is in the frame". A clip also needs "what changes": who moves, where, how fast, and what the camera does. What is not said either stands still or moves any old way.\n\nWan understands English and Chinese. Weights in parentheses hardly act on it: what matters is said in words.',
      },
      graph: {
        title: 'A video graph is needed',
        body: 'This lesson goes on from the graph of "Video from text" or "Video from a picture". The canvas must have a {positive} node whose output goes into a `positive` input.\n\nIf it is not there, do one of those lessons first.',
      },
      structure: {
        title: 'What a prompt is made of',
        body: 'A good prompt of a clip answers five questions, usually in this order:\n- who or what is in the frame, and what it looks like;\n- what happens: one action;\n- where it happens;\n- what the camera does;\n- what the light and the mood are.\n\nAn example: `A young woman in a red coat walks slowly along a wet city street at night. Neon signs reflect in the puddles. The camera follows her from the side at walking pace. Soft cinematic light, shallow depth of field.`\n\nThree to five sentences are about right. A very short prompt leaves the model too much freedom, and in a very long one it loses the main thing.',
      },
      write: {
        title: 'Write a prompt to this pattern',
        body: 'In the `text` field of {positive} write a prompt of several sentences: who is in the frame, what happens, where, what the camera does, what the light is. At least 80 characters are needed.\n\nWrite in English and in the present tense: `walks`, not `will walk`.',
      },
      action: {
        title: 'One action per clip',
        body: 'The clip of the lesson lasts five seconds: 81 frames at 16 frames a second. One action fits into that. Describe three in a row and the model squeezes them together, mixes them up or does only the first.\n\nMotion is named with a verb and made exact: how fast, which way, with which part of the body. `She turns her head to the left and smiles` works. `She is happy` does not: that is a state, not a motion.\n\nIf there are several people in the frame, say of each what they do. Otherwise one of them moves and the rest freeze.\n\nA long scene is put together from several clips, not from one long prompt.',
      },
      camera: {
        title: 'Words for the camera',
        body: 'The camera gets a sentence of its own. Wan knows the language of film, and these words act on it:\n- `static shot`: the camera stands still;\n- `pan left`, `pan right`: a turn to the side;\n- `tilt up`, `tilt down`: a tilt up or down;\n- `push in`, `pull back`: moving in and moving out;\n- `tracking shot`: the camera moves along with the subject;\n- `orbit`: a flight around;\n- `handheld`: shot from the hands, a slight shake.\n\nThe shot size is set with words too: `close-up`, `medium shot`, `wide shot`. The angle: `low angle`, `high angle`.\n\nTake one camera move per clip. If the camera must stand still, say so plainly: left untold, the model often moves it itself.',
      },
      picture: {
        title: 'When the clip starts from a picture',
        body: 'In the graph of "Video from a picture" the look is already set by the picture. It need not be described again: name the subject in two or three words so that the model knows who is meant, and describe what changes.\n\nAn example: `The woman in the red coat slowly turns around and looks at the camera. Her hair moves in the wind. Static shot.`\n\nThe prompt must not argue with the picture. If it is night in the picture and day in the text, the model breaks the frame trying to please both.\n\nWhat the prompt does not name the model tries to leave as it is in the picture. So for video from a picture the prompt can be shorter.',
      },
      negative: {
        title: 'The second text for video',
        body: 'The second text, the one that goes into the `negative` input, lists the defects of a clip. In the ready ComfyUI templates for Wan it holds a long list in Chinese: overexposure, a still frame, blurred detail, subtitles, extra fingers, distorted faces and hands. It can be left as it is, or the same can be written in English: `overexposed, static, blurry details, subtitles, extra fingers, deformed hands`.\n\nThe second text acts only when `cfg` in the samplers is above 1. "Video from text" sets 3.5, and the text works. With the speed-up LoRA of "Fast video in four steps" `cfg` is 1, and the second text does not act at all. Then everything that matters must be in the main prompt.',
      },
      problems: {
        title: 'When the clip does not obey',
        body: 'What to change, and in what order:\n- the clip stands still: the prompt has no action. Add a verb and a camera move;\n- the motion is limp, as if in slow motion: that is often the price of a speed-up LoRA. Describe a livelier motion, or make the clip without the speed-up, in twenty steps;\n- the camera moves when it should not: write `static shot`;\n- the face and the figure drift towards the end: too much motion for five seconds. Keep one action or lower `length`;\n- the model does something other than what is written: make that the first sentence and take out everything secondary;\n- the subject changes from clip to clip: describe it in the very same words each time, or start from a picture;\n- everything is off: change `noise_seed` in the first sampler.',
      },
      check: {
        title: 'What the app will tell you',
        body: 'The "Check" button on the top toolbar reads the prompts of a clip too. It says when a prompt is empty, when forms of other programs are left in it, when it is not written in English, when the second text does not act because of `cfg` 1, and when the prompt has none of the words of your LoRA.\n\nThe words of a LoRA and the prompts its author used are shown in the card of the file in the "Models" tab. For a motion LoRA this matters most: without its words it often does not switch on.',
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
        title: 'Write the prompt',
        body: 'Add a {text} node. Connect the output of {t5} to its `t5` input.\n\nHere both texts are in one node: the prompt of the clip in `positive_prompt`, what must not be there in `negative_prompt`. Write the way "A prompt for video" shows.',
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
        body: 'The Wan 2.2 14B model is larger than most graphics cards hold. The pack deals with this so: some blocks of the model stay in ordinary memory and move into the graphics card only when they are needed.\n\nFor that add a WanVideo BlockSwap node and connect its output to the `block_swap_args` input of each model loader. Its `blocks_to_swap` field is the number of blocks kept outside the graphics card: start at 20 and raise it until the clip stops failing for lack of memory. The larger the number, the slower.\n\nTwo more ways to save memory: a model file in fp8 format, and `quantization` set to `fp8_e4m3fn`.',
      },
      lora: {
        title: 'LoRA in this pack',
        body: 'Here a LoRA does not stand in the model\'s path: it is connected to the loader. Add a WanVideo Lora Select node, choose the file in its `lora` field and connect its output to the `lora` input of the model loader.\n\nEach model gets a node of its own: the `high` file to the loader of the `high_noise` model, the `low` file to the loader of `low_noise`. Several LoRAs are chained: the output of one select node to the `prev_lora` input of the next.\n\nLoRAs for the built-in Wan graph fit here too: they are the same files.',
      },
      trigger: {
        title: 'The LoRA\'s words in the prompt',
        body: 'If the canvas has a LoRA select node, add the words of its file to the `positive_prompt` field.\n\nThe app compares the prompt with the words written in the LoRA files on the canvas. If there is no LoRA, or its file holds no words, the step counts on its own.',
      },
      fast: {
        title: 'Fast in four steps',
        body: 'The `lightx2v` speed-up LoRA works in this pack too. Put it to both models through LoRA select nodes, and in the samplers set `steps` to 4, `end_step` to 2 in the first, `start_step` to 2 in the second and `cfg` to 1 in both.\n\nAt `cfg` 1 the text of the `negative_prompt` field does not act.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe "Check" button reads this pack's prompts too: it says when forms of other programs are left in a text or the second text does not act at \`cfg\` 1.\n\nNext: "Video from a picture on WanVideoWrapper" starts the clip from your picture.`,
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
        body: `${SAVE}\n\nThe prompt of a clip from a picture says what changes, not what is already seen. More on this in "A prompt for video".`,
      },
    },
  },
  'wrapper-vace': {
    title: 'VACE: motion from another video',
    result: 'A clip on WanVideoWrapper repeats the motion, the depth or the outlines of another video.',
    steps: {
      intro: {
        title: 'What VACE is',
        body: 'VACE is a module that teaches Wan to take a hint from a ready video. The hint can be the video itself, a depth map, a person\'s pose or outlines made from its frames. The prompt says what to draw, and the hint says how it moves and where it stands.\n\nThis is how a dancer\'s motion is moved onto another character, how a clip changes style while keeping its motion, or how a camera move is set by example.\n\nThe lesson goes on from the graph of "Video on WanVideoWrapper".',
      },
      graph: {
        title: 'A WanVideoWrapper graph is needed',
        body: 'The canvas must have two {high} loaders, a {vae} node and two {first} samplers, the second taking the result of the first. This is the graph of "Video on WanVideoWrapper".\n\nIf it is not there, do that lesson first.',
      },
      modules: {
        title: 'Add the VACE module to both models',
        body: `Add two {vaceHigh} nodes. In the \`vace_model\` field of one choose the VACE module for the \`high_noise\` model, in the other the one for \`low_noise\`. Connect the \`extra_model\` output of each to the \`extra_model\` input of its model loader.\n\nA module is made for its own model: Wan 2.2 has two of them, Wan 2.1 one. It lies in the same folder as the models.\n\n${noFile("the VACE example graph from the pack's `example_workflows` folder")}`,
      },
      source: {
        title: 'Load the hint video',
        body: 'Add {source} and {frames}. In the `file` field choose the video whose motion is to be repeated. Connect the output of {source} to the `video` input of {frames}: it takes the video apart into frames.\n\nThe list shows the videos of the `input` folder of your ComfyUI.',
      },
      control: {
        title: 'Frames, depth, a pose or outlines',
        body: 'The frames can go to VACE as they are: then the model holds on to everything at once, shape, colour and motion. More often one hint is made from the frames first:\n- a depth map holds the layout and the motion and leaves the looks to the prompt;\n- a pose holds a person\'s motion and not their clothes or face;\n- outlines hold the shape of things.\n\nSuch nodes are in the comfyui_controlnet_aux pack: Depth Anything, OpenPose, DWPose, Canny, Lineart. They stand between {frames} and VACE: the frames into their input, their output on. The lesson counts a direct link and a link through them alike.',
      },
      encode: {
        title: 'Prepare the hint for the model',
        body: 'Add a {vace} node. Connect the output of {vae} to its `vae` input, and to `input_frames` the frames from {frames} or from the node that made a hint of them.\n\nSet `num_frames` to 81, and `width` and `height` as in the clip. The `strength` field is the strength of the hint: start at 1.',
      },
      wire: {
        title: 'Give the hint to both samplers',
        body: 'Connect the `vace_embeds` output of {vace} to the `image_embeds` input of both samplers.\n\nThe old links from the empty blank come off by themselves. The empty blank node can be deleted after that: the VACE node now sets the size and the length.',
      },
      reference: {
        title: 'A sample picture',
        body: 'The {vace} node has a `ref_images` input: a picture of who or what must be in the clip. Connect a node with a picture to it, and the model keeps that look the whole time.\n\nA picture on a plain background, with nothing else in it, works best.',
      },
      tune: {
        title: 'How closely to follow the hint',
        body: 'Three fields of {vace} decide how strongly the hint holds the clip:\n- `strength`: below 1 gives the model more freedom, above 1 holds it more strictly;\n- `vace_start_percent` and `vace_end_percent`: for which share of the steps the hint acts. Set `vace_end_percent` to 0.5 and the hint sets the start, while the model finishes the detail itself.\n\nIf the clip repeats the hint too literally, flaws and all, lower `strength` or `vace_end_percent`.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe clip is no longer than the hint video. If the video is shorter, lower \`num_frames\`.`,
      },
    },
  },
  'wrapper-animate': {
    title: 'Animation by pose: Wan Animate',
    result: 'The character from your picture repeats the moves and the face of the person in a video.',
    steps: {
      intro: {
        title: 'What Wan Animate does',
        body: 'Wan 2.2 Animate takes a picture of a character and a video of a person moving. Special nodes take the pose and the face out of every frame of the video, and the model draws your character in those poses with that face.\n\nOnly someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law.\n\nThis is a separate model in one file, not a pair of `high` and `low`. The lesson builds the graph from an empty canvas: "File ▸ New project".',
      },
      model: {
        title: 'Load the Animate model',
        body: `Add a {model} node and choose the Wan 2.2 Animate file in its \`model\` field.\n\n${noFile('the Animate example graph from the `example_workflows` folder of the WanVideoWrapper pack')}`,
      },
      readers: {
        title: 'The text reader and the VAE',
        body: 'Add {t5} and {vae}. In the `model_name` field of the first choose the `umt5-xxl-enc` file, in the second the `wan_2.1_vae` file. These are the files of "Video on WanVideoWrapper".',
      },
      prompt: {
        title: 'Describe the scene briefly',
        body: 'Add a {text} node and connect the output of {t5} to its `t5` input. In `positive_prompt` describe the character and the place in a couple of sentences.\n\nThe video sets the motion here, so the prompt is shorter than usual.',
      },
      picture: {
        title: 'Load the picture of the character',
        body: 'Add a {picture} node and choose the picture of the character in its `image` field. A character seen whole or from the waist up, facing the camera, with no other people near, works best.',
      },
      vision: {
        title: 'Show the picture to the model',
        body: 'Add {clipVision} and {vision}. In the `clip_name` field of the first choose the `clip_vision_h` file. Connect its output to the `clip_vision` input of the second, and the picture to `image_1`.\n\nThis way the model sees what the character looks like, not only reads about it.',
      },
      driving: {
        title: 'Load the video with the motion',
        body: 'Add {source} and {frames}. In the `file` field choose a video of the person whose moves are to be repeated. Connect the output of {source} to the `video` input of {frames}.\n\nThe model draws 16 frames a second. If the video was shot at another rate, the motion in the clip runs faster or slower.',
      },
      detect: {
        title: 'Take out the pose and the face',
        body: 'Add three nodes of the ComfyUI-WanAnimatePreprocess pack: {poseModel}, {detect} and {draw}.\n- In {poseModel} choose the ViTPose pose model in `vitpose_model` and the YOLO person finder in `yolo_model`. Both lie in the `detection` folder.\n- Its `model` output to the `model` input of {detect}, the frames to `images`.\n- The `pose_data` output of {detect} to the `pose_data` input of {draw}: it draws the poses as stick figures.',
      },
      embeds: {
        title: 'Build the start of the clip',
        body: 'Add an {animate} node and connect to it:\n- to `vae`, the output of {vae};\n- to `ref_images`, the picture of the character;\n- to `pose_images`, the output of {draw};\n- to `face_images`, the `face_images` output of {detect};\n- to `clip_embeds`, the output of {vision}.\n\nSet `num_frames` to 81, and `width` and `height` as in the clip.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node. Connect the model to `model`, the prompt to `text_embeds`, and the output of {animate} to `image_embeds`.\n\nThere is one sampler here: one model, no split into two passes. Take `steps` and `cfg` from the model\'s page. With a speed-up LoRA `steps` 6 and `cfg` 1 are usual.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add a {decode} node. Connect the sampler\'s output to its `samples` input and the output of {vae} to its `vae` input.',
      },
      save: {
        title: 'Save the clip',
        body: 'Add {video} and {save}, the frames into `images`, the clip into `video`. Set `fps` to 16.',
      },
      tips: {
        title: 'When the result is not right',
        body: 'What to change in {animate}:\n- the character repeats the pose too rigidly or breaks: lower `pose_strength` to 0.8;\n- the face is someone else\'s or frozen: change `face_strength`;\n- the colour changes from piece to piece: set `colormatch` to `mkl`;\n- a clip longer than 77 frames is made in pieces: `frame_window_size` sets their length.\n\nKeep the proportions of the picture, the clip and the sample video alike.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe first run is long: besides the model itself, the pose models are loaded.`,
      },
    },
  },
  'wrapper-talk': {
    title: 'A talking video: InfiniteTalk',
    result: 'A portrait says the words of a sound file, the lips in time with them.',
    steps: {
      intro: {
        title: 'What InfiniteTalk does',
        body: 'InfiniteTalk gives the Wan 2.1 "image to video" model the ability to listen to sound. You give a portrait and a voice recording, and the model draws the person of the portrait saying those words. The sound goes into the clip as its track.\n\nOnly someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law.\n\nThis graph runs on one Wan 2.1 model, not on the Wan 2.2 pair. The lesson builds it from an empty canvas: "File ▸ New project".',
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the Wan 2.1 \`i2v\` 14B model in its \`model\` field, preferably the 480p one.\n\n${noFile('the InfiniteTalk example graph from the `example_workflows` folder of the WanVideoWrapper pack')}`,
      },
      readers: {
        title: 'The text reader and the VAE',
        body: 'Add {t5} and {vae}. In the `model_name` field of the first choose the `umt5-xxl-enc` file, in the second the `wan_2.1_vae` file.',
      },
      prompt: {
        title: 'Describe the frame briefly',
        body: 'Add a {text} node and connect the output of {t5} to its `t5` input. In `positive_prompt` describe who speaks and how: calmly, smiling, gesturing.\n\nWhat exactly is said the model takes from the sound, not from the text.',
      },
      picture: {
        title: 'Load the portrait',
        body: 'Add a {picture} node and choose the portrait in its `image` field. A face in close-up, from the front, with the mouth closed or slightly open, works best.',
      },
      vision: {
        title: 'Show the portrait to the model',
        body: 'Add {clipVision} and {vision}. In the `clip_name` field of the first choose the `clip_vision_h` file. Connect its output to the `clip_vision` input of the second, and the portrait to `image_1`.\n\nThe Wan 2.1 "image to video" models cannot do without it.',
      },
      'talk-model': {
        title: 'Add the InfiniteTalk module',
        body: 'Add a {talk} node and choose the InfiniteTalk module file in its `model` field. Connect its output to the `multitalk_model` input of the model loader.\n\nFor one speaker the single module is taken, for two the multi one.',
      },
      voice: {
        title: 'Load the voice',
        body: 'Add three nodes: {voice}, {wav2vec} and {audio}.\n- In {voice} choose the sound file from the `input` folder in the `audio` field.\n- In {wav2vec} choose the wav2vec speech model in the `model` field, usually chinese-wav2vec2-base. It lies in the `wav2vec2` folder.\n- The `wav2vec_model` output to the `wav2vec_model` input of {audio}, the sound to `audio_1`.\n\nLeave `fps` at 25 in {audio}: InfiniteTalk draws 25 frames a second.',
      },
      start: {
        title: 'Prepare the start',
        body: 'Add a {start} node. Connect the output of {vae} to its `vae` input, the portrait to `start_image`, and the output of {vision} to `clip_embeds`.\n\nThis node makes a long clip in pieces and stitches them, so it can speak for longer than five seconds.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect to it:\n- to `model`, the model;\n- to `text_embeds`, the prompt;\n- to `image_embeds`, the output of {start};\n- to `multitalk_embeds`, the `multitalk_embeds` output of {audio}.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add a {decode} node. Connect the sampler\'s output to its `samples` input and the output of {vae} to its `vae` input.',
      },
      save: {
        title: 'Make the clip',
        body: 'Add {video} and {save}, the frames into `images`, the clip into `video`. Set `fps` to 25, as for the sound.',
      },
      sound: {
        title: 'Put the sound into the clip',
        body: 'Connect the `audio` output of {audio} to the `audio` input of {video}.\n\nWithout it the clip is saved silent, though the lips move.',
      },
      tips: {
        title: 'When the lips miss the words',
        body: 'What to change in {audio}:\n- the lips move too little: raise `audio_scale` to 1.2;\n- the face is frozen and only the lips move: set `audio_cfg_scale` to 2, the clip takes longer to make;\n- the length of the clip: the node counts the frames from the length of the sound itself.\n\nA clean recording of a voice, with no music or noise, works much better.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nA minute of speech takes long to make. While you look for the settings, take a piece of five to ten seconds.`,
      },
    },
  },
  'wrapper-unianimate': {
    title: 'Animation by pose: UniAnimate',
    result: 'The character from a picture repeats the moves of a person in a video. A Wan 2.1 model and one LoRA are enough.',
    steps: {
      intro: {
        title: 'What UniAnimate does',
        body: 'UniAnimate is a LoRA for the Wan 2.1 "image to video" model. With it the model obeys a skeleton: the pose is taken out of every frame of a video of a person moving, and the character from your picture repeats those moves.\n\nUnlike Wan Animate it does not carry the face over, only the body. In return no separate model is needed.\n\nOnly someone who agrees may be brought to life this way: yourself, a made-up character, or a person who gave permission. Obtain permission for the source material and follow local law.\n\nThe lesson builds the graph from an empty canvas: "File ▸ New project".',
      },
      model: {
        title: 'Load the model',
        body: `Add the node {model} and choose in the field \`model\` a Wan 2.1 \`i2v\` 14B model, the 480p or the 720p one.\n\n${noFile('any Wan 2.1 I2V example graph from the `example_workflows` folder of the WanVideoWrapper pack')}`,
      },
      readers: {
        title: 'The text reader and the VAE',
        body: 'Add the nodes {t5} and {vae}. In the field `model_name` of the first choose the file `umt5-xxl-enc`, of the second the file `wan_2.1_vae`.',
      },
      prompt: {
        title: 'Describe the character and the place',
        body: 'Add the node {text} and connect the output of {t5} to its input `t5`. In the field `positive_prompt` say who is in the frame, what they wear and where they are.\n\nThe movement needs no words: the video sets it.',
      },
      picture: {
        title: 'Load the character',
        body: 'Add the node {picture} and choose in the field `image` the picture of the character. Full height works best, in a pose close to the first pose of the video.',
      },
      vision: {
        title: 'Show the picture to the model',
        body: 'Add the nodes {clipVision} and {vision}. In the field `clip_name` of the first choose the file `clip_vision_h`. Connect its output to the input `clip_vision` of the second, and the picture to the input `image_1`.\n\nThe Wan 2.1 "image to video" models cannot do without it.',
      },
      lora: {
        title: 'Add the UniAnimate LoRA',
        body: 'Add the node {uni} and choose in the field `lora` the UniAnimate file for Wan 2.1 14B. Connect its output to the input `lora` of the model loader.\n\nWithout this LoRA a skeleton cannot be connected: the run stops with an error.',
      },
      driving: {
        title: 'Load the video with the movement',
        body: 'Add the nodes {source} and {frames}. In the field `file` of the first choose a video from the `input` folder, and connect its output to the input `video` of the second.\n\nTake a video where the person is alone in the frame and seen whole.',
      },
      detect: {
        title: 'Take the pose out',
        body: 'Add the node {detect}. Connect the output `images` of {frames} to its input `pose_images`, and the picture of the character to the input `reference_pose_image`.\n\nThe node draws a skeleton for every frame and, apart from them, the skeleton of the character in the picture. From the second the model learns how the build of the character differs from the person in the video.\n\nThis node downloads two small pose models itself when the graph is first run in ComfyUI. This app downloads nothing.',
      },
      pose: {
        title: 'Hand the skeleton to the model',
        body: 'Add the node {pose}. Connect the output `poses` of {detect} to the input `pose_images`, and the output `reference_pose` to the input `reference_pose_image`.\n\nLeave the field `strength` at 1: it is how firmly the skeleton leads the character.',
      },
      start: {
        title: 'Prepare the start',
        body: 'Add the node {start}. Connect the output of {vae} to its input `vae`, the picture to the input `start_image`, and the output of {vision} to the input `clip_embeds`.\n\nLeave the field `num_frames` at 81, which is five seconds. The fields `width` and `height` set the size of the clip.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add the node {sampler} and connect to it:\n- the model to the input `model`;\n- the prompt to the input `text_embeds`;\n- the output of {start} to the input `image_embeds`;\n- the output of {pose} to the input `unianimate_poses`.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add the node {decode}. Connect the output of the sampler to its input `samples`, and the output of {vae} to the input `vae`.',
      },
      save: {
        title: 'Assemble the clip',
        body: 'Add the nodes {video} and {save}: the frames into `images`, the clip into `video`. Set the field `fps` to 16.',
      },
      tips: {
        title: 'If the character moves wrong',
        body: 'What to check:\n- the frames of the video are of another size than the clip: put a resize node between {frames} and {detect} and set the same `width` and `height` as in {start};\n- the video is longer than the clip: the poses left over are dropped. If it is shorter, lower `num_frames`;\n- the skeleton vanishes or shows where it should not: change `score_threshold` in {detect};\n- the character changes build: check that the picture of the character is connected to the input `reference_pose_image`.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe first run takes longer than usual: the node {detect} downloads its models.`,
      },
    },
  },
  'wrapper-duo': {
    title: 'Two people talking: InfiniteTalk',
    result: 'Two people in one picture speak, each with their own voice.',
    steps: {
      intro: {
        title: 'Two voices in one frame',
        body: 'InfiniteTalk and MultiTalk can voice two people at once. You need a picture with two people and two voice recordings. The model moves the lips of each to their own recording.\n\nThe rule is the same: only those who agree may be voiced, with their own voices or voices you have permission for.\n\nThe lesson continues the graph of the lesson "A talking video: InfiniteTalk".',
      },
      graph: {
        title: 'The graph of a talking video is needed',
        body: 'The canvas must hold the graph of the lesson "A talking video: InfiniteTalk": the nodes {talk}, {voice}, {audio} and {sampler}, with the sound connected to the input `audio_1`.\n\nIf it is not there, do that lesson first.',
      },
      module: {
        title: 'Check the module',
        body: 'The field `model` of {talk} must hold a module for several speakers. For InfiniteTalk the name of such a file has the word multi in it; MultiTalk has one module for every case.\n\nThe single module is made for one person.',
      },
      picture: {
        title: 'Choose the picture',
        body: 'In the node with the portrait choose a frame where both people are seen large and stand side by side: one in the left half, the other in the right.\n\nThis matters. Unless told otherwise, the first voice goes to whoever is on the left and the second to whoever is on the right.',
      },
      'second-voice': {
        title: 'Add the second voice',
        body: 'Add one more node {voice2} and choose in the field `audio` the recording of the second person, not the same as the first. Connect its output to the input `audio_2` of {audio}.',
      },
      order: {
        title: 'Together or in turn',
        body: 'The field `multi_audio_type` of {audio} says how the two recordings are put together:\n- `para`: both sound at once, from the start of the clip. It fits when each recording already has pauses for the time the other one speaks;\n- `add`: the first recording whole, then the second. It fits two separate lines.',
      },
      who: {
        title: 'Who speaks with which voice',
        body: 'The voice from the input `audio_1` goes to the person in the left half of the frame, from the input `audio_2` to the one in the right. If the voices are swapped, swap the recordings.\n\nWhen people stand otherwise, masks are needed: one per person, to the input `ref_target_masks`. A mask is drawn in ComfyUI\'s mask editor.\n\nThe inputs `audio_3` and `audio_4` are for a third and a fourth speaker. They must have masks: the node itself splits the frame only in two.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nWhile you are choosing the recordings and the picture, take lines a few seconds long.`,
      },
    },
  },
  'wrapper-fantasy': {
    title: 'A talking portrait: FantasyTalking',
    result: 'A portrait says a short voice recording. The graph is simpler than InfiniteTalk\'s, the clip shorter.',
    steps: {
      intro: {
        title: 'What FantasyTalking does',
        body: 'FantasyTalking also teaches the Wan 2.1 "image to video" model to listen to sound, but it is built more simply than InfiniteTalk: a plain start from a picture, with no stitching of pieces. The clip comes out short, but the graph reads at a glance.\n\nOnly someone who agrees may be voiced this way, with their own voice or a voice you have permission for. Obtain permission for the source material and follow local law.\n\nThe lesson builds the graph from an empty canvas: "File ▸ New project".',
      },
      model: {
        title: 'Load the model',
        body: `Add the node {model} and choose in the field \`model\` a Wan 2.1 \`i2v\` 14B model, preferably the 720p one.\n\n${noFile('the FantasyTalking example graph from the `example_workflows` folder of the WanVideoWrapper pack')}`,
      },
      readers: {
        title: 'The text reader and the VAE',
        body: 'Add the nodes {t5} and {vae}. In the field `model_name` of the first choose the file `umt5-xxl-enc`, of the second the file `wan_2.1_vae`.',
      },
      prompt: {
        title: 'Describe the frame briefly',
        body: 'Add the node {text} and connect the output of {t5} to its input `t5`. In the field `positive_prompt` say who speaks and how: calmly, with a smile, with gestures.\n\nWhat is said the model takes from the sound, not from the text.',
      },
      picture: {
        title: 'Load the portrait',
        body: 'Add the node {picture} and choose in the field `image` a portrait. A face seen large and from the front works best.',
      },
      vision: {
        title: 'Show the portrait to the model',
        body: 'Add the nodes {clipVision} and {vision}. In the field `clip_name` of the first choose the file `clip_vision_h`. Connect its output to the input `clip_vision` of the second, and the portrait to the input `image_1`.',
      },
      'talk-model': {
        title: 'Add the FantasyTalking module',
        body: 'Add the node {talk} and choose in the field `model` the file of the FantasyTalking module. Connect its output to the input `fantasytalking_model` of the model loader.',
      },
      start: {
        title: 'Prepare the start',
        body: 'Add the node {start}. Connect the output of {vae} to its input `vae`, the portrait to the input `start_image`, and the output of {vision} to the input `clip_embeds`.\n\nLeave the field `num_frames` at 81. At 23 frames a second that is three and a half seconds of speech.',
      },
      voice: {
        title: 'Load the voice',
        body: 'Add three nodes: {voice}, {wav2vec} and {audio}.\n- In {voice} choose in the field `audio` a sound file from the `input` folder.\n- In {wav2vec} set the field `model` to `facebook/wav2vec2-base-960h`: FantasyTalking was trained with it. The node downloads this model itself when the graph is first run in ComfyUI.\n- Three links go into {audio}: `wav2vec_model` from {wav2vec}, `fantasytalking_model` from {talk}, and the sound.\n- In {audio} set `fps` to 23, and `num_frames` to the same number as in {start}.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add the node {sampler} and connect to it:\n- the model to the input `model`;\n- the prompt to the input `text_embeds`;\n- the output of {start} to the input `image_embeds`;\n- the output of {audio} to the input `fantasytalking_embeds`.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add the node {decode}. Connect the output of the sampler to its input `samples`, and the output of {vae} to the input `vae`.',
      },
      save: {
        title: 'Assemble the clip',
        body: 'Add the nodes {video} and {save}: the frames into `images`, the clip into `video`. Set the field `fps` to 23, as the sound has.',
      },
      sound: {
        title: 'Put the sound into the clip',
        body: 'Connect the output of {voice} to the input `audio` of {video}.\n\nWithout it the clip is saved silent, though the lips move.',
      },
      tips: {
        title: 'If the lips miss the words',
        body: 'What to change in {audio}:\n- the lips move weakly: raise `audio_scale` to 1.2;\n- the face is frozen and only the lips move: set `audio_cfg_scale` to 2; the clip takes longer to compute;\n- the recording is longer than the clip: only its beginning is used. Cut the recording beforehand or raise `num_frames` in both nodes.\n\nFor long speech take InfiniteTalk: it stitches a clip out of pieces.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe first run takes longer than usual: the node {wav2vec} downloads the speech model.`,
      },
    },
  },
  'wrapper-ovi': {
    title: 'A video with sound: Ovi',
    result: 'One run draws the clip and its sound at once: the character\'s speech, steps, street noise.',
    steps: {
      intro: {
        title: 'What Ovi does',
        body: 'Ovi is two models working together: one draws the clip, the other makes its sound at the same time. You write the character\'s speech right in the prompt, and the lips match the words.\n\nThe clip always has one length: 121 frames, which is five seconds at 24 frames a second.\n\nThe model makes the voice up itself. The rule stays: do not put words into the mouths of real people without their consent.\n\nThe lesson builds the graph from an empty canvas: "File ▸ New project".',
      },
      models: {
        title: 'Load the two models',
        body: `Add the nodes {model} and {sound}.\n- In {model} choose in the field \`model\` the Ovi video model.\n- In {sound} choose in the field \`extra_model\` the Ovi audio model. It is another file.\n- Connect the output of {sound} to the input \`extra_model\` of {model}.\n- In {model} leave the field \`base_precision\` at \`bf16\`. With \`fp16\` this model may give a black screen.\n\n${noFile('the Ovi example graph from the `example_workflows` folder of the WanVideoWrapper pack')}`,
      },
      readers: {
        title: 'The text reader and the VAE',
        body: 'Add the nodes {t5} and {vae}. In the field `model_name` of the first choose the file `umt5-xxl-enc`. The second needs the VAE of Wan 2.2, the file `Wan2_2_VAE`: the VAE of Wan 2.1 does not fit here.',
      },
      prompt: {
        title: 'Describe the frame',
        body: 'Add the node {text} and connect the output of {t5} to its input `t5`. In the field `positive_prompt` say in English who is in the frame, where, and what they do.',
      },
      speech: {
        title: 'Write the speech in',
        body: 'The words the character says go into the field `positive_prompt` between the marks `<S>` and `<E>`. For example: A man in a kitchen says `<S>Good morning, the coffee is ready.<E>`\n\nWithout these marks Ovi does not work.\n\nWhat else is heard in the clip may be described between `<AUDCAP>` and `<ENDAUDCAP>`: a voice, noise, music. This is optional.',
      },
      guidance: {
        title: 'Connect the sound setting',
        body: 'Add the node {ovi} and connect the output of {text} to its input `original_text_embeds`.\n\nLeave the field `ovi_audio_cfg` at 3. It says how strictly the sound follows the prompt.',
      },
      'sound-negative': {
        title: 'Say what the sound must not be',
        body: 'Add a second node {soundNo} and connect the output of {t5} to its input `t5`. In its field `positive_prompt` write what the sound must not have: robotic, muffled, echo, distorted.\n\nConnect the output of this node to the input `ovi_negative_text_embeds` of {ovi}.\n\nThis is no mistake: the words go into the upper field, and {ovi} takes exactly that one. If this node is not connected, the prompt itself stands in for it, and the setting `ovi_audio_cfg` nearly stops acting.',
      },
      size: {
        title: 'Set the size and the length',
        body: 'Add the node {embeds}. Set the field `num_frames` to 121: Ovi is not made for another length.\n\nSet the fields `width` and `height` to 992 and 512 for a horizontal clip.',
      },
      silence: {
        title: 'Add the blank sound',
        body: 'Add the node {silence} and leave its field `length` at 157. It is the length of sound for a clip of 121 frames.\n\nOut of this blank the model makes the sound, the way it makes the clip out of noise.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add the node {sampler} and connect to it:\n- the model to the input `model`;\n- the output of {ovi}, not of {text}, to the input `text_embeds`;\n- the output of {embeds} to the input `image_embeds`;\n- the output of {silence} to the input `samples`.\n\nSet `steps` to 50 and `cfg` to 4.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add the node {decode}. Connect the output of the sampler to its input `samples`, and the output of {vae} to the input `vae`.',
      },
      'sound-out': {
        title: 'Turn the result into sound',
        body: 'Add the nodes {soundVae} and {soundDecode}.\n- In {soundVae} choose in the field `vae` the file `mmaudio_vae`, and in the field `vocoder` the file `mmaudio_vocoder`. They are two different files.\n- Connect its output to the input `mmaudio_vae` of {soundDecode}.\n- Connect the output of the sampler to the input `samples` of {soundDecode}, the same output that goes into {decode}.',
      },
      save: {
        title: 'Assemble the clip with its sound',
        body: 'Add the nodes {video} and {save}. Connect the frames to the input `images`, the output of {soundDecode} to the input `audio`, and the clip to the input `video`. Set the field `fps` to 24.',
      },
      picture: {
        title: 'If the clip should start from a picture',
        body: 'Ovi can start a clip from your picture. It is loaded, brought to the size of the clip and turned into the compressed form by the node WanVideo Encode. The output of that node goes to the input `extra_latents` of {embeds}.\n\nThe lesson does not check this step: the graph works without a picture too.',
      },
      tips: {
        title: 'If the sound or the speech did not come out',
        body: 'What to check:\n- the character is not heard: the words must stand between `<S>` and `<E>`, preferably in English;\n- the speech is cut off: five seconds hold one or two short phrases;\n- the sound is dull or echoes: add what you hear to {soundNo}: muffled, echo, noise;\n- a black screen: check `base_precision`, it must be `bf16`.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nOvi takes long: 50 steps for two models at once. For a trial set 30.`,
      },
    },
  },
  'wrapper-recam': {
    title: 'Another camera: ReCamMaster',
    result: 'A finished video is drawn again as if the camera had moved another way.',
    steps: {
      intro: {
        title: 'What ReCamMaster does',
        body: 'ReCamMaster takes a finished video and draws the same scene again with another camera move: an orbit, a zoom or a turn. What happens in the scene stays.\n\nThe model is small, based on Wan 2.1 1.3B. It was trained on clips of 81 frames sized 832 by 480 and works best with them.\n\nTake a video of your own or one you have the rights to.\n\nThe lesson builds the graph from an empty canvas: "File ▸ New project".',
      },
      model: {
        title: 'Load the model',
        body: `Add the node {model} and choose in the field \`model\` the ReCamMaster model.\n\n${noFile('the ReCamMaster example graph from the `example_workflows` folder of the WanVideoWrapper pack')}`,
      },
      readers: {
        title: 'The text reader and the VAE',
        body: 'Add the nodes {t5} and {vae}. In the field `model_name` of the first choose the file `umt5-xxl-enc`, of the second the file `wan_2.1_vae`.',
      },
      prompt: {
        title: 'Describe what is in the video',
        body: 'Add the node {text} and connect the output of {t5} to its input `t5`. In the field `positive_prompt` say what happens in the video: who, where, doing what.\n\nThe camera needs no words; you set it apart.',
      },
      source: {
        title: 'Load the video',
        body: 'Add the nodes {source} and {frames}. In the field `file` of the first choose a video from the `input` folder, and connect its output to the input `video` of the second.',
      },
      encode: {
        title: 'Turn the video into its compressed form',
        body: 'Add the node {encode}. Connect the output of {vae} to its input `vae`, and the output `images` of {frames} to the input `image`.\n\nIf the video is longer than 81 frames or of another size, put the nodes `ImageFromBatch` and `ImageScale` between them. The first keeps 81 frames, the second brings the size to 832 by 480.',
      },
      camera: {
        title: 'Choose the camera move',
        body: 'Add the node {camera} and connect the output of {encode} to its input `latents`.\n\nIn the field `camera_type` choose the move:\n- `pan_right`, `pan_left`: a turn to the right and to the left;\n- `tilt_up`, `tilt_down`: a tilt up and down;\n- `zoom_in`, `zoom_out`: moving in and out;\n- `translate_up`, `translate_down`: rising and lowering;\n- `arc_left`, `arc_right`: an orbit from the left and from the right.',
      },
      embeds: {
        title: 'Join the camera and the video',
        body: 'Add the node {recam}. Connect the output of {camera} to its input `camera_poses`, and the output of {encode} to the input `latents`.\n\nThe video comes here a second time: the model draws the scene from it and turns it along the camera\'s path.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add the node {sampler} and connect to it:\n- the model to the input `model`;\n- the prompt to the input `text_embeds`;\n- the output `camera_embeds` of {recam} to the input `image_embeds`.\n\nSet `steps` to 20.',
      },
      decode: {
        title: 'Turn the result into frames',
        body: 'Add the node {decode}. Connect the output of the sampler to its input `samples`, and the output of {vae} to the input `vae`.',
      },
      save: {
        title: 'Assemble the clip',
        body: 'Add the nodes {video} and {save}: the frames into `images`, the clip into `video`. Set the field `fps` to 16.',
      },
      tips: {
        title: 'If the scene changed',
        body: 'What to check:\n- the clip shows another scene: the prompt does not fit the video. Describe what is really in it;\n- the picture is blurry: the video is of the wrong size. Bring it to 832 by 480;\n- an orbit by a set angle is needed: the pack has a separate node for it, WanVideo ReCamMaster Generate Orbit Camera. It stands in place of {camera}.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nOne run is one camera move. To compare two moves, run the graph twice.`,
      },
    },
  },
  'two-models': {
    title: 'Two models in one graph',
    result: 'A picture model draws the first frame and Wan brings it to life. Each has its own LoRAs and its own prompt.',
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
        body: 'Add two new {imagePositive} nodes and connect the `CLIP` output of {checkpoint} to the `clip` input of each. In the `text` field of one describe the frame: who is in it, where, what the light is.\n\nThe texts of the video will not do: they were read for Wan. Each model has text nodes of its own, connected to its own text reader.\n\nWrite in the manner of this model. How to tell it is shown in "The prompt: how a model reads it".',
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
        title: 'Two prompts, each with its own job',
        body: 'The graph now has two prompts. The first, for the picture model, says what is in the frame: the subject, the clothes, the place, the light, the style. The second, for Wan, says what changes: the motion and the camera.\n\nDo not carry one over into the other. Words about motion in the prompt of a frame mean nothing to a picture model. And details of looks in the prompt of a clip argue with the finished frame.\n\nThe second texts, those for the `negative` input, differ too: each model has defects of its own.',
      },
      loras: {
        title: 'LoRA: each in the path of its own model',
        body: 'A LoRA is made for one family of models. It goes into the path of the model it was made for:\n- a LoRA for the picture model: between {checkpoint} and {imageSampler}. If the LoRA node also has a `CLIP` input and output, connect the texts of the frame to its `CLIP` output;\n- a LoRA for Wan: between the loader of each of its two models and the node that sets the noise shift, as in "LoRA: add a style or a subject".\n\nA LoRA put into the wrong path does nothing. ComfyUI does not stop at it: it silently skips what did not fit.\n\nThe words of a LoRA go into the prompt of the same model. The words of a picture LoRA go into the prompt of the frame, the words of a Wan LoRA into the prompt of the clip.\n\nA handy division: looks and style come from the LoRAs of the picture model, motion from the LoRAs of the video model. Which family a file belongs to is shown by its card in the "Models" tab. The "Check" button says when models of different families meet in one path.',
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
        body: `${SAVE}\n\nWhat to try:\n- another frame: change \`seed\` in {imageSampler};\n- the same frame, another motion: change \`noise_seed\` in the first sampler of the video, or the prompt of the clip;\n- another style of frame: change the picture model or its LoRAs. The video part need not change.`,
      },
    },
  },
  ...SOUND_3D_FACES_EN,
  ...EXPERIMENTS_EN,
  ...RELIABLE_EN,
  ...ENVIRONMENT_EN,
};
