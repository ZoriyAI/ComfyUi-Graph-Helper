/**
 * The English words of the group "The daily work cycle" (daily-cycle.ts): a template made your own, the queue and the
 * history, partial execution and the cache, the log and a minimal failing example, and the three forms of a workflow
 * file. The Russian words are in daily-cycle.texts.ru.ts under the same ids.
 *
 * These lessons say plainly where the app stops: it checks the graph on the canvas and reads what it already knows of
 * ComfyUI; everything done in ComfyUI is the person's own word, and the panel marks it so. Interface names of
 * ComfyUI change between versions, so the steps say what to look for and give the label as the version checked names it.
 */
import type { LessonWords } from '../texts';

const RUN = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. The app runs nothing in ComfyUI itself.';
const OWN_WORD = 'The app cannot see ComfyUI, so these ticks are your own word.';
const READY_ITEMS = {
  comfy: { label: 'ComfyUI is running, and the app has read it.', how: 'The app sees this when it has read your ComfyUI (Sync).' },
  model: { label: 'There is a picture model in models/checkpoints.', how: 'The app sees this in the list of models of the last sync.' },
  version: { label: 'I wrote down the version of my ComfyUI and of its interface (frontend).', how: 'In ComfyUI: Settings, the page About. Menu names in this lesson were checked on the versions of November 2026; yours may name them a little differently.' },
};
const NOT_CHECKED_TAIL = 'It does not run anything in ComfyUI and does not see your pictures: every tick about ComfyUI and every assessment is your own word.';

export const DAILY_CYCLE_EN: Record<string, LessonWords> = {
  'template-own': {
    title: 'Templates: from a ready workflow to your own',
    result: 'Your own version of a template, saved apart from it, with its inputs, outputs, models and notes written down and one task changed.',
    roles: {
      checkpoint: 'model of the template',
      latent: 'size and number of pictures',
      save: 'saver of your version',
    },
    meta: {
      skill: 'Open a template, name its inputs, outputs, models and notes, and change it for a new task in a copy that leaves the template as it was.',
      requires: ['A ComfyUI you can run, with one picture model in models/checkpoints.', 'The lessons “A first picture from text” and “Reading someone else\'s workflow”, or the same skills.'],
      mistakes: [
        {
          sign: 'You changed the template and saved, and now the original is gone.',
          fix: 'Open the template again from the template browser: templates come with ComfyUI and are not changed by your save. Next time use "Save As" with your own name before the first change.',
        },
        {
          sign: 'The loader of the template is red and ComfyUI reports errors before the run.',
          fix: 'A model of the template is missing. Open the error details and download the file from the link the template gives, or choose a model you have in the loader. Read the license of the model first.',
        },
        {
          sign: 'The canvas of the app shows one big node instead of the graph, and the lesson does not move on.',
          fix: 'The template wraps its nodes in a subgraph; the lesson follows the main canvas only. Take a simpler text to picture template, or the default graph of ComfyUI (Ctrl+D), which has the same seven nodes.',
        },
        {
          sign: 'ComfyUI stops with out of memory after your change.',
          fix: 'Several pictures at once need more memory. Set `batch_size` to 2, or make the picture smaller in both sides.',
        },
      ],
      provenance: 'Templates are made by the ComfyUI team and come with ComfyUI as a separate package (comfyui-workflow-templates). The models they name come from their authors, each under its own license: read it before you download. The lesson brings no model and no picture.',
      notChecked: `The app checks the graph on the canvas, that every node of it is installed, and what the last sync listed. It does not see the template browser and does not know which template you opened. ${NOT_CHECKED_TAIL}`,
    },
    steps: {
      intro: {
        title: 'A template is a starting point',
        body: 'A template is a ready workflow that comes with ComfyUI. It works, it names the models it needs, and it often has notes from its author. That makes it the best place to start a new graph.\n\nIt is also easy to spoil. Change it in place and you lose the working example you started from.\n\nIn this lesson you open a template, save a copy under your own name before anything else, find what the template takes in, what it gives out, which models it needs and what its notes say, and then change the copy for a new task: a wide banner with two pictures to choose from.',
      },
      ready: {
        title: 'Before you start',
        body: 'Two things the app can see for itself; the third only you know.',
        items: READY_ITEMS,
      },
      open: {
        title: 'Open a template and keep it safe',
        body: `Do this in ComfyUI. ${OWN_WORD}`,
        items: {
          browse: { label: 'I opened the template browser and chose a template that makes a picture from text with one checkpoint.', how: 'The "Templates" icon in the sidebar, or the entry "Browse Templates" in the menu of ComfyUI. If you cannot find a fitting one, the default graph (Ctrl+D) has the same nodes.' },
          models: { label: 'Every model the template needs is in place, or I chose one I have in its loader.', how: 'A missing model turns its loader red and ComfyUI reports "errors found"; the details offer the file from the link the template names. Download only from that link.' },
          copy: { label: 'Before any change I saved the template under my own name.', how: '"Save As" in the menu of ComfyUI. The template itself stays as it was.' },
          export: { label: 'I exported my copy to a file and opened it in this app.', how: '"Export" in the menu of ComfyUI writes a .json file; here open it with "File ▸ Open workflow…".' },
        },
      },
      'read-template': {
        title: 'What to look for in a template',
        body: 'Read a template the way you read any workflow, with four questions:\n\n- **Inputs**: what you are meant to change. The prompt text, the size, the number of pictures, a picture to load.\n- **Outputs**: where the result goes. A Save Image writes files into the output folder; a Preview Image only shows them.\n- **Models**: every loader and the file it names. The file names tell you what to download.\n- **Notes**: text on the canvas from the author, often with links and advice. A note never runs.\n\nOfficial templates sometimes wrap the model part in a subgraph, so the canvas shows only the inputs and the result. This lesson needs the nodes on the main canvas; if your template is wrapped, take the default graph instead.',
      },
      graph: {
        title: 'The graph of the template',
        body: 'The canvas holds the template you opened: {checkpoint}, two {positive} nodes for the prompt and the negative prompt, {latent}, {sampler}, {decode} and {save}. If you could not open a template, build the graph of the first lesson.\n\nA model must be chosen in `ckpt_name`, and the prompt node must have a prompt of a few words in `text`.',
      },
      map: {
        title: 'Write down what you found',
        body: `Write it on paper or in a note: this is the map of the template you will change. ${OWN_WORD}`,
        items: {
          inputs: { label: 'The inputs: which fields I would change for a new task.', how: 'For this graph: `text` of the prompt, `width`, `height` and `batch_size` of Empty Latent Image.' },
          outputs: { label: 'The outputs: which node saves, and its `filename_prefix`.' },
          files: { label: 'The models: each loader with the file name it uses.' },
          notes: { label: 'The notes: what the author advises, or that there are none.' },
        },
      },
      change: {
        title: 'Change it for a new task',
        body: 'The new task: a wide banner, with two pictures to choose from.\n\n- In {latent} make `width` larger than `height`. For an SD 1.5 model try 768 by 512, for SDXL 1216 by 832.\n- Set `batch_size` to 2: two pictures in one run.\n- Give {save} a `filename_prefix` that starts with `banner/`, for example `banner/try`, so your version writes into a folder of its own.',
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'Before the graph goes back to ComfyUI, the app checks that every node on the canvas is installed there.',
      },
      run: {
        title: 'Run your version',
        body: `${RUN}\n\n${OWN_WORD}`,
        items: {
          save: { label: 'I saved my version for ComfyUI under a new name and opened it there.' },
          ran: { label: 'I ran it, and two wide pictures appeared.', how: 'Two new files in the folder banner inside the output folder of ComfyUI.' },
          untouched: { label: 'I opened the template again from the browser, and it is still as it was.' },
        },
      },
      assess: {
        title: 'How did it go?',
        body: 'Answer for yourself. The app does not see the pictures and does not judge them; your answers stay on this computer.',
        criteria: {
          places: {
            title: 'I can point to each input, output, model and note of the template.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Open the template once more and go through the four questions node by node, from the loaders to the saver.',
          },
          task: {
            title: 'The pictures fit the new task: wide, and two to choose from.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'A banner made at a size far from the model\'s own may repeat things or fall apart. Keep the area near what the model was trained at and change only the proportions.',
          },
          apart: {
            title: 'The template and my version are two separate workflows.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'Save your version under its own name with "Save As", then open the template again from the browser.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          first: {
            text: 'You opened a template you want to change. What do you do first?',
            choices: { run: 'Run it to see it works', copy: 'Save a copy under my own name', delete: 'Delete the notes' },
            explain: 'Running first is fine too, but before the first change make a copy: then the working template stays as it was.',
          },
          missing: {
            text: 'The template needs a model you do not have. Where do you get it?',
            choices: { 'any-site': 'From any site that has a file of that name', 'shown-link': 'From the link the template gives, after reading the license', rename: 'Rename a model I have to that name' },
            explain: 'A file of the same name from elsewhere may be another model, or not a model at all. A renamed file is still the old model.',
          },
          output: {
            text: 'Which node decides where the result is written?',
            choices: { loader: 'The loader', saver: 'The saver, by its filename_prefix', sampler: 'The sampler' },
            explain: 'Save Image writes into the output folder, under the name and folder given in filename_prefix.',
          },
        },
      },
      transfer: {
        title: 'On your own: another template',
        body: 'Use the same method without help on another template of your choice, for example one that changes a picture you load or one that makes a picture larger.',
        items: {
          other: { label: 'I chose another template and saved my own copy before changing it.' },
          map: { label: 'I wrote down its inputs, outputs, models and notes.' },
          own: { label: 'I changed one thing for a task of my own, ran it, and the template stayed as it was.' },
        },
      },
    },
  },
};
