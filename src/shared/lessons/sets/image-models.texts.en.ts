import type { LessonWords } from '../texts';

/**
 * The words of the lessons on picture model families (sets/image-models.ts). Each step: what to do and why.
 * `{role}` is replaced by the node's name as this ComfyUI's library shows it; field names and values stand in
 * backticks. The Russian file says the same, step for step, with the same numbers.
 */

const SAVE = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.';

/** When the file a step asks for is not in the list. The app downloads nothing: the person does, in ComfyUI. */
const noFile = (template: string) => `If a file is not in the list, your ComfyUI does not have it. The app downloads nothing. Open ${template} in ComfyUI itself: it shows which files are missing and where to put them. Take files only from the model's official page. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.`;

const DECODE = {
  title: 'Turn the result into a picture',
  body: 'Add a {decode} node. Connect the output of {sampler} to its `samples` input and the output of {vae} to its `vae` input.\n\nThe sampler gives the picture in its compressed form, the latent. The VAE of the same family unfolds it into pixels.',
};

const SAVE_IMAGE = {
  title: 'Save the picture',
  body: 'Add a {save} node and connect the output of {decode} to its `images` input.\n\nWithout it ComfyUI works the picture out and puts it nowhere.',
};

const CHECKPOINT_GRAPH = {
  title: 'A picture graph is needed',
  body: 'This lesson goes on from the graph of the lesson "A first picture from text". The canvas must have {checkpoint}, two {positive} nodes, {latent}, {sampler}, {decode} and {save} with their links.\n\nIf they are not there, do that lesson first.',
};

export const IMAGE_MODEL_TEXTS_EN: Record<string, LessonWords> = {
  flux: {
    title: 'Flux.1: a picture from separate files',
    result: 'You build a Flux graph of ten nodes, where the model, the two text encoders and the VAE come from loaders of their own.',
    steps: {
      intro: {
        title: 'One file or several',
        body: 'SD 1.5 and SDXL come as one checkpoint file: the model that draws, the text encoder and the VAE in one. Newer families come as separate files, and each file has a loader node of its own.\n\nThe Flux family by Black Forest Labs has three models with one graph: dev (the main one), schnell (fast, distilled to a few steps) and Krea dev (dev trained further for a more natural look). Only the model file and the number of steps change.\n\nThis graph is the one of ComfyUI\'s own template "Flux.1 Dev: Text to Image".',
      },
      files: {
        title: 'Which files your family needs',
        body: `Put the files into these folders of ComfyUI:\n- the model: \`flux1-dev.safetensors\`, \`flux1-schnell.safetensors\` or \`flux1-krea-dev_fp8_scaled.safetensors\` in models/diffusion_models;\n- two text encoders: \`clip_l.safetensors\` and \`t5xxl_fp16.safetensors\` (or the smaller \`t5xxl_fp8_e4m3fn_scaled.safetensors\`) in models/text_encoders;\n- the VAE: \`ae.safetensors\` in models/vae.\n\nThe text encoders and the VAE serve dev, schnell and Krea alike. The full dev model is about 24 GB: with a small video card take an fp8 file, or a GGUF file (the lesson "A quantised model: GGUF").\n\nThere is also \`flux1-dev-fp8.safetensors\` in models/checkpoints, one file with all three parts: it goes into Load Checkpoint, like SDXL. This lesson is about the separate files.\n\n${noFile('the template "Flux.1 Dev: Text to Image"')}`,
      },
      model: {
        title: 'Load the model',
        body: 'Add a {unet} node and choose the Flux model in its `unet_name` field.\n\nThis loader takes only the part that draws, from models/diffusion_models. It has one output, `MODEL`. Leave `weight_dtype` at `default`; `fp8_e4m3fn` halves the memory of a full file at a small cost in quality.',
      },
      'text-encoders': {
        title: 'Load the two text encoders',
        body: 'Add a {clip} node. In `clip_name1` choose `clip_l.safetensors`, in `clip_name2` the t5xxl file, and set `type` to `flux`.\n\nFlux reads the prompt with two encoders at once: CLIP-L gives the general idea, T5-XXL reads long sentences. The `type` field tells ComfyUI how to join them. With another type the prompt is read wrongly and the picture ignores it.',
      },
      vae: {
        title: 'Load the VAE',
        body: 'Add a {vae} node and choose `ae.safetensors` in `vae_name`.\n\nThis is the VAE of Flux. The VAE of SD 1.5 or SDXL gives noise or an error here: Flux works with another compressed form of the picture.',
      },
      prompt: {
        title: 'Write the prompt in sentences',
        body: 'Add a {positive} node and connect the output of {clip} to its `clip` input. In its `text` field describe the picture in whole sentences. For example: a red bicycle leans against a white wall in the morning sun, long soft shadows.\n\nT5 understands ordinary language. Say what is in the picture, where, in what light and in what style. Tags and weights in brackets matter much less here than in SD 1.5.',
      },
      negative: {
        title: 'Feed the negative input',
        body: 'Add a {zero} node and connect the output of {positive} to its `conditioning` input.\n\nFlux dev was trained without a negative prompt: at cfg 1 the sampler does not read the negative input at all. But the input must be fed, and this node gives an empty conditioning of the right shape, as ComfyUI\'s template does. Say what you do not want inside the prompt instead: "a clean wall without posters".',
      },
      latent: {
        title: 'Add the empty latent of Flux',
        body: 'Add a {latent} node. Set `width` and `height` to 1024.\n\nThis empty latent has 16 channels, the form Flux works in, and it is the node ComfyUI\'s template uses. The usual Empty Latent Image makes the 4 channels of SD 1.5 and SDXL; a recent ComfyUI quietly fits an empty latent to the model, so it works too, but keep to the template\'s node. Flux draws well from about 0.5 to 2 megapixels: 1024 by 1024, 832 by 1216, 1216 by 832. Both sides must divide by 16.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect:\n- to `model`, the output of {unet};\n- to `positive`, the output of {positive};\n- to `negative`, the output of {zero};\n- to `latent_image`, the output of {latent}.',
      },
      settings: {
        title: 'Set the sampler for Flux',
        body: 'In {sampler} set:\n- `steps`: 20 (4 for schnell);\n- `cfg`: 1;\n- `sampler_name`: `euler`;\n- `scheduler`: `simple`.\n\nFlux dev and schnell are distilled: how closely the picture follows the prompt is built into the model. With a cfg above 1 ComfyUI also works out the negative: every step takes twice as long and the colours usually burn. Schnell is made for 1 to 4 steps; dev and Krea need about 20.',
      },
      guidance: {
        title: 'Set the guidance of Flux',
        body: 'Add a {guidance} node between the prompt and the sampler: the output of {positive} goes into its `conditioning` input, and its output into the `positive` input of {sampler}. Set `guidance` to 3.5.\n\nThis is how Flux dev is told how closely to follow the prompt, instead of cfg. ComfyUI already uses 3.5 when the node is missing, so the node is for another number: 2 to 3 for a softer, more natural picture, 4 to 5 for a stricter one. Schnell does not read it. Other Flux models have their own numbers: Kontext 2.5, Fill and Canny 30.',
      },
      decode: DECODE,
      save: SAVE_IMAGE,
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the result is bad:\n- grey noise or an error: the VAE or the empty latent is not the one of Flux;\n- the picture ignores the prompt: check \`type\` \`flux\` and both encoder files;\n- burnt colours: \`cfg\` above 1 or \`guidance\` too high;\n- not enough video memory: fp8 files, \`weight_dtype\` \`fp8_e4m3fn\`, or a GGUF model.\n\nOnly LoRAs made for Flux.1 work here. They go between {unet} and {sampler} in a Load LoRA node, usually the one for the model only.`,
      },
    },
  },
  'zimage-turbo': {
    title: 'Z-Image Turbo: a picture in eight steps',
    result: 'You build a graph for a distilled model that draws in 8 steps with cfg 1, and learn why its negative prompt does nothing.',
    steps: {
      intro: {
        title: 'What a distilled model is',
        body: 'Turbo, Lightning, schnell, distilled: these words mean a model taught to draw in a few steps. It is fast, and it pays for that: cfg must be 1, so the negative prompt is not read, and more steps rarely help.\n\nZ-Image Turbo by Alibaba Tongyi is such a model. It draws photos well, understands English and Chinese and can write short words in a picture.\n\nThe graph is the one of ComfyUI\'s template "Z-Image-Turbo: Text to Image".',
      },
      files: {
        title: 'Which files your family needs',
        body: `- the model: \`z_image_turbo_bf16.safetensors\` in models/diffusion_models;\n- the text encoder: \`qwen_3_4b.safetensors\` in models/text_encoders. This is a small language model: it reads the prompt the way it reads any text;\n- the VAE: \`ae.safetensors\` in models/vae, the same file as for Flux.\n\nThe base model Z-Image (without Turbo) takes the same encoder and VAE, with its own model file \`z_image_bf16.safetensors\`.\n\n${noFile('the template "Z-Image-Turbo: Text to Image"')}`,
      },
      model: {
        title: 'Load the model',
        body: 'Add a {unet} node and choose the Z-Image Turbo file in `unet_name`.\n\nThe loader takes the part that draws from models/diffusion_models. Its text encoder and VAE come from loaders of their own.',
      },
      'text-encoder': {
        title: 'Load the text encoder',
        body: 'Add a {clip} node. Choose the Qwen file in `clip_name` and set `type` to `lumina2`.\n\nZ-Image reads the prompt the way the Lumina family does, so ComfyUI names the type after it. With another type the file is read wrongly, and the picture has nothing to do with the prompt.',
      },
      vae: {
        title: 'Load the VAE',
        body: 'Add a {vae} node and choose `ae.safetensors` in `vae_name`.\n\nZ-Image works with the same compressed form of the picture as Flux, so it takes the same VAE.',
      },
      shift: {
        title: 'Set the shift',
        body: 'Add a {shift} node and connect the `MODEL` output of {unet} to its `model` input. Set `shift` to 3.\n\nModels of this kind remove noise along a straight path, and the shift says where on that path the steps are spent. A higher shift spends more of them on the large shapes, a lower one on fine detail. The number comes from ComfyUI\'s template; try 2 to 6 if the composition falls apart or the detail is mushy.',
      },
      prompt: {
        title: 'Write the prompt',
        body: 'Add a {positive} node and connect the output of {clip} to its `clip` input. Describe the picture in its `text` field in sentences. Words to be written in the picture go in quotes: a ceramic mug on a wooden table with the word "MORNING" printed on it, soft window light.\n\nA language model reads a long, exact prompt better than a list of tags.',
      },
      negative: {
        title: 'Feed the negative input',
        body: 'Add a {zero} node and connect the output of {positive} to its `conditioning` input.\n\nAt cfg 1 the sampler does not read the negative input, so ComfyUI\'s template gives it an empty conditioning. A negative prompt here does nothing: say what you do not want inside the prompt itself.',
      },
      latent: {
        title: 'Add the empty latent',
        body: 'Add a {latent} node and set `width` and `height` to 1024.\n\nThis is the same empty latent as for Flux, with 16 channels. Z-Image draws well up to about 2 megapixels; both sides must divide by 16.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect:\n- to `model`, the output of {shift}, not that of the loader;\n- to `positive`, the output of {positive};\n- to `negative`, the output of {zero};\n- to `latent_image`, the output of {latent}.',
      },
      settings: {
        title: 'Few steps, cfg 1',
        body: 'In {sampler} set:\n- `steps`: 8;\n- `cfg`: 1;\n- `sampler_name`: `res_multistep`;\n- `scheduler`: `simple`.\n\nThe model was taught to finish in about eight steps. With fewer the picture stays rough, with many more it does not get better. A cfg above 1 burns the colours and doubles the time.',
      },
      decode: DECODE,
      save: SAVE_IMAGE,
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the result is bad:\n- grey noise or an error: the VAE is not \`ae.safetensors\`;\n- the picture ignores the prompt: \`type\` is not \`lumina2\`;\n- plastic skin or burnt colours: \`cfg\` above 1.\n\nThe base Z-Image (without Turbo) uses the same graph with other numbers: 25 steps, \`cfg\` 4, and a real negative prompt in a second text node instead of {zero}. Only LoRAs made for Z-Image work with it.`,
      },
    },
  },
  'qwen-image': {
    title: 'Qwen-Image: words inside the picture',
    result: 'You build a Qwen-Image graph with a real negative prompt, the shift of the family and its own size.',
    steps: {
      intro: {
        title: 'A model that writes',
        body: 'Qwen-Image by Alibaba Qwen is a large model known for lettering: signs, posters and labels in English and Chinese come out readable. Its newer version is Qwen-Image 2512.\n\nUnlike the turbo models it works with cfg above 1, so its negative prompt is read and works.\n\nThe graph is the one of ComfyUI\'s templates "Qwen-Image" and "Qwen Image 2512".',
      },
      files: {
        title: 'Which files your family needs',
        body: `- the model: \`qwen_image_fp8_e4m3fn.safetensors\` or \`qwen_image_2512_fp8_e4m3fn.safetensors\` in models/diffusion_models (about 20 GB);\n- the text encoder: \`qwen_2.5_vl_7b_fp8_scaled.safetensors\` in models/text_encoders, a language model that also sees pictures;\n- the VAE: \`qwen_image_vae.safetensors\` in models/vae.\n\nThe edit models of the family (Qwen-Image-Edit) take the same encoder and VAE, but their graph is another one.\n\n${noFile('the template "Qwen-Image"')}`,
      },
      model: {
        title: 'Load the model',
        body: 'Add a {unet} node and choose the Qwen-Image file in `unet_name`.\n\nThe file is large. If it does not fit into the video card, ComfyUI moves part of it to the main memory and works slower, or a GGUF file of the model helps.',
      },
      'text-encoder': {
        title: 'Load the text encoder',
        body: 'Add a {clip} node. Choose the Qwen 2.5 VL file in `clip_name` and set `type` to `qwen_image`.\n\nThe type tells ComfyUI which family the encoder serves. The same file with another type gives a picture that does not follow the prompt.',
      },
      vae: {
        title: 'Load the VAE',
        body: 'Add a {vae} node and choose `qwen_image_vae.safetensors` in `vae_name`.\n\nQwen-Image has a VAE of its own; the VAE of Flux does not fit it.',
      },
      shift: {
        title: 'Set the shift',
        body: 'Add a {shift} node and connect the `MODEL` output of {unet} to its `model` input. Set `shift` to 3.1, the number of ComfyUI\'s template.\n\nThe shift says where the steps are spent: a higher one gives more of them to the large shapes, a lower one to fine detail. If small letters come out blurred, try a little lower.',
      },
      prompts: {
        title: 'Write the prompt and the negative',
        body: 'Add two {positive} nodes and connect the output of {clip} to the `clip` input of each.\n\nIn the `text` field of the first, describe the picture in detail, in sentences. Put the words to be written in quotes and say where they stand: a bakery shop window at dusk, a hand-painted sign above the door reads "FRESH BREAD", warm light inside.\n\nIn the second write what is not wanted: blurry, low resolution, distorted letters. At cfg 4 the model reads it and steers away.',
      },
      latent: {
        title: 'Add the empty latent in the size of the family',
        body: 'Add a {latent} node. Set `width` and `height` to 1328.\n\nQwen-Image was trained at about 1.7 megapixels; at 1024 it draws, but small letters suffer. The model\'s page also gives 1664 by 928 and 928 by 1664 for wide and tall pictures; this step asks for the square.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect:\n- to `model`, the output of {shift};\n- to `positive` and `negative`, the two text nodes;\n- to `latent_image`, the output of {latent}.',
      },
      settings: {
        title: 'Set the sampler',
        body: 'In {sampler} set:\n- `steps`: 20;\n- `cfg`: 4;\n- `sampler_name`: `euler`;\n- `scheduler`: `simple`.\n\nThese are the numbers of the template "Qwen-Image". The template of 2512 gives 50 steps for the most detail; it takes longer.',
      },
      decode: DECODE,
      save: SAVE_IMAGE,
      lightning: {
        title: 'Faster: the Lightning LoRA',
        body: 'The family has speed-up LoRAs (Lightning) that make it a few-step model. In ComfyUI\'s template the LoRA stands in a Load LoRA node for the model only, between {unet} and {shift}, at strength 1. Then the sampler takes 8 steps and `cfg` 1 (with the four-step LoRA, 4 steps).\n\nAt cfg 1 the negative prompt is no longer read: this is the price of speed. The LoRA must be made for your version: those of Qwen-Image and of 2512 differ.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the result is bad:\n- the letters are wrong: shorter words, each in its own quotes, said where they stand; a size from the model's page;\n- the picture ignores the prompt: \`type\` is not \`qwen_image\`;\n- colours go off: the VAE is not the one of Qwen-Image.\n\nThe same graph serves the base Z-Image: model \`z_image_bf16.safetensors\`, encoder \`qwen_3_4b.safetensors\` with type \`lumina2\`, VAE \`ae.safetensors\`, shift 3, size 1024, 25 steps, \`cfg\` 4, \`res_multistep\`.`,
      },
    },
  },
  'flux2-klein': {
    title: 'Flux.2 Klein: a sampler built from parts',
    result: 'You build the graph of a small Flux.2 model, where the sampler is put together from five nodes.',
    steps: {
      intro: {
        title: 'Flux.2 and its small models',
        body: 'Flux.2 by Black Forest Labs comes as one large model, dev, and small ones, Klein, in two sizes: 4B and 9B. Each Klein comes as a base model and as a distilled one.\n\nFlux.2 is not Flux.1 made bigger. Its text encoder is a language model, its VAE and empty latent are its own, and no file of Flux.1 fits it.\n\nThe official templates build its sampler from parts: KSampler takes everything in one node, while here the noise, the guide, the sampling method and the schedule are separate nodes. This is the graph of the template "FLUX.2 [Klein] 4B: Text to Image".',
      },
      files: {
        title: 'Which files your family needs',
        body: `For Klein 4B:\n- the model: \`flux-2-klein-base-4b.safetensors\` (base) or \`flux-2-klein-4b.safetensors\` (distilled) in models/diffusion_models;\n- the text encoder: \`qwen_3_4b.safetensors\` in models/text_encoders, the same file as for Z-Image;\n- the VAE: \`flux2-vae.safetensors\` in models/vae.\n\nKlein 9B takes \`flux-2-klein-base-9b-fp8.safetensors\` and the larger encoder \`qwen_3_8b_fp8mixed.safetensors\`. Flux.2 dev takes a Mistral encoder and is many times larger.\n\n${noFile('the template "FLUX.2 [Klein] 4B: Text to Image"')}`,
      },
      model: {
        title: 'Load the model',
        body: 'Add a {unet} node and choose the Klein file in `unet_name`.\n\nThis lesson sets the numbers of the base model. For the distilled one, the step "Base and distilled" says what changes.',
      },
      'text-encoder': {
        title: 'Load the text encoder',
        body: 'Add a {clip} node. Choose the Qwen file in `clip_name` and set `type` to `flux2`.\n\nThe same file serves Z-Image with another type: the type tells ComfyUI which model the encoder feeds.',
      },
      vae: {
        title: 'Load the VAE',
        body: 'Add a {vae} node and choose `flux2-vae.safetensors` in `vae_name`.\n\nThe VAE of Flux.1 does not fit Flux.2: the compressed form of the picture is another one.',
      },
      prompts: {
        title: 'Write the prompt and the negative',
        body: 'Add two {positive} nodes and connect the output of {clip} to the `clip` input of each. In the `text` field of the first, describe the picture in sentences: a hedgehog in a tiny party hat among confetti, flash photo of an old digital camera.\n\nThe base model reads the negative, so the second node may hold what is not wanted, or stay empty.',
      },
      guider: {
        title: 'The guide: how closely to follow the prompt',
        body: 'Add a {guider} node and connect:\n- to `model`, the output of {unet};\n- to `positive` and `negative`, the two text nodes.\n\nSet `cfg` to 5. This node is the part of KSampler that weighs the prompt against the negative.',
      },
      latent: {
        title: 'Add the empty latent of Flux.2',
        body: 'Add a {latent} node and set `width` and `height` to 1024.\n\nIts latent has 128 channels at a sixteenth of the size, and this is the node of ComfyUI\'s template. Both sides must divide by 16.',
      },
      schedule: {
        title: 'The schedule of the noise',
        body: 'Add a {schedule} node. Set `steps` to 20, and `width` and `height` the same as in {latent}.\n\nThis node works out how much noise is left before each step. For Flux.2 it depends on the size of the picture, so the size here must be that of the empty latent.',
      },
      method: {
        title: 'The sampling method and the noise',
        body: 'Add a {method} node and choose `euler` in `sampler_name`. Add a {noise} node: its `noise_seed` field is the seed, the number the starting noise is made from.\n\nIn KSampler these are two fields; here they are two nodes.',
      },
      sampler: {
        title: 'Put the sampler together',
        body: 'Add a {sampler} node and connect its five inputs:\n- `noise`: the output of {noise};\n- `guider`: the output of {guider};\n- `sampler`: the output of {method};\n- `sigmas`: the output of {schedule};\n- `latent_image`: the output of {latent}.\n\nThis node does the work. Its first output, `output`, is the finished latent.',
      },
      decode: {
        title: 'Turn the result into a picture',
        body: 'Add a {decode} node. Connect the `output` output of {sampler} to its `samples` input and the output of {vae} to its `vae` input.',
      },
      save: SAVE_IMAGE,
      distilled: {
        title: 'Base and distilled',
        body: 'The distilled Klein is made for speed. In the same template its numbers are: `steps` 4 in {schedule}, `cfg` 1 in {guider}, and an empty conditioning node instead of the negative prompt: at cfg 1 the negative is not read.\n\nFlux.2 dev is built the same way with two changes: a Basic Guider without a negative instead of {guider}, and a Flux Guidance node with 4 on the prompt.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the result is bad:\n- grey noise or an error: the VAE is not the one of Flux.2;\n- a blurred or strange picture: the size in {schedule} differs from that of {latent};\n- burnt colours on the distilled model: \`cfg\` is above 1.\n\nLoRAs of Flux.1 do not fit Flux.2, and those of Klein 4B do not fit Klein 9B.`,
      },
    },
  },
  gguf: {
    title: 'A quantised model: GGUF',
    result: 'You put a GGUF model into a graph of separate files, so a large model fits a smaller video card.',
    steps: {
      intro: {
        title: 'First, the rules',
        body: 'GGUF files load through the ComfyUI-GGUF node pack. A node pack runs other people\'s code on your computer: install it yourself through ComfyUI\'s manager, restart ComfyUI and choose "Sync ▸ Sync now" here. Take model files only from the official page of the model or of the person who quantised it.\n\nA quantised model is the same model with its numbers stored in fewer bits. The file and the video memory it needs get smaller, the quality a little lower. The pack\'s author says this works well for transformer models such as Flux, Z-Image, Qwen-Image and SD 3.5, and badly for the older SD 1.5 and SDXL.',
      },
      graph: {
        title: 'A graph of separate files is needed',
        body: 'This lesson goes on from the graph of the lesson "Flux.1: a picture from separate files" or "Z-Image Turbo: a picture in eight steps". The canvas must have {positive}, {sampler}, {decode} and {save} with their links.\n\nIf they are not there, do one of those lessons first.',
      },
      quants: {
        title: 'How to read the name of a GGUF file',
        body: 'The letters after Q tell how the model was squeezed. The number is about the bits per weight:\n- Q8_0: nearly the same as the original, about half of a 16-bit file;\n- Q6_K and Q5_K_M: a good balance;\n- Q4_K_S and Q4_0: about a quarter of the size, the detail gets simpler;\n- Q3 and Q2: only when nothing else fits.\n\nChoose the largest one that fits into your video card together with the text encoder.',
      },
      loader: {
        title: 'Put the GGUF loader in',
        body: 'Add a {gguf} node and choose your .gguf file in `unet_name`. The pack looks for these files in models/unet and models/diffusion_models and lists only files ending in .gguf.\n\nConnect its `MODEL` output to where the output of the old loader went: to the `model` input of {sampler}, or, in the Z-Image graph, to the `model` input of the shift node in front of the sampler.',
      },
      'old-loader': {
        title: 'The old loader',
        body: 'The usual model loader is no longer needed: delete it. A node whose output leads nowhere is not run by ComfyUI anyway.\n\nThe text encoders, the VAE and every setting stay as they were. The GGUF file must be of the same family as the rest of the graph: a GGUF of Flux needs the encoders and the VAE of Flux.',
      },
      encoder: {
        title: 'The text encoder in GGUF',
        body: 'Large text encoders such as T5-XXL also come as .gguf files. The pack has loaders for them that stand in for the usual ones: CLIPLoader (GGUF) and DualCLIPLoader (GGUF), with the same `type`. They read both .gguf and .safetensors files.\n\nLoRAs go through the usual LoRA loaders; the pack\'s author calls this experimental.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf it does not work:\n- the GGUF node is missing in ComfyUI: the pack is not installed, or ComfyUI was not restarted;\n- the file is not in the list: it is not in models/unet or models/diffusion_models, or it does not end in .gguf;\n- an error about the model type: the file is of another family than the graph.\n\nGGUF runs a little slower than an unpacked file of the same size: the numbers are unpacked at every step.`,
      },
    },
  },
  sdxl: {
    title: 'SDXL done properly',
    result: 'You set an SDXL graph to the size and the settings the family was trained for.',
    steps: {
      intro: {
        title: 'What SDXL is',
        body: 'SDXL by Stability AI is a family of one base model and thousands of models trained further from it: Juggernaut XL, RealVis XL and many more. Each is one checkpoint file with the model, two text encoders and the VAE.\n\nSDXL was trained at about one megapixel. At 512 by 512, the size of SD 1.5, it draws badly: repeated objects, broken faces. This lesson sets the graph to its own numbers, as ComfyUI\'s template "SDXL1.0: Text to Image (Simple)" does.',
      },
      graph: CHECKPOINT_GRAPH,
      model: {
        title: 'Choose an SDXL model',
        body: 'In the `ckpt_name` field of {checkpoint} choose an SDXL model: the base `sd_xl_base_1.0.safetensors` or one trained further from it. The files lie in models/checkpoints.\n\nAn SDXL file is about 6.5 GB; an SD 1.5 one is 2 to 4 GB. Pony and Illustrious are SDXL too, and have a lesson of their own.',
      },
      size: {
        title: 'Set the size of SDXL',
        body: 'In {latent} set `width` and `height` to 1024.\n\nOther sizes of the same area: 896 by 1152, 832 by 1216, 768 by 1344, and the same turned on its side. Keep near one megapixel and both sides divisible by 64.',
      },
      settings: {
        title: 'Set the sampler',
        body: 'In {sampler} set:\n- `steps`: 25;\n- `cfg`: 7;\n- `sampler_name`: `dpmpp_2m`;\n- `scheduler`: `karras`.\n\nThese are the numbers of ComfyUI\'s template. A model trained further may ask for others on its page: then its page wins.',
      },
      texts: {
        title: 'Both texts work',
        body: 'Write the prompt in the `text` field of {positive}, and in the `text` field of the other text node what is not wanted: blurry, low quality, watermark.\n\nSDXL works with cfg above 1, so its negative is read. It understands short sentences and comma lists equally; the models trained further on tags have their own lesson.',
      },
      'two-fields': {
        title: 'Two encoders, one text',
        body: 'SDXL reads the prompt with two encoders, CLIP-L and the larger OpenCLIP-G. The usual text node gives the same text to both, as the template does, and this is right for nearly every case.\n\nThe node CLIP Text Encode (SDXL) has a field for each, `text_g` and `text_l`, and fields for the size. Few people need it.',
      },
      refiner: {
        title: 'The refiner: a piece of history',
        body: 'SDXL 1.0 came with a second model, the refiner, which finished the last steps. ComfyUI\'s template "SDXL Simple" still shows it: the base does 20 of 25 steps and hands the rest over.\n\nModels trained further do not need it and it can spoil their faces. Today a second pass is done by redrawing with any model you like: the lesson "Refining with a second model".',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the result is bad:\n- doubled people or objects: the size is far from one megapixel;\n- burnt, oversharp colours: \`cfg\` too high, try 5;\n- a washed-out picture: the model may need a VAE file of its own; its page says so.`,
      },
    },
  },
  tags: {
    title: 'Pony and Illustrious: tags instead of sentences',
    result: 'You write a tag prompt with the quality words of the model\'s page and set the size and sampler such models are used with.',
    steps: {
      intro: {
        title: 'Families trained on tags',
        body: 'Pony Diffusion V6 XL, Illustrious XL and NoobAI XL are SDXL models trained further on pictures described with tags: short words and phrases separated by commas.\n\nThey load exactly like SDXL. What changes is how you write for them: tags instead of sentences, the quality words of the model\'s page, a fitting size, and a note on "clip skip". LoRAs made for one line work best within that line.\n\nThe examples here are neutral. The source of truth is the page of your model.',
      },
      graph: {
        title: 'An SDXL graph is needed',
        body: 'This lesson goes on from the graph of the lesson "SDXL done properly". The canvas must have {checkpoint}, two {positive} nodes, {latent}, {sampler}, {decode} and {save} with their links.\n\nIf they are not there, do that lesson first.',
      },
      model: {
        title: 'Choose the model',
        body: 'In `ckpt_name` choose a Pony, Illustrious or NoobAI model, or one trained further from them. Its page names its line.\n\nThe file is an SDXL checkpoint in models/checkpoints.',
      },
      quality: {
        title: 'Quality words come from the model\'s page',
        body: 'These models learned special tags for quality. They stand at the start of the prompt:\n- Pony: `score_9, score_8_up, score_7_up`;\n- Illustrious and NoobAI: `masterpiece, best quality`.\n\nThey also learned rating tags for the kind of content; for neutral pictures Pony uses `rating_safe`, Illustrious and NoobAI `general`.\n\nCopy these words from your model\'s page: a model trained further from Pony may need none of them.',
      },
      tags: {
        title: 'Write the prompt in tags',
        body: 'In the `text` field of {positive} write tags separated by commas: the quality words first, then what is in the picture, then the style and light. For example: masterpiece, best quality, scenery, mountain lake, sunrise, pine trees, mist, no humans.\n\nTags that name the same thing in different words add little. The ones that the model knows come from the site its pictures were tagged on; the model page often names it.',
      },
      negative: {
        title: 'Write the negative in tags',
        body: 'In the `text` field of the other text node write tags of what is not wanted: worst quality, low quality, blurry, watermark, signature.\n\nPony also takes the low scores here; its page names them.',
      },
      size: {
        title: 'Choose a portrait size',
        body: 'In {latent} set `width` to 832 and `height` to 1216.\n\nThis is one of the SDXL sizes; such models are mostly used for upright pictures. For a landscape take 1216 by 832, for a square 1024 by 1024.',
      },
      settings: {
        title: 'Set the sampler',
        body: 'In {sampler} set `steps` to 28, `cfg` to 6 and `sampler_name` to `euler_ancestral`.\n\nThe pages of these models usually advise cfg from 5 to 7 and Euler Ancestral. Leave `scheduler` as the page says, `normal` or `karras`.',
      },
      'clip-skip': {
        title: 'Clip skip',
        body: 'The pages of these models often say "clip skip 2": read the prompt from the second-to-last layer of the text encoder. In ComfyUI the SDXL encoders already read that layer, so nothing needs to be added.\n\nIf you put in a CLIP Set Last Layer node anyway, give its only field -2: with -1 it would switch to the last layer and change the picture. With anime models of SD 1.5 it is the other way round: ComfyUI reads the last layer, and the node with -2 is needed when the page asks for clip skip 2.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the result is bad:\n- the picture is plain and flat: the quality words of the page are missing or misspelt;\n- the model does not obey a tag: look it up in the tag list of the site the page names; a sentence is read worse than tags;\n- burnt colours: \`cfg\` lower, 5.`,
      },
    },
  },
  loaders: {
    title: 'Which loader for which file',
    result: 'You find the right loader for four kinds of model files and learn where ComfyUI looks for each.',
    steps: {
      intro: {
        title: 'Every loader has its folder',
        body: 'A model file comes in one of a few kinds, and each kind has its loader node and its folder in ComfyUI. A loader lists only the files of its own folder. So when a file is not in the list, it lies in another folder or is another kind of file.\n\nIn this lesson you put four loaders on the canvas and choose a file in each. They do not need to be linked: the aim is to know which node takes which file.',
      },
      checkpoint: {
        title: 'A checkpoint: Load Checkpoint',
        body: 'Add a {checkpoint} node and choose a file in `ckpt_name`.\n\nA checkpoint holds three parts in one file, so the node has three outputs: the model, the text encoder and the VAE. ComfyUI looks for it in models/checkpoints. SD 1.5, SDXL, Pony, Illustrious and SD 3.5 usually come this way.',
      },
      diffusion: {
        title: 'A diffusion model alone: Load Diffusion Model',
        body: 'Add a {unet} node and choose a file in `unet_name`.\n\nThis is only the part that draws, without the text encoder and the VAE. ComfyUI looks for it in models/diffusion_models (and in the old folder models/unet). Flux, Flux.2, Z-Image, Qwen-Image, HiDream and the video models come this way. The `weight_dtype` field can squeeze a full file into fp8 to save memory.',
      },
      encoder: {
        title: 'A text encoder: Load CLIP',
        body: 'Add a {clip} node, choose a file in `clip_name` and the family in `type`.\n\nThe text encoder turns the prompt into numbers for the model. ComfyUI looks for it in models/text_encoders (and in the old models/clip). The type must match the family: `lumina2` for Z-Image, `qwen_image` for Qwen-Image, `flux2` for Flux.2, `sd3` for a single T5 of SD 3.5. Families with two encoders take the node for two files (Flux.1: `flux`), SD 3.5 the one for three, HiDream the one for four.',
      },
      vae: {
        title: 'A VAE: Load VAE',
        body: 'Add a {vae} node and choose a file in `vae_name`.\n\nThe VAE turns the latent into pixels and back. ComfyUI looks for it in models/vae. Each family has its own: `ae.safetensors` for Flux.1 and Z-Image, `flux2-vae.safetensors` for Flux.2, `qwen_image_vae.safetensors` for Qwen-Image.\n\nThe list may also show small preview files (taesd, taesdxl, taef1 and others) from models/vae_approx. They are quick and rough: ComfyUI uses them to show the picture while it is being drawn. For the final picture take the full VAE.',
      },
      tell: {
        title: 'How to tell what a file is',
        body: 'Ways to tell, from the surest:\n- the official template of the model names each file and its folder;\n- the model\'s page says "checkpoint", "diffusion model", "text encoder" or "VAE";\n- the size: a VAE is up to a few hundred MB, an SD 1.5 checkpoint 2 to 4 GB, an SDXL one about 6.5 GB, a large diffusion model alone 10 to 40 GB;\n- the card of the file in the "Models" tab of this app names its family.\n\nA checkpoint in Load Diffusion Model or a diffusion model in Load Checkpoint ends in an error. A .gguf file needs the loaders of the GGUF pack. The old formats .ckpt, .pt, .pth and .bin can run code when loaded: prefer .safetensors.',
      },
      others: {
        title: 'Other files of picture graphs',
        body: 'Other kinds you will meet, with their folder:\n- LoRA: models/loras, the Load LoRA node;\n- ControlNet: models/controlnet;\n- upscale models: models/upscale_models;\n- CLIP Vision, for a picture as a hint: models/clip_vision;\n- embeddings: models/embeddings; they have no node and are called in the prompt as embedding:name.',
      },
      run: {
        title: 'What next',
        body: 'Now you know which node takes which file. The lessons "Flux.1: a picture from separate files" and "Z-Image Turbo: a picture in eight steps" build whole graphs from such loaders.\n\nThese four loaders can stay on the canvas or be deleted: a loader whose output leads nowhere is not run by ComfyUI.',
      },
    },
  },
  samplers: {
    title: 'Choosing a sampler and a scheduler',
    result: 'You put two samplers side by side that differ in one setting only, and learn to choose by comparing.',
    roles: { sampler: 'first sampler', samplerB: 'second sampler', decode: 'decoder of the first sampler', decodeB: 'decoder of the second sampler', save: 'saver of the first sampler', saveB: 'saver of the second sampler' },
    steps: {
      intro: {
        title: 'Two settings, one way to choose',
        body: 'The sampler (`sampler_name`) is the way each step removes noise. The scheduler (`scheduler`) decides how much noise is left before each step. Together they change the look of the picture, its detail and how many steps it needs.\n\nThere is no best pair for every model. The way to choose is to compare: the same seed, the same steps and cfg, one setting changed. This lesson builds such a comparison on one canvas.',
      },
      graph: CHECKPOINT_GRAPH,
      second: {
        title: 'Add a second sampler',
        body: 'Add a second {samplerB} node and connect to it the same as to the first:\n- to `model`, the output of {checkpoint};\n- to `positive` and `negative`, the same two text nodes;\n- to `latent_image`, the same {latent}.\n\nBoth samplers start from one empty latent and one prompt.',
      },
      same: {
        title: 'Make everything the same',
        body: 'In {samplerB} set `seed`, `steps`, `cfg` and `scheduler` the same as in the first sampler.\n\nThe seed is the number the starting noise is made from. With the same seed both start from the same noise, so any difference in the result comes from the one setting you change.',
      },
      other: {
        title: 'Change only the sampler',
        body: 'In {samplerB} choose another `sampler_name`. For example, `euler` in the first and `dpmpp_2m` in the second.',
      },
      out: {
        title: 'Show the second result',
        body: 'Add a {decodeB} node and a {saveB} node. The output of {samplerB} goes into the `samples` input of {decodeB}, the `VAE` output of {checkpoint} into its `vae` input, and its output into the `images` input of {saveB}.\n\nNow one run gives two pictures side by side.',
      },
      fixed: {
        title: 'Fix the seed and run',
        body: 'Under `seed` each sampler has a choice of what happens after a run. Set it to `fixed` in both, or ComfyUI changes the seed after every run and the comparison breaks.\n\nSave the graph, run it in ComfyUI and look at the two pictures: sharpness, colour, small detail, how faithful to the prompt. Then try a third sampler in the second node, and so on.',
      },
      schedulers: {
        title: 'Then the scheduler',
        body: 'Now give both samplers the same `sampler_name` and change only `scheduler` in the second.\n- `normal` and `simple`: even steps;\n- `karras` and `exponential`: more steps at the end, on fine detail;\n- `sgm_uniform`: the one SD 3.5 is used with;\n- `beta`: more steps at the start and the end.\n\nWith 20 steps or more the difference is often small; with few steps it is large.',
      },
      guide: {
        title: 'Where to start for each family',
        body: 'Pairs from ComfyUI\'s own templates, a good start:\n- SD 1.5 and SDXL: `dpmpp_2m` with `karras`, 20 to 30 steps; Pony and Illustrious: `euler_ancestral`;\n- Flux.1, Flux.2, Qwen-Image: `euler` with `simple`;\n- SD 3.5: `euler` with `sgm_uniform`;\n- Z-Image: `res_multistep` with `simple`;\n- turbo and distilled models: exactly what their template says, some of them take `lcm`.\n\nSamplers with "ancestral" or "sde" in the name add fresh noise at each step: the picture does not settle as steps grow, and is more varied.',
      },
      run: {
        title: 'Done',
        body: `${SAVE}\n\nKeep the pair that looks best for your model and delete the second branch, or keep it for the next comparison. The same way compares two cfg values or two step counts: everything the same, one setting changed.`,
      },
    },
  },
  sd35: {
    title: 'SD 3.5: one file and a new empty latent',
    result: 'You build an SD 3.5 graph from one checkpoint with the empty latent and the settings of this family.',
    steps: {
      intro: {
        title: 'What SD 3.5 is',
        body: 'Stable Diffusion 3.5 by Stability AI comes as Large, Large Turbo and Medium. It reads the prompt with three text encoders at once: CLIP-L, CLIP-G and T5-XXL, so it understands long sentences.\n\nComfyUI\'s template "SD3.5 Simple" loads it from one checkpoint file that holds the model, the three encoders and the VAE. The graph looks like that of SDXL, with another empty latent and other settings.',
      },
      files: {
        title: 'Which files your family needs',
        body: `- the checkpoint: \`sd3.5_large_fp8_scaled.safetensors\` in models/checkpoints; it already holds the encoders and the VAE.\n\nIf your file holds no text encoders (the model page says so), the three encoders \`clip_l.safetensors\`, \`clip_g.safetensors\` and a t5xxl file load with the node Load CLIP (Triple) from models/text_encoders, and its output takes the place of the checkpoint's CLIP output.\n\n${noFile('the template "SD3.5 Simple"')}`,
      },
      model: {
        title: 'Load the checkpoint',
        body: 'Add a {checkpoint} node and choose the SD 3.5 file in `ckpt_name`.',
      },
      prompts: {
        title: 'Add the prompt and the negative',
        body: 'Add two {positive} nodes and connect the `CLIP` output of {checkpoint} to the `clip` input of each. In the `text` field of the first, describe the picture in sentences: a glass bottle with a small galaxy inside, on a wooden kitchen table, mountains behind the window.\n\nSD 3.5 works with cfg above 1, so the negative is read. ComfyUI\'s template leaves it empty; write in it only what really gets in the way.',
      },
      latent: {
        title: 'Add the empty latent of SD3',
        body: 'Add a {latent} node and set `width` and `height` to 1024.\n\nThis empty latent has 16 channels, the form SD 3.5 works in, and it is the node of ComfyUI\'s template. The usual Empty Latent Image makes 4; a recent ComfyUI fits an empty latent to the model, but keep to the template\'s node. SD 3.5 is trained at about one megapixel.',
      },
      sampler: {
        title: 'Add the sampler',
        body: 'Add a {sampler} node and connect:\n- to `model`, the `MODEL` output of {checkpoint};\n- to `positive` and `negative`, the two text nodes;\n- to `latent_image`, the output of {latent}.',
      },
      settings: {
        title: 'Set the sampler',
        body: 'In {sampler} set:\n- `steps`: 20;\n- `cfg`: 4;\n- `sampler_name`: `euler`;\n- `scheduler`: `sgm_uniform`.\n\nThese are the numbers of ComfyUI\'s template. At cfg 7, the habit of SDXL, SD 3.5 burns the colours. Large Turbo is distilled: 4 steps and `cfg` 1.',
      },
      decode: {
        title: 'Turn the result into a picture',
        body: 'Add a {decode} node. Connect the output of {sampler} to its `samples` input and the `VAE` output of {checkpoint} to its `vae` input.',
      },
      save: SAVE_IMAGE,
      shift: {
        title: 'The shift of SD3-like models',
        body: 'SD 3.5 removes noise along a straight path, like Flux, Z-Image and Qwen-Image. Where the steps are spent on that path is set by the shift; for SD 3.5 ComfyUI already applies 3, so no node is needed.\n\nThe ModelSamplingSD3 node changes it, between the model and the sampler. ComfyUI\'s templates of HiDream use it with 6 for Dev and 3 for Full and Fast.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nIf the result is bad:\n- an error about the latent in an older ComfyUI: the empty latent is the usual one of 4 channels;\n- burnt colours: \`cfg\` too high;\n- an error about the text encoder: the file holds no encoders, see the step on files.\n\nLoRAs and ControlNets must be made for SD 3.5, and for its size: those of Large do not fit Medium.`,
      },
    },
  },
};
