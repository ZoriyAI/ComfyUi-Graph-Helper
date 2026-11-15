/**
 * The words of the foundations lessons, in English; texts.ts reads them for the lesson panel. Each step: what to do and why. `{role}` is replaced by the name
 * of the node as this ComfyUI's library shows it; field names and values stand in backticks.
 */
import type { LessonWords } from '../texts';

const SAVE = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.';

/** The English words of the foundations lessons, by lesson id. */
export const FOUNDATIONS_LESSONS_EN: Record<string, LessonWords> = {
  'comfy-basics': {
    title: 'How ComfyUI works',
    result: 'You learn what a graph, the queue and the models folder are, and find a node, an output and a model file yourself.',
    steps: {
      intro: {
        title: 'Two programs',
        body: 'ComfyUI is the program that runs AI models: it draws pictures, makes videos and sounds on your graphics card. This app is the place where you build and read graphs for it.\n\nThis app never runs anything. It reads which nodes and models your ComfyUI has, helps you build a graph and explains it, and saves it as a file. You run the file in ComfyUI. So the app cannot break or slow down your ComfyUI, and you always see what will run.\n\nThis lesson is mostly reading, with three small practices on the canvas.',
      },
      graph: {
        title: 'A graph of nodes',
        body: 'In ComfyUI everything is a graph: nodes joined by links.\n\n- A node does one thing: loads a model, encodes a prompt, removes noise, saves a picture.\n- Its outputs are on the right, its inputs on the left. A link goes from an output to an input and carries the result on.\n- The colour of a link shows what it carries: a model, a prompt, a picture. An output connects only to an input of the same type.\n- Fields on a node are its settings: a number, a text, a file.\n\nA graph reads from left to right: loaders on the left, the result on the right. A saved graph is called a workflow, a .json file.',
      },
      'find-node': {
        title: 'Practice: find a node',
        body: 'Find the {picture} node and add it to the canvas. There are two ways: type its name into the search of the library on the left and double-click it, or press the "Node" button on the canvas toolbar.\n\nThe search finds parts of names too: "load image" or just "image".\n\nIts `image` field chooses a picture from the input folder of ComfyUI. Any picture is fine here.',
      },
      output: {
        title: 'Practice: an output',
        body: 'Add a {look} node and drag a link from the `IMAGE` output of {picture} to its `images` input.\n\nThis is the smallest graph that runs: it loads a picture and shows it. {look} is an output node: it shows a result. Without an output node ComfyUI has nothing to run for and refuses the graph.',
      },
      queue: {
        title: 'The queue: what runs and in which order',
        body: 'In ComfyUI the Run button (Ctrl+Enter; older versions call it Queue Prompt) puts the graph into the queue. ComfyUI works the queue off one graph after another.\n\n- Only what leads to an output node runs: Save Image, Preview Image, Save Video. A node whose result goes nowhere is skipped.\n- The order follows the links, not the place on the canvas: a node runs when everything it needs is ready.\n- ComfyUI remembers results. Run the same graph again and only what you changed is worked out again; with nothing changed the run ends at once.',
      },
      results: {
        title: 'Where results appear',
        body: '- Save Image and Save Video write files into the output folder of ComfyUI (ComfyUI/output).\n- Preview Image only shows the picture on the node; it keeps it in a temporary folder.\n- The queue panel of ComfyUI lists every run with its pictures.\n- What you load comes from the input folder.\n\nComfyUI writes the whole workflow into every picture it saves. Drop such a picture onto ComfyUI, or open it in this app, and you get the graph that made it.',
      },
      folders: {
        title: 'The models folder',
        body: 'Model files lie in ComfyUI/models, one sub-folder per kind:\n- checkpoints: whole models of the SD 1.5 and SDXL kind;\n- diffusion_models: only the part that draws, for Flux, Wan, Qwen-Image and most new families;\n- text_encoders: the part that reads the prompt;\n- vae: the part that turns the result into pixels;\n- loras: small add-ons for a style or a character;\n- controlnet, upscale_models, clip_vision and more.\n\nEach loader node lists only its own folder. A file in the wrong folder is not an error: it is simply not in the list. The library on the left shows the files by folder.',
      },
      'model-file': {
        title: 'Practice: find a model file',
        body: 'Add a {model} node and open its `ckpt_name` field. The list shows the files of the checkpoints folder of your ComfyUI. Choose any.\n\nIf the list is empty, your ComfyUI has no checkpoint yet. The app downloads nothing: take a model from its official page, put the file into ComfyUI/models/checkpoints, refresh ComfyUI and choose "Sync ▸ Sync now" here.',
      },
      packs: {
        title: 'Node packs',
        body: 'A node pack (custom nodes) adds nodes ComfyUI does not have: other models, tools, conveniences. It is a folder in ComfyUI/custom_nodes.\n\nPeople install packs through ComfyUI Manager, which is built into current ComfyUI: open the manager, search the pack by name, press Install, restart ComfyUI. When a workflow uses nodes you do not have, the manager offers to install the missing packs. Then choose "Sync ▸ Sync now" here.\n\nA pack runs its author\'s code on your computer. Install packs that many people use. Old model formats (.ckpt, .pt, .pth, .bin) can run code too: prefer .safetensors.',
      },
      run: {
        title: 'From here to ComfyUI',
        body: `${SAVE}\n\nIn ComfyUI drag the saved file onto the canvas, or open it from the Workflow menu, and press Run. The result appears on the output node and, for the save nodes, in the output folder.\n\nIf ComfyUI shows a red error, it names the node that failed. The usual messages (out of memory, a missing file, a missing node) are explained in this app's knowledge.\n\nNext: "A first picture from text" builds a real graph.`,
      },
    },
  },
  'sampler-fields': {
    title: 'The sampler\'s settings',
    result: 'You set the fields of the sampler the way ComfyUI\'s own SDXL template sets them, and learn what each one does.',
    steps: {
      intro: {
        title: 'Fields everybody meets',
        body: 'The sampler is where the picture is made, and its fields are the ones you will change most. This lesson goes through them on the graph of "A first picture from text".\n\nThe values are those of ComfyUI\'s own SDXL template. For SD 1.5 they work too. Newer families (Flux, Z-Image, Qwen-Image, Wan) want other numbers: their templates say which.',
      },
      graph: {
        title: 'The picture graph is needed',
        body: 'The canvas must have the graph of "A first picture from text": {checkpoint}, {latent}, {sampler} and {save}.\n\nIf it is not there, do that lesson first.',
      },
      seed: {
        title: 'The seed',
        body: 'The `seed` field is the number the starting noise is made from. The same `seed`, the same settings and the same prompt give the same picture.\n\nUnder it in ComfyUI there is `control_after_generate`: what happens to the number after each run. `randomize` takes a new random number, `increment` adds one, `fixed` keeps it.\n\nTake `randomize` while you look for ideas. Take `fixed` while you tune one picture: then you see what each change did.',
      },
      steps: {
        title: 'Steps',
        body: 'Set `steps` to 25.\n\nThe sampler removes the noise in this many steps. More steps, a cleaner picture and a longer wait, but after about 30 the picture hardly changes. Distilled and turbo models need only 4 to 8 steps: their pages say so.',
      },
      cfg: {
        title: 'CFG',
        body: 'Set `cfg` to 7.\n\nIt says how strictly the model follows the prompt. Higher follows more closely but burns the colours and hardens the picture; lower is softer and freer. For SD 1.5 and SDXL keep 5 to 8.\n\nDistilled models and speed-up LoRAs want `cfg` 1, which also halves the time.',
      },
      method: {
        title: 'Sampler and scheduler',
        body: 'Two fields choose how the noise is removed.\n\n- `sampler_name`, the method. `euler` is simple and reliable. `dpmpp_2m` gives more detail in the same steps. Names with `ancestral` or `sde` add fresh noise at every step: livelier, but the picture never settles and changes with the number of steps.\n- `scheduler`, how the noise is spread over the steps. `karras` spends more steps on fine detail and suits the dpmpp methods; `normal` and `simple` spread them evenly and suit most new families.\n\nFor a start take a pair from a template and change one thing at a time.',
      },
      'sampler-name': {
        title: 'Choose the pair',
        body: 'Set `sampler_name` to `dpmpp_2m` and `scheduler` to `karras`.\n\nThis is the pair of ComfyUI\'s SDXL template and of many guides for SD 1.5 and SDXL.',
      },
      denoise: {
        title: 'Denoise',
        body: 'Leave `denoise` at 1.\n\nIt says how much of the starting latent is replaced with noise. With an empty blank everything is drawn anew, so 1. Below 1 is for redrawing a picture that comes in: image to image, a second pass.',
      },
      size: {
        title: 'Size and batch',
        body: 'The size is set in {latent}: `width` and `height`. Make the picture near the size the model was trained at: 512 by 512 for SD 1.5, about 1024 by 1024 for SDXL. Far from it the model repeats things or breaks the composition.\n\nOther shapes with the same number of pixels work: 832 by 1216 for a portrait, 1216 by 832 for a landscape.\n\n`batch_size` makes several pictures in one run. It needs that many times the memory; 1 is the safe start.',
      },
      run: {
        title: 'Try it',
        body: `${SAVE}\n\nIn ComfyUI set \`control_after_generate\` to \`fixed\`, run once, then change only \`steps\` or only \`cfg\` and run again. Seeing one change at a time is the fastest way to learn what each field does.`,
      },
    },
  },
  vram: {
    title: 'When the graph does not fit the graphics card',
    result: 'You learn why a graph runs out of memory and what to change, and set the picture graph up to need less of it.',
    steps: {
      intro: {
        title: 'What takes the memory',
        body: 'The graphics card has its own memory, VRAM. A run needs room for two things.\n\n- The models: a file needs about as much memory as it weighs. An SDXL checkpoint of 7 GB needs about 7 GB.\n- The work itself: it grows with the size of the picture, with the number of pictures at once, and for video with the frames.\n\nComfyUI loads a model when it is needed and moves the others to ordinary memory (RAM). When even one step does not fit, the run stops with an error.',
      },
      error: {
        title: 'The error you will see',
        body: 'ComfyUI shows a red message on the node where memory ran out. Its text says "out of memory" or "Allocation on device", and ComfyUI adds: "This error means you ran out of memory on your GPU. TIPS: If the workflow worked before you might have accidentally set the batch_size to a large number."\n\nThe node it names tells where to look. In the sampler: the model or the size is too large. In VAE Decode at the very end: the decoding of a large picture or clip.',
      },
      graph: {
        title: 'The picture graph is needed',
        body: 'The canvas must have the graph of "A first picture from text": {checkpoint}, {latent}, {sampler} and {save}.\n\nIf it is not there, do that lesson first.',
      },
      batch: {
        title: 'One picture at a time',
        body: 'Set `batch_size` of {latent} to 1.\n\nEvery picture of a batch needs its own working memory. Several variants are better made one after another, with another `seed` each time.',
      },
      size: {
        title: 'The size',
        body: 'Memory grows with the number of pixels: 2048 by 2048 has 4 times the pixels of 1024 by 1024. For video multiply by the frames.\n\nMake the picture at the size the model was trained at and enlarge it afterwards with an upscaler or a second pass. That is faster and looks better than drawing it large at once.',
      },
      tiled: {
        title: 'Decode in tiles',
        body: 'Add a {tiled} node. Connect the output of {sampler} to its `samples` input and the `VAE` output of {checkpoint} to its `vae` input. Leave `tile_size` at 512.\n\nIt does what VAE Decode does, piece by piece, so it needs far less memory. When a run fails at the very end, after the sampler, this is the cure. If 512 still does not fit, try 256.',
      },
      save: {
        title: 'Save from the tiled decode',
        body: 'Connect the `IMAGE` output of {tiled} to the `images` input of {save}. The link from the old VAE Decode is replaced.\n\nThe old VAE Decode now leads nowhere, so ComfyUI does not run it. You can delete it.',
      },
      formats: {
        title: 'Lighter files',
        body: 'The same model comes in files of different precision. Fewer bits per number, a smaller file and less memory.\n\n- fp16 and bf16: the usual full files.\n- fp8: half of that, with a small loss; the common choice for cards of 12 to 16 GB. Load Diffusion Model can also load a 16-bit file as fp8 with its weight_dtype field.\n- GGUF (Q8, Q6, Q5, Q4): quantised files of the pack ComfyUI-GGUF and its Unet Loader (GGUF). Q8 is close to fp16 at half the size; Q4 takes about a quarter with a visible loss.\n\nThe text encoder comes in fp8 and GGUF too, and can run on the processor.',
      },
      offload: {
        title: 'Ordinary memory helps',
        body: '- ComfyUI moves models that are not in use to RAM by itself, and recent versions stream large models in pieces.\n- Start flags change that: --reserve-vram 2 leaves 2 GB for the system, --lowvram and --novram keep more in RAM.\n- Block swap (WanVideo Block Swap of WanVideoWrapper) keeps some blocks of a video model in RAM.\n- ComfyUI-MultiGPU puts parts of a model on a second card or in RAM.\n\nAll of this is slower than having everything on the card, and needs enough RAM.',
      },
      order: {
        title: 'What to change, in order',
        body: '1. `batch_size` to 1 and the size down to the model\'s own.\n2. The tiled decode, if the run fails at the end.\n3. An fp8 or GGUF file of the same model.\n4. The text encoder in fp8 or on the processor.\n5. For video: fewer frames, a smaller frame, block swap.\n6. ComfyUI\'s start flags.\n7. A smaller model of the family, or a cloud graphics card.\n\nThe app\'s knowledge explains every ComfyUI message about memory. Save the graph with "File ▸ Save workflow for ComfyUI…" and run it in ComfyUI.',
      },
    },
  },
  'read-workflow': {
    title: 'Reading someone else\'s workflow',
    result: 'You learn to read groups, notes, reroutes, primitives, Set and Get, bypassed nodes and subgraphs, and give two fields one value.',
    steps: {
      intro: {
        title: 'Where to start',
        body: 'A workflow from a template or from the internet can have fifty nodes. Read it in this order:\n\n1. the notes;\n2. the output nodes, and back along the links;\n3. the loaders and their files;\n4. what is switched off.\n\nThis lesson explains each thing you meet on the way. It practises one of them on the graph of "A first picture from text".',
      },
      notes: {
        title: 'Notes',
        body: 'Note and Markdown Note nodes are text on the canvas. They never run.\n\nTemplate authors write there which model files the graph needs, in which folder each goes, and which settings to change. Read every note first: most "it does not work" ends there.',
      },
      groups: {
        title: 'Groups',
        body: 'A group is a coloured frame with a title around several nodes: "Models", "Prompt", "Upscale". It changes nothing in what runs; it only organises the canvas. Moving a group moves its nodes.\n\nRead the titles of the groups to see the parts of the graph before the nodes.',
      },
      reroutes: {
        title: 'Reroutes',
        body: 'A reroute is a dot on a link that only passes the data on, so long links can go around other nodes. The current ComfyUI interface puts such dots on the links themselves; older workflows use Reroute nodes.\n\nWhen you follow a link, go through the dots: the real source is further on.',
      },
      primitives: {
        title: 'Primitives',
        body: 'A primitive node holds one value and gives it to fields of other nodes: Int for a whole number, Float for a fraction, Text and Text (Multiline) for text, Boolean for yes or no.\n\nIn the current interface every field has its own input dot, so a link from a primitive goes straight into a field. That field then takes the value from the link, not the one typed into it.\n\nTemplates use primitives so that one value sits in one visible place and several nodes share it.',
      },
      graph: {
        title: 'The picture graph is needed',
        body: 'The canvas must have the graph of "A first picture from text" with its {latent} node.\n\nIf it is not there, do that lesson first.',
      },
      size: {
        title: 'Practice: one value for two fields',
        body: 'Add a {size} node. Connect its `INT` output to the `width` input of {latent} and once more to its `height` input. Set its `value` to 1024 (512 for an SD 1.5 model).\n\nNow the picture is square and its size is set in one place. Change the number and both fields follow. This is how templates share a size between a blank and the nodes that must match it.',
      },
      'set-get': {
        title: 'Set and Get: links you do not see',
        body: 'Some packs pass data without a visible link, to keep large graphs tidy.\n\n- ComfyUI-KJNodes: a Set node takes a value under a name, and every Get node of that name gives it out elsewhere.\n- cg-use-everywhere: an Anything Everywhere node sends its input to every matching input that is not linked.\n- rgthree-comfy: Context nodes carry the model, the text encoder, the VAE and the prompts as one link.\n\nWhen an input looks empty but the graph works, look for one of these. They live in the interface: without the pack the hidden links are lost.',
      },
      bypass: {
        title: 'Bypassed and muted nodes',
        body: '- Bypass (Ctrl+B in ComfyUI, the node turns purple): the node is skipped and its inputs go straight through to its outputs. A bypassed LoRA loader leaves the model as it was.\n- Mute (Ctrl+M, the node turns grey): the node does not run, and neither does what depends only on it.\n\nAuthors switch off optional parts this way: an upscale, a face fix. When a workflow does not do what its title says, look for purple and grey nodes first.',
      },
      subgraphs: {
        title: 'Subgraphs',
        body: 'A subgraph is a node with a whole graph inside. It shows the inputs, outputs and fields its author chose to show.\n\nIn ComfyUI double-click it, or press its edit button, to go inside; the bar at the top leads back. Official templates often put the whole model part into one subgraph, so the canvas shows only the prompt, the size and the result. In this app the node\'s context menu has "Open subgraph".',
      },
      check: {
        title: 'Before you run it',
        body: '- A red node or one the app marks as unknown needs a pack: install it through ComfyUI Manager.\n- A loader field with a file you do not have needs that file in its folder; the notes usually say where to get it.\n- "Check graph" in this app finds missing nodes and models, empty inputs and mixed model families.\n\nSave with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there.',
      },
    },
  },
  switch: {
    title: 'Two versions of a prompt with one switch',
    result: 'You keep two prompts in one graph and choose between them with one yes/no value, the way ComfyUI\'s templates do.',
    roles: { first: 'first version', second: 'second version' },
    steps: {
      intro: {
        title: 'Compare without rewiring',
        body: 'To compare two prompts you would retype the text or move links each time. ComfyUI\'s templates do it with a switch: both versions stay in the graph, and one yes/no value chooses which one goes on.\n\nThis lesson builds that on the graph of "A first picture from text". The same switch later chooses between your prompt and one a language model rewrote.',
      },
      graph: {
        title: 'The picture graph is needed',
        body: 'The canvas must have the graph of "A first picture from text": the {positive} node whose output goes into the `positive` input of {sampler}.\n\nIf it is not there, do that lesson first.',
      },
      texts: {
        title: 'The first version',
        body: 'Add a {first} node and write a prompt into its `value` field. For example: a lighthouse on a cliff at sunset, warm light, calm sea.\n\nThis node holds the text in one visible place. It goes on to the switch, not straight into {positive}.',
      },
      second: {
        title: 'The second version',
        body: 'Add a second {second} node and write another version into its `value` field: the same subject in another light, another style or with one more detail.\n\nChange one thing only. Then you see what that one change did.',
      },
      choice: {
        title: 'The switch',
        body: 'Add a {choice} node. Connect the output of {first} to its `on_false` input and the output of {second} to its `on_true` input.\n\nThe switch passes on one of the two. Only the chosen side is worked out.',
      },
      'into-prompt': {
        title: 'Into the prompt',
        body: 'Connect the `output` of {choice} to the `text` input of {positive}.\n\nThe `text` field of {positive} now takes its words from the link, and the text typed in it is no longer used. The rest of the graph stays as it was.',
      },
      flag: {
        title: 'The yes/no value',
        body: 'Add a {flag} node, connect its output to the `switch` input of {choice} and set its `value` to `true`.\n\n`true` chooses `on_true`, the second version; `false` chooses `on_false`, the first. The choice now sits in one small node you can find at once.',
      },
      compare: {
        title: 'How to compare',
        body: 'In ComfyUI set `control_after_generate` under the `seed` of {sampler} to `fixed`. Run once with `true` and once with `false`.\n\nWith the same `seed` the two pictures differ only by the prompt. If they also differed by the noise, you could not tell which change did what.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nThe same switch works for anything of one type: two models, two LoRA settings, two sizes. Both sides must carry the same type.\n\nNext: "A language model writes the prompt" puts a language model on the \`on_true\` side.`,
      },
    },
  },
  'llm-prompt': {
    title: 'A language model writes the prompt',
    result: 'You let a language model inside ComfyUI turn a short idea into a detailed prompt, and compare it with your own by the switch.',
    roles: { idea: 'your idea', instruction: 'instruction for the model' },
    steps: {
      intro: {
        title: 'A language model in the graph',
        body: 'A language model can turn a short idea into a detailed prompt: light, composition, materials, style. ComfyUI does it with its own Generate Text node, on your graphics card, without another program and without a cloud service.\n\nThis lesson goes on from "Two versions of a prompt with one switch": your idea stays on one side of the switch, and the model\'s version goes to the other.\n\nIt needs a language model file in ComfyUI/models/text_encoders: one that ComfyUI\'s text generation templates name, such as Qwen 3 4B, Qwen 3.5 or Gemma 4. Take it from the model\'s official page; the app downloads nothing.',
      },
      graph: {
        title: 'The switch graph is needed',
        body: 'The canvas must have the graph of "Two versions of a prompt with one switch": {choice} with its output in {positive}, and the {idea} node with your prompt on its `on_false` input.\n\nIf it is not there, do that lesson first.',
      },
      model: {
        title: 'Load the language model',
        body: 'Add a {llmClip} node and choose the language model file in its `clip_name` field. Leave `type` as the template of that model sets it; the official Qwen 3.5 and Gemma 4 templates leave `stable_diffusion`.\n\nA language model is loaded like a text encoder: in ComfyUI the two are the same kind of file. This node is not linked to the text encoder of the picture model: it feeds only Generate Text.',
      },
      generate: {
        title: 'Generate Text',
        body: 'Add a {llm} node. Connect the output of {llmClip} to its `clip` input and the output of {idea} to its `prompt` input. Set `max_length` to 512.\n\nThe model now reads your idea. `max_length` is the longest answer in tokens, pieces of words; a prompt needs far fewer, the limit only stops a model that talks on. Leave `thinking` off: the answer is then the prompt itself.',
      },
      'into-switch': {
        title: 'The model\'s version into the switch',
        body: 'Connect the `generated_text` output of {llm} to the `on_true` input of {choice}. The link from the second version is replaced.\n\nNow `true` sends the model\'s prompt to the picture and `false` your own. The second text node is free: the next step gives it a new job.',
      },
      instruction: {
        title: 'The instruction',
        body: 'Connect a {instruction} node (the free one, or a new one) to the `system_prompt` input of {llm} and write the instruction into its `value` field. For example: Rewrite the idea as one detailed image prompt in English: subject, setting, light, camera, style. Answer with the prompt only.\n\nThe instruction says what to do with the idea; the idea says what about. "Answer with the prompt only" keeps greetings and explanations out of the picture.',
      },
      preview: {
        title: 'See what the model wrote',
        body: 'Add a {preview} node and connect the `generated_text` output of {llm} to its `source` input.\n\nAfter a run the text shows on the node. Read it: if the model adds things you did not want, say so in the instruction.',
      },
      memory: {
        title: 'Memory and time',
        body: 'The language model is a model like any other: a 4B file takes about 8 GB in 16 bits, less in fp8. ComfyUI loads it, writes the text, and moves it away when the picture model needs the room.\n\nWith a fixed `seed` and an unchanged idea ComfyUI keeps the written text and does not run the language model again. Change the idea, and only then is a new text written.',
      },
      packs: {
        title: 'Other ways',
        body: '- comfyui-ollama: sends the idea to an Ollama server you run yourself; Ollama Generate gives the text from its result output.\n- ComfyUI-QwenVL: Qwen vision-language models that describe a picture; the pack downloads them into models/LLM on the first run.\n- comfyui_LLM_party: agents and cloud models with your API key.\n- Partner nodes of ComfyUI (OpenAI, Gemini and others) run in the cloud.\n\nCloud models cost money and send your text to that company. Generate Text runs on your own card.',
      },
      run: {
        title: 'The graph is ready',
        body: `${SAVE}\n\nRun once with \`true\` and once with \`false\` on the switch, with the same \`seed\`. Keep what works: the short idea, the long prompt, or the model's prompt edited by hand.`,
      },
    },
  },
};
