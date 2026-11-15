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
};
