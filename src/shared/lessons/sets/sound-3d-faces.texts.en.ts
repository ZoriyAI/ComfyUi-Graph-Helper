import type { LessonWords } from '../texts';

/**
 * The words of the lessons on sound, speech, 3D, faces and characters, English. The Russian file says the same
 * things step for step, with the same numbers and the same words in backticks.
 *
 * Where a lesson gives a voice or a face to someone, the rule comes first, in the words the talking-portrait
 * lessons use. No example in these lessons describes a real person.
 */

const SAVE = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.';

const noFile = (template: string) => `If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, ${template}: it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.`;

const PACK = (pack: string) => `The nodes of this lesson come from the ${pack} pack. A pack runs other people's code on your computer: install it yourself through ComfyUI's manager, and only a pack you trust.`;

const OLD_FORMAT = 'Files in the old formats (.ckpt, .pt, .pth, .bin) can run code when they are loaded. Take them only from the model\'s official page.';

const START = 'The lesson builds the graph from an empty canvas: "File ▸ New project".';

export const SOUND_3D_FACES_EN: Record<string, LessonWords> = {
  'audio-music': {
    title: 'Music from text: ACE-Step 1.5',
    result: 'You build a graph that writes a song from a list of styles and your lyrics.',
    steps: {
      intro: {
        title: 'What ACE-Step makes',
        body: `ACE-Step 1.5 is a music model. You give it the style in a few words and, if you want singing, the lyrics. It returns a whole song with instruments and voice.\n\nThe graph looks like the one for a picture: a model, a text, an empty blank, a sampler, a decoder. Only the blank and the decoder are made for sound.\n\n${START}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {checkpoint} node and choose the file in \`ckpt_name\`. The official template uses \`ace_step_1.5_turbo_aio.safetensors\` from the folder models/checkpoints.\n\n"aio" means all in one: the model, its text reader and its decoder are in one file, as in a picture checkpoint.\n\n${noFile('the template "ACE-Step 1.5 Music Generation AIO"')}`,
      },
      shift: {
        title: 'Set the noise shift',
        body: 'Add a {shift} node. Connect the `MODEL` output of {checkpoint} to its `model` input and set `shift` to 3.\n\nThe shift decides how much of the work goes to the rough shape of the song and how much to the details. The template uses 3. With a much smaller number the song comes out muddled.',
      },
      style: {
        title: 'Describe the style',
        body: 'Add a {text} node and connect the `CLIP` output of {checkpoint} to its `clip` input. In the `tags` field write the style: genre, mood, instruments, the kind of voice. For example: calm acoustic folk, warm female vocals, soft guitar, light percussion.\n\nShort words separated by commas work best. The model learned on such lists.',
      },
      lyrics: {
        title: 'The lyrics',
        body: 'The `lyrics` field holds the words that are sung. Mark the parts of the song in square brackets on their own lines: [Verse 1], [Chorus], [Bridge]. The model sings the verses one way and the chorus another.\n\nWrite your own words, or words you have the right to use. The field `language` says in which language they are sung.\n\nThe official template fills this field with a whole song. Read it in ComfyUI to see the form.',
      },
      tempo: {
        title: 'Set the tempo',
        body: 'In {text} set `bpm`, the number of beats a minute, for example 120.\n\nSlow ballads sit near 70, dance music near 120 to 130. If the tempo argues with the style ("slow ballad" at 180), the model hears two different wishes and mixes them.',
      },
      length: {
        title: 'Say how long the song is',
        body: 'Add a {latent} node and set `seconds` to 120, two minutes. Then set `duration` in {text} to the same number.\n\nThe blank sets the real length, the text tells the model how long the song it plans is. When the two numbers differ, the song ends too early or breaks off.',
      },
      negative: {
        title: 'An empty negative',
        body: 'Add an {empty} node and connect the output of {text} to its `conditioning` input.\n\nThis model is not told what to avoid. The sampler still needs something in its `negative` input, and this node gives it the same description with everything set to zero.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect four inputs:\n- `model` from {shift};\n- `positive` from {text};\n- `negative` from {empty};\n- `latent_image` from {latent}.\n\nSet `steps` to 8 and `cfg` to 1. The turbo model is trained to finish in eight steps without the push of a high `cfg`. More steps make it no better, a high `cfg` makes the sound harsh.',
      },
      decode: {
        title: 'Turn the result into sound',
        body: 'Add a {decode} node. Connect the output of {sampler} to its `samples` input and the `VAE` output of {checkpoint} to its `vae` input.\n\nThe sampler works in a compressed form, as with pictures. This node unfolds it into a sound wave.',
      },
      save: {
        title: 'Save the song',
        body: 'Add a {save} node and connect the output of {decode} to its `audio` input.\n\nIn ComfyUI it saves the file into the output/audio folder. Its `format` field chooses the kind of file: `flac` keeps all the quality, `mp3` is smaller and plays everywhere.',
      },
      tips: {
        title: 'When the song is bad',
        body: '- The style is wrong: put the most important words first in `tags`, and remove words that pull different ways.\n- The voice mumbles: write the lyrics in short lines, one phrase a line, and check `language`.\n- The song stops in the middle: `duration` and `seconds` differ.\n- You like the song but want another take: change `seed` in {text}. The same number gives the same song again.\n\nThe template also comes in a form with separate files: a diffusion model, two text readers and a decoder. The graph is the same, only the loaders differ.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nOn a strong graphics card a two-minute song takes seconds; on a weak one, minutes. The first run loads the model and takes longer.`,
      },
    },
  },
  'audio-sound': {
    title: 'A sound from text: Stable Audio',
    result: 'You build a graph that makes a sound effect or a short piece of music from a description.',
    steps: {
      intro: {
        title: 'What Stable Audio makes',
        body: `Stable Audio Open 1.0 makes short sounds from text: rain on a roof, footsteps in snow, a drum loop, a pad for a background. It does not sing and does not speak.\n\nThe graph is the graph of a first picture with a separate text reader and a decoder for sound.\n\n${START}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {checkpoint} node and choose \`stable-audio-open-1.0.safetensors\` in \`ckpt_name\`. The file lies in models/checkpoints.\n\nThis file holds the part that draws the sound and its decoder. The text reader is not inside: it comes from its own file in the next step.\n\n${noFile('the template "Stable Audio 1.0: Text to Audio"')}`,
      },
      reader: {
        title: 'Load the text reader',
        body: 'Add a {clip} node. In `clip_name` choose `t5-base.safetensors` from models/text_encoders, and set `type` to `stable_audio`.\n\nThe type tells ComfyUI how the reader is built. With another type the file loads, but the model gets a description it cannot use.',
      },
      prompts: {
        title: 'Describe the sound',
        body: 'Add two {positive} nodes and connect the `CLIP` output of {clip} to the `clip` input of each.\n\nIn the `text` field of the first write what should be heard, in plain words: heavy rain on a tin roof, distant thunder. The second may stay empty or list what is not wanted.\n\nSay the kind of sound, the place and the mood. For music add the genre and the tempo, for example 120 BPM.',
      },
      length: {
        title: 'Say how long the sound is',
        body: 'Add a {latent} node and set `seconds`. For a sound effect 10 seconds is plenty.\n\nThe model was trained on pieces of up to 47 seconds. A longer blank gives silence or noise at the end.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect four inputs:\n- `model` from {checkpoint};\n- `positive` and `negative` from the two text nodes;\n- `latent_image` from {latent}.\n\nSet `steps` to 50 and `cfg` to 5. The official template uses 50 steps and a `cfg` near 5, with `sampler_name` set to `dpmpp_3m_sde_gpu` and `scheduler` to `exponential`. Set those two in ComfyUI as well if your list has them.',
      },
      decode: {
        title: 'Turn the result into sound',
        body: 'Add a {decode} node. Connect the output of {sampler} to its `samples` input and the `VAE` output of {checkpoint} to its `vae` input.',
      },
      save: {
        title: 'Save the sound',
        body: 'Add a {save} node and connect the output of {decode} to its `audio` input. In ComfyUI the file goes into output/audio.',
      },
      tips: {
        title: 'When the sound is bad',
        body: '- Mush instead of a clear sound: describe one sound, not a whole scene.\n- Noise at the end: the blank is longer than the sound you described; shorten `seconds`.\n- Too quiet or too thin: add words about the recording, such as close, studio, clean.\n\nThe model makes sounds, not speech. For speech there is the lesson "Speech from text: Chatterbox".',
      },
      run: {
        title: 'The graph is ready',
        body: SAVE,
      },
    },
  },
  'audio-speech': {
    title: 'Speech from text: Chatterbox',
    result: 'You build a graph that reads your text aloud in the voice of a short recording.',
    steps: {
      intro: {
        title: 'First, about voices',
        body: `Chatterbox reads a text aloud. Given a recording of a voice, it speaks in that voice.\n\nOnly someone who agrees may be voiced this way, with their own voice or a voice you have permission for. The app does not help with someone else's voice without consent. Never use a voice in explicit content, and never the voice of someone who looks like a minor.\n\n${PACK('ComfyUI_Fill-ChatterBox')} The pack itself downloads its models to models/chatterbox the first time the graph runs in ComfyUI.\n\n${START}`,
      },
      voice: {
        title: 'Load the voice',
        body: 'Add a {voice} node and choose the recording in its `audio` field. Your own voice is the simplest choice.\n\nThe pack\'s authors advise at least 5 to 6 seconds of clean speech: one voice, no music, no echo. The model copies everything it hears, the noise too.',
      },
      speech: {
        title: 'Write what is said',
        body: 'Add a {tts} node. Connect the output of {voice} to its `audio_prompt` input and write the words in its `text` field.\n\nWithout a recording the node speaks in its own voice. With one it imitates the recording.\n\nWrite as people speak: punctuation sets the pauses. This node speaks English. For other languages the pack has a multilingual node with the same inputs.',
      },
      manner: {
        title: 'Set the manner of speech',
        body: 'Set three numbers in {tts}:\n- `exaggeration`: 0.5, how lively the speech is; higher is more expressive and less steady;\n- `cfg_weight`: 0.5, how closely the model follows the recording; lower is slower and calmer;\n- `temperature`: 0.8, how much the readings differ from run to run.\n\nThe template keeps all three at these values. Start there and move one number at a time.',
      },
      save: {
        title: 'Save the speech',
        body: 'Add a {save} node and connect the `audio` output of {tts} to its `audio` input. In ComfyUI the file goes into output/audio.',
      },
      tips: {
        title: 'When the speech is bad',
        body: '- The voice is not alike: take a longer and cleaner recording.\n- Words are swallowed: split long sentences, add commas.\n- The speech sounds strained: lower `exaggeration` and `cfg_weight`.\n- A long text breaks: the pack\'s authors give about 40 seconds as the most per run; split the text into parts and join them with Concatenate Audio.\n\nSet `keep_model_loaded` to true when you make many lines in a row: the model stays in memory between runs.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf you publish the speech, say that the voice was made by a model.`,
      },
    },
  },
  'audio-foley': {
    title: 'Sound for a silent video: MMAudio',
    result: 'You build a graph that listens to the frames of a silent clip and gives it a sound in time with them.',
    steps: {
      intro: {
        title: 'What MMAudio does',
        body: `MMAudio watches a clip and makes the sound of what happens in it: steps, splashes, the engine of a passing car. The sound falls in time with the picture.\n\nThis is how a clip made by a video model gets its sound. A short text can steer the result, but the frames lead.\n\n${PACK('ComfyUI-MMAudio')} The frames are loaded and the clip is put together by the ComfyUI-VideoHelperSuite pack, as in the pack's own example.\n\n${START}`,
      },
      video: {
        title: 'Load the clip',
        body: 'Add a {video} node and choose the clip in its `video` field.\n\nThe model hears about 8 seconds best. For a longer clip, set `frame_load_cap` so that only the part you need is read.',
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the file in \`mmaudio_model\`. The pack's example uses \`mmaudio_large_44k_v2_fp16.safetensors\`.\n\nAll the files of this lesson lie in the folder models/mmaudio, which the pack adds to ComfyUI. Take them from the model's official page, the one the pack's description names.`,
      },
      helpers: {
        title: 'Load the helper models',
        body: `Add a {features} node. It loads three small models in three fields:\n- \`vae_model\`: the decoder of the sound, \`mmaudio_vae_44k_fp16.safetensors\`;\n- \`synchformer_model\`: the one that matches the sound to the frames, \`mmaudio_synchformer_fp16.safetensors\`;\n- \`clip_model\`: the one that sees what is in the frames, \`apple_DFN5B-CLIP-ViT-H-14-384_fp16.safetensors\`.\n\nSet \`mode\` to \`44k\`. The large model and its decoder work at 44 kHz; with \`16k\` they do not fit together.\n\n${OLD_FORMAT}`,
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect three inputs:\n- `mmaudio_model` from {model};\n- `feature_utils` from {features};\n- `images` from the `IMAGE` output of {video}.\n\nThe frames go straight from the loader into the sampler: the model watches them.',
      },
      settings: {
        title: 'Set the length and the steps',
        body: 'In {sampler} set:\n- `duration`: 8, the length of the sound in seconds; the clip and the sound must be equally long;\n- `steps`: 25;\n- `cfg`: 4.5.\n\nThese are the pack\'s own values. In the example `duration` comes from a node that measures the clip; you may type it by hand.',
      },
      prompt: {
        title: 'A description, if you want one',
        body: 'The `prompt` field may stay empty: the model hears the frames. A few words help when the frames say little: "rain on leaves", "crowd in a stadium". The `negative_prompt` field takes what must not be heard, for example "music, speech".\n\n`mask_away_clip` switches off the model\'s look at the frames. Leave it off unless you want sound from the text alone.',
      },
      combine: {
        title: 'Put the sound into the clip',
        body: 'Add a {combine} node. Connect the `IMAGE` output of {video} to its `images` input and the `audio` output of {sampler} to its `audio` input.\n\nSet its `frame_rate` to the frame rate of your clip, otherwise the picture runs faster or slower than the sound. In ComfyUI the finished clip goes into the output folder.',
      },
      tips: {
        title: 'When the sound is bad',
        body: '- The sound lags behind the picture: `frame_rate` in {combine} is not the frame rate of the clip.\n- The sound is wrong for the scene: write two or three words in `prompt`.\n- The sound stops before the clip ends: `duration` is shorter than the clip.\n- Not enough memory: shorter pieces, or `force_offload` left on.\n\nThe ComfyUI-HunyuanVideo-Foley pack does the same job with a larger model. Its files go into models/foley.',
      },
      run: {
        title: 'The graph is ready',
        body: SAVE,
      },
    },
  },
  'audio-transcribe': {
    title: 'Speech to text: Whisper',
    result: 'You build a graph that writes down what is said in a recording and saves subtitles.',
    steps: {
      intro: {
        title: 'What Whisper does',
        body: `Whisper listens to speech and writes it down, with the time of every phrase and word. From that come plain text and subtitles.\n\n${PACK('ComfyUI-Whisper')} The pack downloads the model you choose to models/stt/whisper itself the first time it runs in ComfyUI.\n\n${START}`,
      },
      source: {
        title: 'Load the recording',
        body: 'Add a {source} node and choose the file in its `audio` field.\n\nThe clearer the speech, the fewer mistakes. Music under the voice confuses the model.',
      },
      whisper: {
        title: 'Add Whisper',
        body: 'Add a {whisper} node. Connect the output of {source} to its `audio` input and choose the model in `model`.\n\nThe small models (`tiny`, `base`) are fast and make more mistakes; the large ones (`large-v3`, `turbo`) are slower and much more accurate. Names that end in `.en` know English only. `turbo` is a good start.\n\nIn `language` choose the language of the speech, or leave `auto`. In `prompt` you can list names and rare words that occur in the recording.',
      },
      show: {
        title: 'Show the text',
        body: 'Add a {show} node and connect the `text` output of {whisper} to its `source` input.\n\nIn ComfyUI the node shows the written text right on the canvas.',
      },
      subtitles: {
        title: 'Save the subtitles',
        body: 'Add a {srt} node and connect the `segments_alignment` output of {whisper} to its `alignment` input. In its `name` field write the name of the file.\n\nThe file goes into output/srt in the SRT format, which every video player and editor reads. The `words_alignment` output gives a line for every word, for subtitles that light up word by word.',
      },
      tips: {
        title: 'Video and mistakes',
        body: '- To write down a video, load it with Load Video of Video Helper Suite: its `audio` output goes into the same input of {whisper}, as in the pack\'s example.\n- Names are spelled wrong: write them in `prompt`.\n- Text in another language: set `language` instead of `auto`.\n\nThe pack\'s license allows no commercial use. Read it before you use the pack for work.',
      },
      run: {
        title: 'The graph is ready',
        body: SAVE,
      },
    },
  },
  '3d-image': {
    title: 'A picture into a 3D model: Hunyuan3D 2',
    result: 'You build a graph that turns one picture of an object into a 3D model you can open in other programs.',
    steps: {
      intro: {
        title: 'What comes out',
        body: `Hunyuan3D 2 looks at one picture of an object and builds its shape in 3D. The result is a mesh, a surface of many small triangles, without colours: a white model.\n\nThe best picture shows one object whole, on a plain background, from a little above and to the side.\n\n${START}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {checkpoint} node. In \`ckpt_name\` choose \`hunyuan3d-dit-v2_fp16.safetensors\` (version 2.0) or \`hunyuan_3d_v2.1.safetensors\` (version 2.1) from models/checkpoints.\n\nThis loader takes a model that reads pictures, not text: its outputs are the model, the picture reader \`CLIP_VISION\` and the decoder.\n\n${noFile('the template "HY 3D 2.0" or "HY 3D 2.1: Single View to Model"')}`,
      },
      shift: {
        title: 'Set the noise shift',
        body: 'Add a {shift} node, connect the `MODEL` output of {checkpoint} to its `model` input and set `shift` to 1.\n\nBoth templates use 1. This model was trained for that value.',
      },
      picture: {
        title: 'Load the picture',
        body: 'Add a {picture} node and choose the picture in its `image` field.\n\nA background with other objects becomes part of the model. Remove it first if you can.',
      },
      vision: {
        title: 'Let the model see the picture',
        body: 'Add a {vision} node. Connect the `CLIP_VISION` output of {checkpoint} to its `clip_vision` input and the picture from {picture} to its `image` input. Set `crop` to `center`.\n\nThis node turns the picture into a description the model can follow.',
      },
      condition: {
        title: 'Turn it into a condition',
        body: 'Add a {condition} node and connect the output of {vision} to its `clip_vision_output` input.\n\nIt gives two outputs, `positive` and `negative`, ready for the sampler. Nothing is written by hand here: the picture is the whole description.',
      },
      latent: {
        title: 'Add the blank',
        body: 'Add a {latent} node and set `resolution` to 3072.\n\nThis is how finely the shape is worked out. Version 2.0 uses 3072, version 2.1 uses 4096.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect four inputs:\n- `model` from {shift};\n- `positive` and `negative` from the outputs of the same name of {condition};\n- `latent_image` from {latent}.\n\nSet `steps` to 20 and `cfg` to 8, as the template of version 2.0 does. For version 2.1 the template uses 30 and 5.',
      },
      decode: {
        title: 'Turn the result into a volume',
        body: 'Add a {decode} node. Connect the output of {sampler} to its `samples` input and the `VAE` output of {checkpoint} to its `vae` input.\n\nThe result is a voxel grid: space cut into small cubes, each either inside the object or outside.',
      },
      mesh: {
        title: 'Turn the volume into a mesh',
        body: 'Add a {mesh} node and connect the output of {decode} to its `voxel` input. Set `algorithm` to `surface net` and `threshold` to 0.6.\n\n`surface net` gives a smoother surface than `basic`. The threshold says where the inside ends: lower makes the object fatter, higher thinner and with holes.',
      },
      save: {
        title: 'Save the model',
        body: 'Add a {save} node and connect the output of {mesh} to its `mesh` input.',
      },
      files: {
        title: 'Where the file goes and what opens it',
        body: 'In ComfyUI the node writes a .glb file into the output/3d folder and shows the model on the canvas.\n\nA .glb file opens in Blender (File ▸ Import ▸ glTF), in most 3D viewers and game engines, and in a web browser through any glTF viewer. The model has no colours yet: they are painted in another program or by a texturing graph.\n\nThe ComfyUI-3D-Pack pack and the TRELLIS.2 nodes of ComfyUI itself also build models with colours, but their graphs are much larger.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the model has holes or lumps: a cleaner picture helps most, then a larger \`resolution\`.`,
      },
    },
  },
  'character-kontext': {
    title: 'The same character in a new picture: FLUX.1 Kontext',
    result: 'You build a graph that draws your invented character again, in a new place or pose, with the same face and clothes.',
    steps: {
      intro: {
        title: 'First, about faces',
        body: `FLUX.1 Kontext takes a picture and a sentence of what to change, and keeps the rest: the same face, the same clothes, the same style. That is how one character goes through a whole series of pictures.\n\nThe example in this lesson is an invented character or yourself. A real person's face only with their consent; never in explicit content; never anyone who looks like a minor.\n\n${START}`,
      },
      model: {
        title: 'Load the model',
        body: `Add a {model} node and choose the Kontext file in \`unet_name\`. The template uses \`flux1-dev-kontext_fp8_scaled.safetensors\` from models/diffusion_models.\n\nOnly a Kontext model can do this. A plain FLUX.1 dev ignores the picture.\n\n${noFile('the template "Flux Kontext Dev Image Edit"')}`,
      },
      readers: {
        title: 'Load the text readers and the decoder',
        body: 'Add a {clip} node. Choose `clip_l.safetensors` in `clip_name1`, `t5xxl_fp8_e4m3fn_scaled.safetensors` in `clip_name2`, and set `type` to `flux`.\n\nAdd a {vae} node and choose `ae.safetensors` in `vae_name`.\n\nThese are the same files FLUX.1 uses for pictures from text.',
      },
      picture: {
        title: 'Load the picture of the character',
        body: 'Add a {picture} node and choose the picture of your character in its `image` field.\n\nThe face should be clear and large enough. This picture is the reference: everything the model keeps comes from it.',
      },
      encode: {
        title: 'Prepare the picture',
        body: 'Add a {scale} node and connect the picture from {picture} to its `image` input. Then add an {encode} node: its `pixels` input from {scale}, its `vae` input from {vae}.\n\nThe first node brings the picture to a size Kontext was trained on. The second turns it into the compressed form the model works in.',
      },
      prompt: {
        title: 'Say what changes',
        body: 'Add a {prompt} node and connect the `CLIP` output of {clip} to its `clip` input. In `text` write what is new and what stays. For example: the same woman with short red hair and a green coat, now standing on a rainy street at night, keep her face and clothes.\n\nName the character by what is seen ("the woman with red hair"), not by a pronoun: the model then knows whom to keep.',
      },
      reference: {
        title: 'Give the picture to the description',
        body: 'Add a {reference} node. Connect the output of {prompt} to its `conditioning` input and the output of {encode} to its `latent` input.\n\nThen add a {guidance} node, connect {reference} to its `conditioning` input and set `guidance` to 2.5.\n\nThe first node attaches the picture to the description. The second says how strongly the model follows them: the template uses 2.5.',
      },
      negative: {
        title: 'An empty negative',
        body: 'Add an {empty} node and connect the output of {prompt} to its `conditioning` input.\n\nKontext is not told what to avoid. This node gives the sampler\'s `negative` input the same description set to zero.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect four inputs:\n- `model` from {model};\n- `positive` from {guidance};\n- `negative` from {empty};\n- `latent_image` from {encode}.\n\nSet `steps` to 20 and `cfg` to 1. FLUX models take their guidance from {guidance}, so `cfg` stays at 1.',
      },
      out: {
        title: 'Turn the result into a picture and save it',
        body: 'Add a {decode} node: `samples` from {sampler}, `vae` from {vae}. Then add a {save} node and connect the picture of {decode} to its `images` input.',
      },
      series: {
        title: 'A series with one character',
        body: 'To keep the character through a series:\n- start each new picture from the same reference, not from the last result: small changes add up;\n- change one thing at a time: the place, then the pose, then the light;\n- repeat in every description the features that make the character: hair, clothes, a mark;\n- fix `seed` in {sampler} while you look for a good description.\n\nIf the face drifts, lower `guidance` a little or say "keep the face" in the description.',
      },
      'other-ways': {
        title: 'Other ways to keep a character',
        body: 'Other methods need more files and work only with their own family of models:\n- IP-Adapter FaceID (ComfyUI_IPAdapter_plus pack): SD 1.5 and SDXL, needs InsightFace in models/insightface and its own files in models/ipadapter;\n- PhotoMaker (nodes of ComfyUI itself): SDXL, a file in models/photomaker, several pictures of one face;\n- InfiniteYou (ComfyUI_InfiniteYou pack): FLUX, files in models/infinite_you and InsightFace, much video memory;\n- a LoRA trained on the character: the steadiest, but it has to be trained first.\n\nThe same rule holds for all of them: an invented character or yourself, or a person who gave consent.',
      },
      run: {
        title: 'The graph is ready',
        body: SAVE,
      },
    },
  },
  'face-restore': {
    title: 'Restore a face in an old picture: ReActor',
    result: 'You build a graph that redraws blurred or damaged faces in a picture with a face restoration model.',
    steps: {
      intro: {
        title: 'First, what restoring is',
        body: `A restoration model finds the faces in a picture and draws them again, sharp. It does not know the real face: it guesses the details. The result is a likeness, not a record of how the person looked.\n\nRestore pictures you have the right to use: your own, your family's with their agreement, invented people. A real person's face only with their consent; never in explicit content.\n\n${PACK('ComfyUI-ReActor')} If the folder models/facerestore_models is empty, the pack itself downloads four restoration models there when ComfyUI starts.\n\n${START}`,
      },
      picture: {
        title: 'Load the picture',
        body: 'Add a {picture} node and choose the picture in its `image` field.\n\nIf the picture is very small, enlarge it first with an upscale model: the restoration model works on faces of a certain size.',
      },
      restore: {
        title: 'Add the restoration',
        body: `Add a {restore} node and connect the picture from {picture} to its \`image\` input. In \`model\` choose the restoration model; with \`none\` nothing happens.\n\nThe usual ones: \`codeformer-v0.1.0.pth\` handles badly damaged faces, \`GFPGANv1.4.pth\` keeps more of the original, \`GPEN-BFR-512.onnx\` is sharp on large faces.\n\n${OLD_FORMAT}`,
      },
      settings: {
        title: 'Set how much is changed',
        body: 'In {restore} set:\n- `facedetection`: `retinaface_resnet50`, the most careful way to find faces;\n- `visibility`: 1, how strongly the new face covers the old; lower blends them;\n- `codeformer_weight`: 0.5, for CodeFormer only: closer to 0 is sharper and less alike, closer to 1 is more alike and softer.',
      },
      save: {
        title: 'Save the picture',
        body: 'Add a {save} node and connect the output of {restore} to its `images` input.',
      },
      tips: {
        title: 'When the face looks wrong',
        body: '- The face looks painted on: lower `visibility` to 0.7.\n- The face is not alike: try `GFPGANv1.4.pth` or raise `codeformer_weight`.\n- A face is missed: it is too small or turned away; enlarge the picture first.\n- The rest of the picture stays old: the node restores faces only.\n\nThe facerestore_cf pack does the same with its own nodes and reads the same folder models/facerestore_models.',
      },
      run: {
        title: 'The graph is ready',
        body: SAVE,
      },
    },
  },
};
