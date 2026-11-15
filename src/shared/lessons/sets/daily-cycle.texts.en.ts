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
  'queue-history': {
    title: 'Run, queue, history and cancel',
    result: 'Several runs queued on purpose, one cancelled while it waited, one stopped while it ran, and a finished one found in the history with its settings.',
    roles: {
      save: 'saver of the runs',
    },
    meta: {
      skill: 'Queue several runs on purpose, cancel the one you do not need, and find a finished run with its settings in the history.',
      requires: ['A ComfyUI you can run, with one picture model in models/checkpoints.', 'The lesson “A first picture from text”, or the same graph built by hand.'],
      mistakes: [
        {
          sign: 'You pressed Run three times and only one picture came out.',
          fix: 'Nothing changed between the presses, so ComfyUI reused its result. Change something before each Run (a word of the prompt), or let `control_after_generate` under `seed` be `randomize`.',
        },
        {
          sign: 'ComfyUI keeps starting new runs by itself.',
          fix: 'The Run button is in the mode "Run (Instant)" or "Run (On Change)". Switch it back to "Run" in the menu of the button, then clear the queue.',
        },
        {
          sign: 'You cleared the queue and the running job went on anyway.',
          fix: 'Clearing the queue removes only the jobs that wait. To stop the one that runs, press "Cancel" on the run bar or Ctrl+Alt+Enter.',
        },
        {
          sign: 'You cannot find the Job History panel.',
          fix: 'In some versions it is behind a setting: Settings, Comfy, Queue, "Docked job history/queue panel". Older versions show a queue panel instead; the key Q shows and hides it.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes and the interface as the official documentation describes it (the run bar, the job history). No model, picture or prompt comes with the lesson. A run with partner nodes, the paid nodes that run on an outside service, costs credits each time it is queued.',
      notChecked: `The app checks the graph on the canvas and that every node of it is installed. It does not see the queue, the history or the jobs. ${NOT_CHECKED_TAIL}`,
    },
    steps: {
      intro: {
        title: 'Run puts a job into a queue',
        body: 'Run does not start a picture at once. It puts a job into a queue, and ComfyUI works through the queue one job after another.\n\nA job is in one of a few states: waiting in the queue, running, finished, failed, or cancelled. Pressing Run again and again "to be sure" only adds jobs, and a job with nothing changed ends at once, because ComfyUI reuses what it already made.\n\nIn this lesson you queue three jobs on purpose, cancel one that waits, stop one that runs, and find a finished one in the history with its settings.',
      },
      ready: {
        title: 'Before you start',
        body: 'Two things the app can see for itself; the third only you know.',
        items: READY_ITEMS,
      },
      graph: {
        title: 'A graph to queue',
        body: 'Keep the picture graph of the first lesson, or build it: {checkpoint}, the prompt and the negative prompt in {positive} nodes, {latent}, {sampler}, {decode} and {save}. A model is chosen in `ckpt_name`, the prompt is written in `text`.',
      },
      name: {
        title: 'A folder for the runs',
        body: 'Give {save} a `filename_prefix` that starts with `queue/`, for example `queue/run`. Every job of this lesson then writes into one folder, and you can count the files.',
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'Before the graph goes to ComfyUI, the app checks that every node on the canvas is installed there.',
      },
      where: {
        title: 'Where to watch the queue',
        body: 'In ComfyUI as documented in November 2026:\n\n- The run bar at the top of the canvas has **Run** and **Cancel**. Shift with Run puts the job at the front of the queue. Ctrl+Enter is Run, Ctrl+Alt+Enter cancels the running job.\n- The menu of the Run button has three modes. "Run" queues once per press. "Run (On Change)" queues again whenever the graph changes, "Run (Instant)" queues again as soon as a job ends. Keep "Run" for this lesson.\n- A counter of active jobs stands near Run. A click opens the queue; a right click clears it.\n- **Job History** in the left sidebar lists the jobs with tabs "All", "Completed" and "Failed". Each job has a menu with "Cancel job" while it waits or runs, and "Open as workflow in a new tab" when it is done.\n\nIn some versions Job History needs the setting "Docked job history/queue panel" (Settings, Comfy, Queue). Older versions show a queue panel instead. The names may differ a little in yours: look for the same actions.',
      },
      queue: {
        title: 'Queue three jobs',
        body: `${RUN}\n\nPress Run three times quickly, and change one word of the prompt before the second and the third press, so each job is new. ${OWN_WORD}`,
        items: {
          open: { label: 'I opened the workflow in ComfyUI and the Run button is in the mode "Run".' },
          three: { label: 'I queued three jobs, each with a different prompt.', how: 'The counter of active jobs shows them, or Job History lists one running and two waiting.' },
          counter: { label: 'I watched the counter go down as jobs finished.' },
        },
      },
      cancel: {
        title: 'Cancel one, stop one',
        body: `Queue three jobs again with three new prompts. Then act while they run. ${OWN_WORD}`,
        items: {
          waiting: { label: 'I cancelled a job that was still waiting.', how: 'Its menu in Job History, "Cancel job". The job that runs goes on.' },
          running: { label: 'I stopped the job that was running.', how: '"Cancel" on the run bar, or Ctrl+Alt+Enter. The next waiting job starts.' },
          states: { label: 'I can say for each of the six jobs whether it finished, was cancelled or was stopped.', how: 'Count the files in the folder queue: one for each finished job.' },
        },
      },
      history: {
        title: 'Find a run again',
        body: `A finished job remembers the graph it ran. ${OWN_WORD}`,
        items: {
          find: { label: 'I found a finished job in Job History by its picture.' },
          reopen: { label: 'I opened it as a workflow in a new tab and read its prompt and its seed.', how: '"Open as workflow in a new tab" in the menu of the job.' },
          file: { label: 'I found its file in the folder queue of the output folder.' },
        },
      },
      assess: {
        title: 'How did it go?',
        body: 'Answer for yourself; your answers stay on this computer.',
        criteria: {
          states: {
            title: 'I could tell the state of every job at each moment.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Keep Job History open while you queue, and watch one job go from waiting to running to finished.',
          },
          restore: {
            title: 'The run I opened from the history had the same prompt and seed as the picture.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Open it again from the menu of the job, not from the canvas you have now: the canvas may hold later changes.',
          },
          blind: {
            title: 'How often did I press Run without knowing what it would add?',
            levels: { often: 'Often', once: 'Once', never: 'Never' },
            tryNext: 'Before each Run, say what changed. If nothing did, the press adds a job that ends at once.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          same: {
            text: 'You press Run again without changing anything. What happens?',
            choices: { new: 'A new picture is made', cached: 'The job ends at once with the result it already has', error: 'ComfyUI shows an error' },
            explain: 'ComfyUI reuses results and works out only what changed. With nothing changed there is nothing to do.',
          },
          clear: {
            text: 'What does clearing the queue remove?',
            choices: { all: 'Every job, the running one too', pending: 'The jobs that wait; the running one goes on', history: 'The finished jobs' },
            explain: 'The running job is stopped with Cancel. The history is cleared apart, with "Clear history".',
          },
          urgent: {
            text: 'Two jobs wait, and you need a third one first. How?',
            choices: { shift: 'Hold Shift and press Run', twice: 'Press Run twice', restart: 'Restart ComfyUI' },
            explain: 'Shift with Run, or Ctrl+Shift+Enter, puts the job at the front of the queue.',
          },
        },
      },
      transfer: {
        title: 'On your own: a series',
        body: 'Use the queue for a real choice, without help.',
        items: {
          series: { label: 'I queued a series of four jobs: one prompt with four different seeds.' },
          drop: { label: 'I cancelled the jobs I no longer needed as soon as I saw a good picture.' },
          best: { label: 'I opened the best one from the history and wrote down its seed.' },
        },
      },
    },
  },
  'partial-cache': {
    title: 'Partial execution and the cache',
    result: 'A graph with a cheap preview branch beside the saver, and proof of which branch ran and why a run was faster.',
    roles: {
      save: 'saver of the full picture',
      scale: 'small copy',
      preview: 'preview of the small copy',
      saveSmall: 'saver of the small copy',
    },
    meta: {
      skill: 'Run only the branch you are working on, and tell from the time and the files which nodes ran again and why.',
      requires: ['A ComfyUI you can run, with one picture model in models/checkpoints.', 'An interface (frontend) of version 1.24 or newer for partial execution: older ones may run the whole graph.'],
      mistakes: [
        {
          sign: 'The run button does not appear when you select a node.',
          fix: 'Partial execution starts from an output node. Select the Preview Image or a Save Image, not a node in the middle.',
        },
        {
          sign: 'A partial run still runs the whole graph.',
          fix: 'An old interface does that. Note your frontend version (Settings, About) and update ComfyUI; until then run the whole graph.',
        },
        {
          sign: 'After a change nothing runs again, though you expected it to.',
          fix: 'The change did not reach that node, or the value is the same as before. Check that the field you changed is on the way to the output you run.',
        },
        {
          sign: 'Everything runs again each time, even the sampler.',
          fix: 'The seed changes after every run. Set `control_after_generate` under `seed` to `fixed`.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes (Upscale Image By, Preview Image) and the interface as the official documentation describes it. No model, picture or prompt comes with the lesson.',
      notChecked: `The app checks the graph on the canvas, the scale of the small copy and that every node is installed. It does not see which nodes ran or how long a run took. ${NOT_CHECKED_TAIL}`,
    },
    steps: {
      intro: {
        title: 'Run only what you are working on',
        body: 'ComfyUI remembers the result of every node. When you run again, it works out only the nodes whose inputs or settings changed, and what depends on them. Everything else comes from memory.\n\nYou can also run only one branch: select an output node and run just the way to it. That is partial execution.\n\nIn this lesson you add a cheap branch, a small preview of the picture, beside the saver. Then you prove with the time and the files which nodes ran: after a change at the end, after a partial run, and after a change at the start.',
      },
      ready: {
        title: 'Before you start',
        body: 'Two things the app can see for itself; the third only you know.',
        items: READY_ITEMS,
      },
      graph: {
        title: 'The picture graph',
        body: 'Keep the picture graph of the first lesson, or build it: {checkpoint}, the prompt and the negative prompt in {positive} nodes, {latent}, {sampler}, {decode} and {save}. A model is chosen in `ckpt_name`, the prompt is written in `text`.',
      },
      branch: {
        title: 'A second branch: a small preview',
        body: 'Add {scale} and {preview}. Link the IMAGE output of {decode} to `image` of {scale}, and the output of {scale} to `images` of {preview}.\n\nSet `scale_by` of {scale} to 0.5: a copy at half the size.\n\nNow the decoded picture goes two ways: to {save}, which writes a file, and through {scale} to {preview}, which only shows it. Preview Image writes nothing to the output folder.',
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'Before the graph goes to ComfyUI, the app checks that every node on the canvas is installed there.',
      },
      full: {
        title: 'A full run and a run with nothing changed',
        body: `${RUN}\n\nAfter each run ComfyUI prints "Prompt executed in … seconds" in its log (the Logs tab of the bottom panel, or the console). Note the times. ${OWN_WORD}`,
        items: {
          export: { label: 'I opened the workflow in ComfyUI.' },
          fixed: { label: 'I set `control_after_generate` under `seed` to `fixed`.', how: 'Otherwise the seed changes after every run, and everything runs again.' },
          ran: { label: 'I ran the whole graph: a file in the output folder, a small copy on the preview. I noted the time.' },
          again: { label: 'I pressed Run again with nothing changed: it ended at once, and no new file appeared.' },
        },
      },
      cache: {
        title: 'What runs again',
        body: 'A node runs again when one of its inputs or settings changed. Then every node after it runs again too. Nodes before it come from memory.\n\nChange `scale_by` and only {scale} and {preview} have something new to do. The model, the prompts and the sampler stay as they were, so the run takes a fraction of the first one.\n\nChange the seed and the sampler must run again, and with it everything after it: both branches.',
      },
      downstream: {
        title: 'Change the end of the graph',
        body: `In ComfyUI change only \`scale_by\` of Upscale Image By, for example from 0.5 to 0.25, and press Run. ${OWN_WORD}`,
        items: {
          scale: { label: 'The preview shows a smaller copy, and the sampler did not run again.', how: 'The progress of the sampler does not move, and the run ends in a moment.' },
          time: { label: 'I compared the time with the first run.', how: 'The line "Prompt executed in … seconds" in the log.' },
        },
      },
      partial: {
        title: 'Run one branch only',
        body: `Select the Preview Image node alone. The toolbox over the selection shows a run button, a triangle; press it. In versions without the toolbox the menu of the node may have "Queue Selected Output Nodes". ${OWN_WORD}`,
        items: {
          select: { label: 'I ran the preview branch alone.', how: 'Only the way to the preview runs. Save Image is not on it, so no file is written.' },
          seed: { label: 'I changed the seed and ran the preview branch alone again: the sampler ran, the preview changed, and still no new file appeared.' },
          whole: { label: 'I ran the whole graph: now Save Image wrote the picture of the new seed.' },
        },
      },
      assess: {
        title: 'What did you prove?',
        body: 'Answer for yourself; your answers stay on this computer.',
        criteria: {
          branch: {
            title: 'For each run I can say which branch ran, and show it by the files.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Count the files in the output folder before and after each run: a new file means Save Image ran.',
          },
          faster: {
            title: 'I can say why the run after the change of scale_by was faster.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Read again what runs again: the nodes before the change came from memory.',
          },
          upstream: {
            title: 'I can predict what a change of the seed or of the prompt reruns.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Follow the links from the changed node to the outputs: every node on the way runs again.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          scale: {
            text: 'You change only scale_by and press Run. What runs?',
            choices: { all: 'The whole graph', branch: 'Upscale Image By and the preview after it', nothing: 'Nothing' },
            explain: 'Only the changed node and what depends on it run again; the rest comes from memory.',
          },
          seed: {
            text: 'You change the seed and run only the preview branch. What runs?',
            choices: { preview: 'Only the preview', 'sampler-on': 'The sampler and everything on the way to the preview', nothing: 'Nothing, the branch is cached' },
            explain: 'The seed is a setting of the sampler, so the sampler and all after it on that branch must run again.',
          },
          saver: {
            text: 'Does a partial run of the preview write a new file through Save Image?',
            choices: { yes: 'Yes', no: 'No', twice: 'Yes, two files' },
            explain: 'Save Image is not on the way to the preview, so a partial run leaves it alone.',
          },
        },
      },
      transfer: {
        title: 'On your own: keep the small copy',
        body: 'Without help: add {saveSmall} that keeps the small copy as a file, fed by {scale}, with a `filename_prefix` other than that of {save}. Then in ComfyUI run only that saver, and check that the full picture was not written again.',
      },
    },
  },
  'minimal-example': {
    title: 'Logs and a minimal failing example',
    result: 'A failure read in the log, a workflow cut down to the few nodes that still fail, and a report another person can repeat.',
    roles: {
      save: 'saver that fails',
      source: 'plain picture',
    },
    meta: {
      skill: 'Read a failure in the log and cut the workflow down to the smallest one that still fails, then write a report another person can repeat.',
      requires: ['A ComfyUI you can run.', 'The lesson “Run, queue, history and cancel”, or the same skills.'],
      mistakes: [
        {
          sign: 'You changed several things at once and the error went away, but you do not know why.',
          fix: 'Undo, then change one thing per run. When the error goes away, the last thing you removed or changed holds the cause.',
        },
        {
          sign: 'You read only the last red line and it means nothing to you.',
          fix: 'Read the whole block: the line "Exception during processing" names the error, the traceback shows where it came from, and its last line gives the reason. A path with custom_nodes in it points to a node pack.',
        },
        {
          sign: 'The cut-down workflow no longer fails.',
          fix: 'The cause was in what you removed. Put back half of it and run; keep halving until the error comes back.',
        },
        {
          sign: 'Your report holds your user name, private folders or a key.',
          fix: 'Look through the log text and the workflow before you send them. Replace a path with your user name by a placeholder, and remove any key or token: never share those.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes (Save Image, Empty Image). The failure is made on purpose with a guard of ComfyUI itself: Save Image refuses to write outside its output folder, so nothing is written anywhere. The lesson brings no model.',
      notChecked: `The app checks the graph on the canvas: the name that fails, the plain picture that feeds the saver, and that the workflow is small. It does not read the log of ComfyUI. ${NOT_CHECKED_TAIL}`,
    },
    steps: {
      intro: {
        title: 'Find the cause, not a workaround',
        body: 'When a workflow fails, changing things at random may make the error go away without telling you why, and it comes back. The way out has four parts:\n\n1. **Repeat** the failure, so you know it is not chance.\n2. **Read** the log: what failed, where, and why.\n3. **Cut** the workflow down while the failure stays, until nothing more can go.\n4. **Report** with the small workflow, the versions and the log text.\n\nIn this lesson you make a failure on purpose and safely, read it, cut the graph down to two nodes and write the report.',
      },
      ready: {
        title: 'Before you start',
        body: 'The first item the app sees for itself; the others only you know.',
        items: {
          comfy: { label: 'ComfyUI is running, and the app has read it.', how: 'The app sees this when it has read your ComfyUI (Sync).' },
          log: { label: 'I know where to read the log of my ComfyUI.', how: 'In ComfyUI: the Logs tab of the bottom panel (View, "Bottom Panel", or Ctrl with the backquote key). Or the console window ComfyUI runs in. The Desktop app on Windows also keeps files in AppData\\Roaming\\ComfyUI\\logs.' },
          version: { label: 'I wrote down the versions: ComfyUI, its interface, Python, PyTorch, my graphics card and system.', how: 'Settings, the page About, shows most of them.' },
        },
      },
      plant: {
        title: 'A failure on purpose',
        body: 'Keep the picture graph of the first lesson on the canvas, or any graph with a {save}.\n\nSet `filename_prefix` of {save} to `../broken`. The two dots mean "the folder above". ComfyUI refuses to save outside its output folder, so this name makes Save Image fail every time, and nothing is written anywhere.\n\nThis is a safe stand-in for a real failure: the method is the same. Should your ComfyUI save the file anyway, delete it from the folder above output and use a failure of your own for this lesson.',
      },
      reproduce: {
        title: 'Repeat it and find it in the log',
        body: `${RUN}\n\n${OWN_WORD}`,
        items: {
          ran: { label: 'I ran it, and the run stopped at Save Image with an error.', how: 'ComfyUI marks the node and shows the message. The whole picture was made first, so this took a full run.' },
          lines: { label: 'I found the block in the log: "Exception during processing", the traceback, and "Saving image outside the output folder is not allowed."' },
          again: { label: 'I ran it a second time and got the same error.' },
        },
      },
      'read-log': {
        title: 'How to read the block',
        body: 'A failure in the log reads from the top down:\n\n- The line with "Exception during processing" says that a node failed and gives the message.\n- "Traceback (most recent call last)" begins the way the error took through the code. Most of it is ComfyUI\'s own code.\n- The **last line** is the reason itself. Here: saving outside the output folder is not allowed.\n- A path with `custom_nodes` in the traceback points to a node pack: then the pack is the first suspect.\n\nA failure that happens before anything runs is a check of the graph instead: "Prompt outputs failed validation", with the node and the field below it.\n\nNow the question that cuts the graph: does this error need the model, the prompt and the sampler at all?',
      },
      cut: {
        title: 'Cut it down',
        body: 'The error is in {save}; what it saves does not matter. Test that.\n\nAdd {source}: a plain picture of one color, made without any model. Link its IMAGE output to `images` of {save}. Then delete every other node: the loader, the prompts, the blank, the sampler and the decoder.\n\nWhat remains is two nodes.',
      },
      confirm: {
        title: 'Is it small, and does it still fail?',
        body: `The app checks the size of the workflow itself. ${RUN}\n\nThe run is your own word: the app cannot see ComfyUI.`,
        items: {
          small: { label: 'The workflow on the canvas has at most three nodes.', how: 'The app checks this itself. A minimal example is one where nothing more can go.' },
          same: { label: 'I ran the two nodes, and the same error came.' },
          faster: { label: 'It failed in a moment, without loading a model.', how: 'If the error had gone away, the cause would have been in what you removed: put back half of it and run again.' },
        },
      },
      report: {
        title: 'Write the report',
        body: `A report someone else can repeat. ${OWN_WORD}`,
        items: {
          workflow: { label: 'I saved the minimal workflow as a .json file.' },
          versions: { label: 'I added the versions I wrote down at the start and the list of my node packs.' },
          text: { label: 'I added what I expected, what happened, and the log block from "Exception during processing" to the last line.' },
          private: { label: 'I looked through it for my user name in paths, private folders and keys, and removed them.' },
        },
      },
      assess: {
        title: 'How good is the example?',
        body: 'Answer for yourself; your answers stay on this computer.',
        criteria: {
          minimal: {
            title: 'No node can be removed without the error going away.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Try to remove each node in turn and run. Any that the error survives was not needed.',
          },
          repeat: {
            title: 'The minimal workflow fails every time I run it.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'A failure that comes and goes needs its conditions written down: what else ran before, how much memory was free.',
          },
          complete: {
            title: 'The report has the workflow, the versions, the log block and what I expected.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Read it as a stranger would: could you repeat the failure from it alone?',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          where: {
            text: 'Where in a traceback is the reason for the failure, most often?',
            choices: { first: 'In the first line', last: 'In the last line', middle: 'In the middle' },
            explain: 'The traceback lists the way through the code; the last line says what went wrong.',
          },
          gone: {
            text: 'You removed a node and the error went away. What does that tell you?',
            choices: { fixed: 'The problem is fixed', removed: 'The cause is in what I removed', luck: 'Nothing' },
            explain: 'Put the node back and the error should return: then you have found where the cause lives.',
          },
          why: {
            text: 'Why send a minimal example rather than your whole workflow?',
            choices: { shorter: 'It is shorter to type', 'faster-others': 'Others can repeat it fast, without your models and packs', pretty: 'It looks neater' },
            explain: 'A helper who must download your models and packs first will often not try at all.',
          },
        },
      },
      transfer: {
        title: 'On your own: a real failure',
        body: 'Use the method without help on a failure of your own: a workflow that failed for you, or one from someone else that does not run. Give Save Image a normal name again first.',
        items: {
          own: { label: 'I repeated a real failure and found its block in the log.' },
          cut: { label: 'I cut the workflow down while the error stayed, one change per run.' },
          write: { label: 'I wrote a report with the minimal workflow, the versions and the log text, checked for private data.' },
        },
      },
    },
  },
  'workflow-files': {
    title: 'JSON, API JSON and the workflow inside a PNG',
    result: 'One graph as an editable workflow, as an API-format file and as a picture that carries it, each opened again and checked for private values.',
    roles: {
      save: 'saver of the picture',
    },
    meta: {
      skill: 'Tell the editable workflow, the API format and a picture with a workflow apart, choose the right one for a purpose, and check it before you share it.',
      requires: ['A ComfyUI you can run, with one picture model in models/checkpoints.', 'The lessons “A first picture from text” and “Reading someone else\'s workflow”, or the same skills.', 'A plain text editor to look into a .json file.'],
      mistakes: [
        {
          sign: 'You sent the API file to someone who wants to edit the graph, and they see no notes and no layout.',
          fix: 'The API format keeps only what runs. For editing send the workflow saved with "Save" or "Export".',
        },
        {
          sign: 'A picture you shared opens with no workflow.',
          fix: 'A site or a chat app rewrote the file and dropped its metadata. Send the PNG as a file, or send the .json beside it.',
        },
        {
          sign: 'Your shared workflow or picture held a key, a private path or a prompt you did not mean to share.',
          fix: 'Every field travels in all three forms, and the picture carries the prompt too. Look into the files before you share them; this app asks before it saves a field that looks like a key.',
        },
        {
          sign: '"Export (API)" is not in the menu.',
          fix: 'Older interfaces hide it behind a developer setting. Look for the entry in the menu of your version, or update ComfyUI.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes and the file forms as the official documentation describes them (workflow metadata, the API form). No model, picture or prompt comes with the lesson.',
      notChecked: `The app checks the graph on the canvas, that every node is installed, and that the last workflow it opened was an API-format file. It does not look into your files for secrets. ${NOT_CHECKED_TAIL}`,
    },
    steps: {
      intro: {
        title: 'One graph, three forms',
        body: 'The same graph travels in three forms:\n\n- the **workflow** (.json), the graph as the editor shows it, with positions, groups and notes;\n- the **API format** (.json), only what runs, for programs and services;\n- a **picture** saved by ComfyUI, which carries both inside it.\n\nEach has its use, and each can carry more than you think. In this lesson you make all three from one graph, open each again, see what is inside, and check them before they leave your computer.',
      },
      ready: {
        title: 'Before you start',
        body: 'Two things the app can see for itself; the third only you know.',
        items: READY_ITEMS,
      },
      graph: {
        title: 'The picture graph',
        body: 'Keep the picture graph of the first lesson, or build it: {checkpoint}, the prompt and the negative prompt in {positive} nodes, {latent}, {sampler}, {decode} and {save}. A model is chosen in `ckpt_name`, the prompt is written in `text`.',
      },
      mark: {
        title: 'A mark to recognize',
        body: 'Give {save} a `filename_prefix` that starts with `formats/`, for example `formats/test`. You will look for this mark in every file.',
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'Before the graph goes to ComfyUI, the app checks that every node on the canvas is installed there.',
      },
      make: {
        title: 'Make the three files',
        body: `${RUN}\n\nThen save it twice from ComfyUI. The entries "Export" and "Export (API)" are in the menu of ComfyUI (named "Workflow" or "File", depending on the version). ${OWN_WORD}`,
        items: {
          open: { label: 'I opened the workflow in ComfyUI.' },
          ran: { label: 'I ran it, and a PNG appeared in the folder formats of the output folder.' },
          json: { label: 'I saved the workflow with "Export" as formats-ui.json.' },
          api: { label: 'I saved it with "Export (API)" as formats-api.json.' },
        },
      },
      inside: {
        title: 'What each form holds',
        body: '- The **workflow** holds `"nodes"` and `"links"`: every node with its position and size, the links as a table, groups, notes, subgraphs. ComfyUI and this app open it and show it as it was.\n- The **API format** is a list of numbered entries, each with `"class_type"` and `"inputs"`. No positions, no notes, no groups: what the editor sends to the server when you press Run. Scripts and services use it. This app opens it and lays the nodes out from left to right.\n- The **picture** carries two texts in its metadata: `"workflow"`, the whole graph, and `"prompt"`, the API form that ran. Drop it on ComfyUI, or open it here, and the graph comes back.\n\nAll three carry every value of every field: the prompt, the file names of your models, and anything typed into a field.',
      },
      look: {
        title: 'Open each one again',
        body: `Open the two .json files in a text editor, and the picture in this app. ${OWN_WORD}`,
        items: {
          ui: { label: 'In formats-ui.json I found "nodes", "links" and the mark formats/.' },
          api: { label: 'In formats-api.json I found "class_type", "inputs" and the mark formats/, and no positions.' },
          picture: { label: 'I opened the PNG here with "File ▸ Open workflow…": the message said the workflow was read from the picture.' },
        },
      },
      secrets: {
        title: 'Before it leaves your computer',
        body: `Whatever you share in any of the three forms, the other person can read. ${OWN_WORD}`,
        items: {
          search: { label: 'I searched the files for keys, tokens and paths with my user name, and found none, or removed them.', how: 'Search the text for words such as key, token and your user name. Never put a key into a field of a workflow you will share.' },
          prompt: { label: 'I know that the picture carries the prompt and the whole graph, and that ComfyUI started with --disable-metadata writes pictures without them.' },
        },
      },
      'api-open': {
        title: 'Open the API file here',
        body: 'Open formats-api.json in this app with "File ▸ Open workflow…". The message says the file was in the API format and the nodes were laid out from left to right; the graph and the mark formats/ are back.\n\nThe app checks that the last file it opened was an API-format file. Open no other file before the lesson ends.',
      },
      assess: {
        title: 'How did it go?',
        body: 'Answer for yourself; your answers stay on this computer.',
        criteria: {
          tell: {
            title: 'I can tell the three forms apart by looking into the file.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Look at the top of a .json: "nodes" means a workflow, numbered entries with "class_type" mean the API format.',
          },
          choose: {
            title: 'For a colleague, a script and an archive I know which form to give.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Editing needs the workflow, a program needs the API format, and a picture keeps the graph beside the result as long as nothing rewrites it.',
          },
          clean: {
            title: 'Nothing private is left in the files I would share.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'Search the files again, and replace private paths and values before you share.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          edit: {
            text: 'A colleague will go on editing your graph. What do you send?',
            choices: { ui: 'The workflow (.json from Save or Export)', api: 'The API format', png: 'A picture made by the graph' },
            explain: 'Only the workflow keeps positions, groups and notes. A picture also carries it, but only while nothing rewrites the file.',
          },
          script: {
            text: 'A program will send the graph to ComfyUI to run. What does it need?',
            choices: { ui: 'The workflow', api: 'The API format', png: 'A picture' },
            explain: 'The API format is what the server runs: nodes by number, with their class and inputs.',
          },
          chat: {
            text: 'You send a PNG made by ComfyUI through a chat app. What happens to its workflow?',
            choices: { kept: 'It is always kept', 'maybe-lost': 'It may be lost when the app rewrites the file', doubled: 'It is copied twice' },
            explain: 'Anything that rewrites a picture may drop its metadata. Send the file as a file, or the .json beside it.',
          },
        },
      },
      transfer: {
        title: 'On your own: a package to hand over',
        body: 'Without help, prepare a graph of yours for someone else. Do it in ComfyUI and your file manager; if you open another file here, open the API file again at the end.',
        items: {
          who: { label: 'I wrote down who gets it and what for: to edit, to run from a program, or to keep with the result.' },
          pack: { label: 'I put together the right files for that, with a short note of the models and node packs it needs.' },
          check: { label: 'I checked every file for private values before handing it over.' },
        },
      },
    },
  },
};
