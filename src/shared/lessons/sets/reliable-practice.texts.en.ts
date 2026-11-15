/**
 * The English words of the set "reliable-practice" (reliable-practice.ts): reading a model card, diagnosing missing
 * nodes and models, auditing someone else's workflow and its packs, and the data, license and cost of partner nodes.
 * The Russian words are in reliable-practice.texts.ru.ts under the same ids.
 *
 * These lessons say plainly where the app stops: it reads ComfyUI and checks the graph on the canvas; everything done
 * in ComfyUI (install, update, run, snapshot, Manager) and every judgement is the person's own word.
 */
import type { LessonWords } from '../texts';

const RUN = 'Save the graph with “File ▸ Save workflow for ComfyUI…”, open the file in ComfyUI and run it there. The app runs nothing in ComfyUI itself.';
const OWN_WORD = 'The app cannot see ComfyUI run, so these ticks are your own word.';

/** The picture graph every lesson of the set may stand on, in a sentence. */
const GRAPH = 'Build the picture graph of the first lesson, or keep it if it is on the canvas: {checkpoint}, two {positive} nodes for the prompt and the negative prompt, {latent}, {sampler}, {decode} and {save}. Choose a picture model in `ckpt_name` and write a prompt of a few words in `text`.';

/** The role labels of that graph. */
const GRAPH_ROLES = {
  checkpoint: 'model',
  positive: 'prompt',
  negative: 'negative prompt',
  latent: 'blank',
  sampler: 'sampler',
  decode: 'decoder',
  save: 'saver',
};

export const RELIABLE_EN: Record<string, LessonWords> = {
  'model-card': {
    title: 'Model card: family, parts and license',
    result: 'A compatibility card for one model with its sources and unknowns, and the model tried with a LoRA of its own family.',
    roles: { ...GRAPH_ROLES, lora: 'LoRA' },
    meta: {
      skill: 'Before a model goes into a graph, say its family, the parts it needs, its file format and its license, each with a source, and mark what is unknown.',
      requires: ['A ComfyUI you can run, with one picture model in models/checkpoints and one LoRA in models/loras.', 'The lesson “A first picture from text”, or the same graph built by hand.', 'An internet connection to read the model\'s page (optional for the card in the app).'],
      mistakes: [
        {
          sign: 'You decided the family from the file name alone.',
          fix: 'A name is a hint. Look at where the card knows the family from: “from the file metadata” is stronger than “from the file name”. Check the model\'s own page.',
        },
        {
          sign: 'The console of ComfyUI prints many “lora key not loaded” lines and the LoRA changes nothing.',
          fix: 'The LoRA was made for another family. Take a LoRA of the checkpoint\'s family; the step “A LoRA of the same family” checks it.',
        },
        {
          sign: 'The page names no license, and you wrote “free” anyway.',
          fix: 'Write “unknown”. A missing license does not mean you may use the model for anything, least of all for a client.',
        },
        {
          sign: 'The only file offered is .ckpt or .pt, from a re-upload.',
          fix: 'Look for a .safetensors file of the same model on the author\'s page. Load a pickle file only from an author you trust.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes (Load Checkpoint, Load LoRA) and the app\'s model card. No model comes with the lesson: you use your own and check its license yourself. The notes on licenses are general teaching, not legal advice.',
      notChecked: 'The app checks the graph on the canvas, that the LoRA is of the checkpoint\'s family as far as its metadata or name tell, and what it already reads of your ComfyUI. It does not run the workflow, does not read the model\'s page or its license, and does not judge the picture: the card and the run are your own word.',
    },
    steps: {
      intro: {
        title: 'A name is not a proof',
        body: 'A model file arrives with a name like `realisticVision_v60.safetensors`. The name may say the family, or it may not. A wrong guess costs a run: a LoRA that does nothing, a text encoder that does not fit, a red error.\n\nIn this lesson you fill a short card for one model before you use it: its family, the parts it needs, its file format, its source and its license. Next to each answer you write where it comes from. What you cannot find you mark “unknown”. Then you try the model with a LoRA of its family.',
      },
      ready: {
        title: 'Before you start',
        body: 'The app can see all three for itself after a sync.',
        items: {
          comfy: { label: 'ComfyUI is running, and the app has read it.', how: 'The app sees this when it has read your ComfyUI (Sync).' },
          model: { label: 'There is a picture model in models/checkpoints.', how: 'The app sees this in the list of models of the last sync.' },
          lora: { label: 'There is a LoRA in models/loras.', how: 'The app sees this in the list of models of the last sync.' },
        },
      },
      card: {
        title: 'Read the card in the app',
        body: 'Open the library, the “Models” tab, and click your checkpoint. Its card opens.\n\n- “Family” says which family the app thinks it is, and how it knows: “from the file metadata”, “from the description next to the file”, “from the file name” or “from the internet”.\n- “Kind”, “Size” and “Folder” say what sort of file it is and where it lies.\n- A file in .ckpt, .pt, .pth or .bin gets a warning: such a format can run code when ComfyUI loads it.\n\nWrite each answer on your card with its source.',
        items: {
          family: { label: 'I wrote the family the card shows.', how: 'The line “Family” of the model card.' },
          source: { label: 'I wrote where the card knows it from.', how: 'The words after the family: metadata, the description next to the file, the file name or the internet.' },
          format: { label: 'I wrote the file format and whether the card warns about it.', how: 'The end of the file name: .safetensors, .gguf, or a pickle format such as .ckpt.' },
          online: { label: 'I pressed “Find on the internet” and compared what it found.', how: 'It sends the file fingerprint to civitai.com and, if Civitai does not know the file, its name to huggingface.co. Skip it if you do not want to send that.' },
        },
      },
      parts: {
        title: 'What parts a model needs',
        body: 'A picture model is three parts: the diffusion model that draws, the text encoder that reads the prompt, and the VAE that turns the result into pixels.\n\n- A checkpoint in models/checkpoints usually holds all three. “Load Checkpoint” gives MODEL, CLIP and VAE.\n- Many newer models come as separate files: the diffusion model in models/diffusion_models (“Load Diffusion Model”), the text encoder in models/text_encoders (“Load CLIP”), the VAE in models/vae (“Load VAE”). The text encoder must be the one the family was trained with.\n- One model may come in several precisions: fp16 or bf16 (full), fp8 (half the size), GGUF (quantized, read by a pack). A LoRA trained on the full model works on its lighter files of the same model.\n- A LoRA works only with the family it was made for.',
      },
      license: {
        title: 'Source and license',
        body: 'Now open the model\'s own page: the author\'s page on Hugging Face, Civitai or the maker\'s site.\n\nOn Hugging Face the model card is the README of the repository. A block at its top names the `license` and often the `base_model`, and the page shows the license. On other sites look for a section on the license or the permissions. Write what it says about commercial use. If the page says nothing, write “unknown”: that is an honest answer.',
        items: {
          page: { label: 'I wrote the address of the author\'s page, not of a re-upload.', how: 'The page of the person or company that made the model.' },
          license: { label: 'I wrote the license and what it says about commercial use, or “unknown”.', how: 'The license line of the page, or its license file.' },
          unknowns: { label: 'Every line of my card I could not confirm says “unknown”.', how: 'Family, parts, precision, source, license: nothing is left as a guess.' },
          hash: { label: 'I compared the file\'s checksum with the one on the page.', how: 'If the page gives a SHA-256, compute your file\'s (for example `sha256sum` on Linux, `Get-FileHash` on Windows) and compare.' },
        },
      },
      graph: {
        title: 'The model in a small graph',
        body: `${GRAPH}\n\nChoose in {checkpoint} the model of your card.`,
      },
      lora: {
        title: 'A LoRA of the same family',
        body: 'Add {lora} between {checkpoint} and the rest. Its `model` and `clip` come from {checkpoint}; its MODEL goes to {sampler}, its CLIP to both {positive} nodes.\n\nChoose in `lora_name` a LoRA of your model\'s family. The app compares the two families as far as the metadata or the names tell, and says so when they differ. A family nothing tells is not judged: then your card decides.',
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'Before the graph goes to ComfyUI, the app checks that every node on the canvas is installed there.',
      },
      run: {
        title: 'Run it',
        body: `${RUN}\n\n${OWN_WORD}`,
        items: {
          export: { label: 'I saved the workflow for ComfyUI and opened it there.' },
          ran: { label: 'I ran it, and a picture appeared.', how: 'A new file in the output folder of ComfyUI.' },
          console: { label: 'I read the console of ComfyUI during the run.', how: 'Many lines “lora key not loaded” mean the LoRA does not fit the model.' },
        },
      },
      assess: {
        title: 'How good is the card?',
        body: 'Judge your card and the run. The app records your choice and nothing else.',
        criteria: {
          card: {
            title: 'The card names the family, the parts, the format, the source and the license.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Fill the missing lines from the model\'s page, or write “unknown” where the page says nothing.',
          },
          unknowns: {
            title: 'Every line I could not confirm is marked “unknown”, not guessed.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'Go through the card once more and replace every guess by “unknown” and the reason.',
          },
          effect: {
            title: 'The LoRA visibly changed the picture, and the console showed no long list of “lora key not loaded”.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Check the LoRA\'s trigger words on its card, and its family. Then run once with the LoRA and once without, same seed.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          name: {
            text: 'A file is called `flux_lora_style.safetensors`. What does the name tell you?',
            choices: { proof: 'It is surely a Flux LoRA', hint: 'A hint to confirm', nothing: 'Nothing at all' },
            explain: 'A name is a hint. The metadata and the author\'s page confirm it; the card says which one the app used.',
          },
          parts: {
            text: 'What does a usual picture checkpoint hold?',
            choices: { model: 'Only the diffusion model', three: 'The diffusion model, the text encoder and the VAE', lora: 'A LoRA' },
            explain: 'That is why “Load Checkpoint” has three outputs. A model in separate files needs its own text encoder and VAE.',
          },
          format: {
            text: 'Which file format can run code when ComfyUI loads it?',
            choices: { safetensors: '.safetensors', ckpt: '.ckpt', gguf: '.gguf' },
            explain: '.ckpt, .pt, .pth and .bin are usually pickle files, which can hold code. .safetensors and .gguf hold data.',
          },
        },
      },
      transfer: {
        title: 'On your own: a model in separate files',
        body: 'Fill a card for a model you do not have yet that comes as separate files (a diffusion model, a text encoder and a VAE). Use its official page and the template of its family in ComfyUI. The app gives no ready answer here.',
        items: {
          pick: { label: 'I chose a model that comes as separate files and found its official page.' },
          parts: { label: 'I wrote each file it needs, the folder of each and the loader node of each.' },
          license: { label: 'I wrote its license and every unknown, with sources.' },
        },
      },
    },
  },
  'diagnose-missing': {
    title: 'Diagnosing missing nodes, models and IMPORT FAILED',
    result: 'One failure named by its class with evidence, a known-good small graph that runs, and a fix confirmed by a second run.',
    roles: GRAPH_ROLES,
    meta: {
      skill: 'Name the class of a ComfyUI failure (a node, a model, a pack that failed to import, the frontend, the environment) with evidence before installing anything.',
      requires: ['A workflow that fails in your ComfyUI, with its error.', 'The lesson “A first picture from text”, or the same graph built by hand.', 'Access to the terminal or log of ComfyUI.'],
      mistakes: [
        {
          sign: 'A node is red, and you install the first pack a search shows.',
          fix: 'First read why it is red. A pack that is installed but failed to import needs its error read, not a second copy. Look for “(IMPORT FAILED)” in the start log.',
        },
        {
          sign: '“Value not in list: ckpt_name” and you reinstall ComfyUI.',
          fix: 'That is a missing model file, not a broken install. Put the file the workflow names into its folder, refresh ComfyUI and run again.',
        },
        {
          sign: 'Everything fails, even the small picture graph.',
          fix: 'Then it is not the workflow. Start ComfyUI with `--disable-all-custom-nodes`: if the small graph runs then, a pack breaks the start; if not, it is the environment (Python, the graphics driver, the install).',
        },
        {
          sign: 'You updated everything at once to fix one node, and now more fails.',
          fix: 'Go back with the snapshot you saved (“Restore” in ComfyUI Manager, applied at the next start), then change one thing at a time.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes and its official troubleshooting pages (docs.comfy.org), the start log of ComfyUI and the ComfyUI Manager README. No workflow comes with the lesson: you use one that fails for you.',
      notChecked: 'The app reads which nodes your ComfyUI has and checks the small graph on the canvas. It does not run anything, does not read the log of ComfyUI, does not install or update anything and does not know your versions: the evidence, the fix and every run are your own word.',
    },
    steps: {
      intro: {
        title: 'Find the class before you install',
        body: 'A red node or a red message tempts you to install something at once. Often that makes it worse: a second copy of a pack, an update that breaks another pack.\n\nThe route of this lesson: the error and its object, the versions, the class of the problem with evidence, a known-good small graph, then a fix or a way back. Only the fix changes anything, and only after a backup.',
      },
      ready: {
        title: 'Before you change anything',
        body: 'One thing the app sees, two only you can do.',
        items: {
          comfy: { label: 'ComfyUI is running, and the app has read it.', how: 'The app sees this when it has read your ComfyUI (Sync).' },
          version: { label: 'I wrote the versions of ComfyUI, Python and PyTorch.', how: 'The About page in the settings of ComfyUI lists them.' },
          backup: { label: 'I have a way back: a snapshot, or a copy of the custom_nodes folder.', how: 'ComfyUI Manager has “Save snapshot”; or copy custom_nodes before you touch it.' },
        },
      },
      kinds: {
        title: 'Five classes and their signs',
        body: '- **A node is missing**: the workflow names a node your ComfyUI does not have. ComfyUI lists the missing node types when it opens the workflow; this app\'s Check lists “Nodes that are not installed”.\n- **A model is missing**: “Value not in list: ckpt_name: … not in []”, or a dialog “This workflow is missing models”. The node is there; the file is not in its folder.\n- **A pack failed to import**: the pack is installed, but at start ComfyUI printed “Cannot import … module for custom nodes” with a traceback, and the list “Import times for custom nodes:” shows the pack with “(IMPORT FAILED)”. Usually a Python package is missing or of the wrong version.\n- **The frontend**: the canvas or a menu misbehaves while the graph itself is fine. Switching off the third-party extensions in the settings of ComfyUI tells.\n- **The environment**: even ComfyUI\'s own nodes fail: the Python, the graphics driver or the install.\n\nParts of different families give their own message, such as “mat1 and mat2 shapes cannot be multiplied”: the file is there but does not fit.',
      },
      evidence: {
        title: 'Collect the evidence',
        body: 'Work on the workflow that fails. Opening it in this app runs nothing: “File ▸ Open workflow…”.',
        items: {
          error: { label: 'I copied the full text of the error of ComfyUI.', how: 'The red message, or “Show report” in the dialog of a failed run, or the lines in the terminal.' },
          explain: { label: 'I pasted it into “Explain a ComfyUI error…” in this app and read the meaning.', how: 'The item is in the “Graph” menu and the “Help” menu. It shows the nodes the error names.' },
          check: { label: 'I opened the workflow in this app and pressed “Check graph”.', how: 'Write down “Nodes that are not installed” and “Models that are not on disk”.' },
          log: { label: 'I read the start log of ComfyUI for “(IMPORT FAILED)”.', how: 'The list “Import times for custom nodes:” near the end of the start; the traceback of a failed pack is above it.' },
        },
      },
      classify: {
        title: 'Name the class',
        body: 'Now decide, on paper, before you install anything.',
        items: {
          class: { label: 'I wrote the class: node, model, pack import, frontend or environment.' },
          proof: { label: 'I wrote the line of evidence that shows it.', how: 'One line of the error, the check or the log.' },
          nothing: { label: 'I have installed and updated nothing so far.' },
        },
      },
      core: {
        title: 'ComfyUI\'s own nodes are there',
        body: 'The first fork: does ComfyUI itself work? The app checks that three of its own nodes are installed: KSampler, Load Checkpoint and Save Image. If they are missing, the problem is the environment, not a pack.',
      },
      graph: {
        title: 'A known-good small graph',
        body: `Start a new graph (“File ▸ New project”; the open one stays in the history). ${GRAPH}\n\nThis graph uses only ComfyUI\'s own nodes. If it runs, ComfyUI works, and the failure lives in the parts the failing workflow adds.`,
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'The app checks that every node of the small graph is installed in your ComfyUI.',
      },
      test: {
        title: 'Test, fix, run again',
        body: `${RUN}\n\nThen fix by the class you named, one change at a time:\n- a missing node: install its pack through ComfyUI Manager (“Install Missing Custom Nodes” lists the packs of the open workflow), after checking the pack (the lesson “Auditing someone else\'s workflow and a custom pack”);\n- a missing model: put the file into its folder and refresh ComfyUI;\n- a failed import: update that pack through Manager, or remove it, then restart;\n- the frontend: switch off third-party extensions, then switch them on half at a time.\n\nEvery change to packs can break something: keep your snapshot. ${OWN_WORD}`,
        items: {
          baseline: { label: 'The small graph ran, and a picture appeared.', how: 'A new file in the output folder of ComfyUI.' },
          half: { label: 'I started ComfyUI once with `--disable-all-custom-nodes` to see whether a pack breaks the start.', how: 'In the portable build, add the flag to a copy of its start file.' },
          fix: { label: 'I made one change that matches the class I named.' },
          rerun: { label: 'I ran the failing workflow again, and the error is gone or has changed.', how: 'Compare the new error, if any, with the first one.' },
        },
      },
      assess: {
        title: 'How did the diagnosis go?',
        body: 'Judge your own work. The app records your choice and nothing else.',
        criteria: {
          class: {
            title: 'The failure is named by its class with a line of evidence.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Read the error once more, then the start log. The line that names the node, the file or the pack is the evidence.',
          },
          first: {
            title: 'I named the class before I installed or updated anything.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'Go back with your snapshot and start again from the evidence. A fix found by chance is not a diagnosis.',
          },
          minimal: {
            title: 'The known-good small graph ran in my ComfyUI.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'If even it fails, the problem is the environment: compare your versions with the About page and the ComfyUI install notes.',
          },
          fixed: {
            title: 'The failing workflow runs now, or I know the exact next step.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Write a report for the pack\'s author: the versions, the error, the start log and the smallest workflow that fails.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          'not-in-list': {
            text: '“Value not in list: ckpt_name: … not in []”. What is missing?',
            choices: { node: 'A node', model: 'A model file', pack: 'A pack' },
            explain: 'The node is there; the file it asks for is not in its folder.',
          },
          import: {
            text: 'The start log shows a pack with “(IMPORT FAILED)”. Where is the problem?',
            choices: { model: 'In a model file', pack: 'In that pack or what it needs', frontend: 'In the frontend' },
            explain: 'The pack is installed but could not load. The traceback above the list says why, often a missing Python package.',
          },
          core: {
            text: 'KSampler itself is missing in your ComfyUI. What class is that?',
            choices: { pack: 'A missing pack', environment: 'The environment', model: 'A missing model' },
            explain: 'KSampler is a node of ComfyUI itself. When it is missing, the install or its Python is broken, not a pack.',
          },
        },
      },
      transfer: {
        title: 'On your own: a report',
        body: 'Use the route on the next failure you meet, without help, and write it up so another person could repeat it.',
        items: {
          next: { label: 'I took a new failure and named its class with evidence before changing anything.' },
          report: { label: 'I wrote a report: the versions, the error, the log lines and what I tried.' },
          minimal: { label: 'I cut the failing workflow down to the fewest nodes that still fail, and saved it with the report.' },
        },
      },
    },
  },
};
