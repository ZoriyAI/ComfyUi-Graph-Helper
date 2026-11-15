/**
 * The English words of the group "Start and a reliable setup" (environment.ts): choosing how to run ComfyUI, a first
 * run that proves the install, a model library, a first node pack installed safely, and snapshots, updates and the
 * way back. The Russian words are in environment.texts.ru.ts under the same ids.
 *
 * These lessons say plainly where the app stops: it reads ComfyUI and never changes it. Installing, updating, the
 * Manager and every run are the person's own work in ComfyUI, ticked as their own word; the app checks only what it
 * already reads (a ComfyUI read, a model file listed, a node class installed, a workflow from a picture).
 */
import type { LessonWords } from '../texts';

const SAVE = 'Save the graph with “File ▸ Save workflow for ComfyUI…”, open the file in ComfyUI and run it there. The app runs nothing in ComfyUI itself.';
const NOT_CHANGED = 'The app reads your ComfyUI and never changes it: it installs, updates and runs nothing.';

export const ENVIRONMENT_EN: Record<string, LessonWords> = {
  'choose-setup': {
    title: 'Desktop, Portable, a manual install or Cloud',
    result: 'A written choice of how you run ComfyUI, with its limits, made before anything is installed.',
    roles: { card: 'card of your choice' },
    meta: {
      skill: 'Choose a way to run ComfyUI that fits your computer, your privacy, the packs you need and your budget, and name its limits.',
      requires: ['Nothing installed yet is fine. You need to know your operating system and your graphics card, or where to look them up.'],
      mistakes: [
        {
          sign: 'You install two or three ways “to try”, and now models lie in several folders.',
          fix: 'Keep one way. If you need a second, share one model folder between them (the lesson “A model library and shared folders” shows how) instead of copying gigabytes.',
        },
        {
          sign: 'You chose Cloud, and a workflow you found needs a pack Cloud does not have.',
          fix: 'Cloud runs a fixed set of packs and you cannot add your own. Replace the missing nodes or run that workflow on a local install.',
        },
        {
          sign: 'You chose Portable on a Mac or on Linux.',
          fix: 'Portable is for Windows with an NVIDIA card or the processor only. On a Mac take Desktop; on Linux take Desktop or a manual install.',
        },
        {
          sign: 'You picked by what a video said was “the best”, without your own facts.',
          fix: 'Go back to the checklist: system, graphics card and its memory, free disk, privacy, packs and money. The right way depends on them.',
        },
      ],
      provenance: 'The ways and their limits come from the official ComfyUI documentation (docs.comfy.org: system requirements, Comfy Cloud) and the ComfyUI README, as of 2026-11-15. Prices and plans of Cloud change: read them on its own page. No software comes with the lesson.',
      notChecked: 'The app checks only that the card of your choice is written on the canvas. It does not see your computer, does not install or run anything, and does not judge whether the choice is right: the facts and the assessment are your own word.',
    },
    steps: {
      intro: {
        title: 'Four ways to run the same ComfyUI',
        body: 'ComfyUI is the same program whichever way you run it. What differs is who sets it up, where it runs, what you may add to it, and what it costs.\n\nIn this lesson you collect the facts of your computer and your needs, compare four ways, and write your choice with its limits. You install nothing yet: the next lesson does that.\n\nThe app checks that the card is written. Whether the choice suits you is your own judgement.',
      },
      facts: {
        title: 'Your facts first',
        body: 'Write these down on paper or in a note. They decide the choice more than any advice does.',
        items: {
          system: { label: 'My operating system: Windows, macOS (and whether the Mac has an Apple chip, M1 or later) or Linux.' },
          card: { label: 'My graphics card and its memory, or “none”.', how: 'Windows: Task Manager ▸ Performance ▸ GPU. macOS: About This Mac. Linux: the `nvidia-smi` command for NVIDIA cards.' },
          disk: { label: 'How much free disk I have.', how: 'One picture model is 2 to 7 GB; video models are often 10 GB and more.' },
          privacy: { label: 'Whether my pictures and prompts may leave my computer.', how: 'If not, only a local install keeps them at home.' },
          packs: { label: 'Whether I need node packs of my own choice, for example for a workflow I found.' },
          money: { label: 'What I may spend: nothing, a monthly plan, or paid runs.' },
        },
      },
      ways: {
        title: 'The three local ways',
        body: 'The official documentation names three ways to install ComfyUI on your own computer:\n\n- **Comfy Desktop**: an installer for Windows, macOS on Apple chips, and Linux. It sets up Python and the Manager for you, follows the stable release by default, and keeps snapshots before updates. The easiest start for most people.\n- **Portable**: a folder for Windows that you unpack and start, for NVIDIA cards or the processor alone. The official README calls it “not recommended for regular users”; it suits people who want the newest commits or several separate copies.\n- **Manual install**: the source from Git and its Python packages, for every system and every graphics card (NVIDIA, AMD, Intel, Apple). The most control, and you look after Python yourself. comfy-cli is a command line tool that does the same steps for you.\n\nAll three run on your graphics card, keep your files at home, work offline once models are there, and let you add any pack you choose.',
      },
      cloud: {
        title: 'Comfy Cloud',
        body: 'Comfy Cloud is ComfyUI run by its makers on their graphics cards, in your browser. Nothing to install, no graphics card needed.\n\nIts limits, as the official page states them:\n- it runs a fixed set of node packs: you cannot install your own;\n- it works only online; your inputs go to the service;\n- there is a free tier and paid plans, and one run has a time limit.\n\nCloud suits a weak computer and the official templates. It does not suit a workflow that needs a pack outside its set, or work that must stay on your computer. Prices change: read them on the Cloud page, not here.',
      },
      choice: {
        title: 'Write your choice',
        body: 'Add a {card} node to the canvas and write in its `value` field, in a few lines:\n\n- the way you choose and why, from your facts;\n- two limits it has for you (for example “no packs of my own” or “I look after Python myself”);\n- what would make you change it.\n\nThe card stays in the workflow you save, so you find it again. Do not write keys, passwords or addresses into it.',
      },
      assess: {
        title: 'Is the choice sound?',
        body: 'Answer for yourself. The app records your answers and does not judge them.',
        criteria: {
          fits: {
            title: 'The way runs on my system and my graphics card.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Check the system list again: Portable is Windows only; Desktop needs an Apple chip on a Mac; a manual install takes any card.',
          },
          limits: {
            title: 'I named at least two limits of my way, in my own words.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Look at packs, privacy, offline work, updates and money: each way gives up something in one of them.',
          },
          'nothing-extra': {
            title: 'I chose one way and installed nothing “just to try”.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'Remove the extra install after you moved your files out of it, or keep it on purpose and write why on the card.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          mac: {
            text: 'A newcomer has a Mac with an M2 chip. Which way to start?',
            choices: { portable: 'Portable', desktop: 'Comfy Desktop', none: 'None: a Mac cannot run ComfyUI' },
            explain: 'Desktop supports macOS on Apple chips. Portable is for Windows only. A manual install also works, with more care.',
          },
          'own-pack': {
            text: 'A workflow needs a pack outside the official set. Where can you install it?',
            choices: { cloud: 'In Comfy Cloud', local: 'In a local install', both: 'In both' },
            explain: 'Cloud runs a fixed set of packs and you cannot add your own; a local install takes any pack you choose.',
          },
          offline: {
            text: 'Which way works without the internet once the models are on disk?',
            choices: { cloud: 'Comfy Cloud', local: 'A local install' },
            explain: 'Cloud is an online service. A local install runs on your computer offline.',
          },
        },
      },
      transfer: {
        title: 'On your own: someone else\'s computer',
        body: 'Use the same method for another person: a friend, a colleague, a school computer. The app gives no ready answer here.',
        items: {
          person: { label: 'I collected their facts: system, graphics card and memory, disk, privacy, packs, money.' },
          write: { label: 'I wrote a way for them, and why, from their facts.' },
          limit: { label: 'I wrote the limit they will meet first, and what they would do then.' },
        },
      },
    },
  },
  'first-run': {
    title: 'Install and a first run without errors',
    result: 'A working install proven by a first picture, and an environment card: system, graphics card, version, way of install and folders.',
    roles: { save: 'saver of the first picture', card: 'environment card' },
    meta: {
      skill: 'Install ComfyUI so that it is proven to work: read its start log, run a first picture, and write an environment card someone else could repeat.',
      requires: ['Your choice from the lesson “Desktop, Portable, a manual install or Cloud”.', 'About 10 GB of free disk for ComfyUI and a first model.'],
      mistakes: [
        {
          sign: 'The page of ComfyUI opens, but the list of checkpoints is empty and the template asks for a model.',
          fix: 'A fresh ComfyUI has no models. Use “Download” in the list of missing models, or put the file into models/checkpoints yourself, then press R in ComfyUI and “Sync now” here.',
        },
        {
          sign: 'The start log shows red lines, or the window closes at once.',
          fix: 'Read the last lines: they name the cause (Python, a missing package, the graphics card). Compare with the official install page of your way; do not run random commands from forums.',
        },
        {
          sign: 'The app cannot find ComfyUI.',
          fix: 'Open the address ComfyUI printed (“To see the GUI go to: …”) in the browser first. Desktop answers at port 8000, the others at 8188. Then in the app: Settings ▸ Connection ▸ Find on this computer.',
        },
        {
          sign: 'The card says “latest” instead of a version number.',
          fix: 'Copy the version from the line “ComfyUI version:” of the start log. “Latest” changes every week; a number lets you go back.',
        },
      ],
      provenance: 'The steps follow the official install pages and the first generation tutorial at docs.comfy.org, and ComfyUI\'s own start log (ComfyUI 0.45.0), as of 2026-11-15. The model is yours to download from its official page; mind its license.',
      notChecked: `${NOT_CHANGED} It checks that it read your ComfyUI, that models/checkpoints lists a file, that the last workflow it opened came from a picture, that every node of it is installed, and that the card is written. It does not run anything: the install, the run and the log are your own word.`,
    },
    steps: {
      intro: {
        title: 'Working means a picture, not a window',
        body: 'A window that opens proves little. An install works when it starts without errors, makes a picture, and you know what it is: which version, on which graphics card, where its folders are.\n\nIn this lesson you install ComfyUI the way you chose, read its start log, run a first picture, open that picture here, and write an environment card. The help pages “ComfyUI and where to get it” and “The first hour” in this app\'s guide go along with it.',
      },
      install: {
        title: 'Install and start',
        body: 'Follow the official instructions for your way (docs.comfy.org, Installation; the download page is comfy.org/download):\n\n- Desktop: run the installer and follow its steps.\n- Portable: unpack the folder and start `run_nvidia_gpu.bat` (or the processor variant).\n- Manual: Git, a Python virtual environment, `pip install -r requirements.txt`, then `python main.py`.\n\nKeep the console window open: closing it stops ComfyUI.',
        items: {
          official: { label: 'I installed by the official instructions of my way, not by a video or a forum post.' },
          started: { label: 'ComfyUI started, and its page opened in the browser or in the Desktop window.', how: 'The start log prints “To see the GUI go to:” and the address.' },
          log: { label: 'I found in the start log the lines “ComfyUI version:”, “Device:” and “Total VRAM”.', how: 'Desktop shows the log in its own window (look for logs in its menu); Portable and manual print it in the console.' },
        },
      },
      connect: {
        title: 'Connect the app',
        body: 'In this app open Settings ▸ Connection, press “Find on this computer” (it looks at ports 8188 and 8000) or type the address ComfyUI printed, save, and press “Read ComfyUI”.\n\nThe app checks that it read your ComfyUI.',
      },
      model: {
        title: 'A first model',
        body: 'A fresh ComfyUI has no models. The official first generation tutorial uses `v1-5-pruned-emaonly-fp16.safetensors`, a small picture model, in `models/checkpoints`.\n\nWhen a workflow needs a file you do not have, ComfyUI lists it under missing models in its right panel, often with a “Download” button. Desktop puts the file into the right folder; in Portable and manual installs the browser downloads it and you move it into `models/checkpoints` yourself. Then press R in ComfyUI, so it reads the folders again.\n\nPrefer `.safetensors` files from the model\'s official page: older formats can run code.',
      },
      run: {
        title: 'Run a first picture',
        body: 'In ComfyUI open a simple picture template from its template browser, or the workflow of the official first generation tutorial. Then:\n\n- get the model it asks for;\n- press Run (Ctrl+Enter);\n- wait for the picture on Save Image.\n\nThe app sees the model file after “Sync now”. The run is your own word.',
        items: {
          template: { label: 'I opened a simple picture template or the tutorial workflow in ComfyUI.' },
          file: { label: 'A model file is in models/checkpoints.', how: 'The app sees it in the list of models after “Sync ▸ Sync now”.' },
          ran: { label: 'I pressed Run, and the picture appeared on Save Image.', how: 'The log prints “Prompt executed in … seconds”.' },
          saved: { label: 'The picture is in the output folder.', how: 'A file such as ComfyUI_00001_.png in ComfyUI/output, or under “Assets”, tab “Generated”.' },
        },
      },
      picture: {
        title: 'Open the picture here',
        body: 'ComfyUI writes the workflow into every picture it saves. In this app choose “File ▸ Open workflow…” and pick the picture from the output folder. The graph that made it appears on the canvas.\n\nThe app checks that the last file it opened was a picture with a workflow.',
      },
      graph: {
        title: 'The graph that made it',
        body: 'Look at the graph from your picture. It ends in {save}: the node that wrote the file and put the workflow inside it.\n\nIf you closed the picture, open it again.',
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'The app checks that every node of this graph is installed in the ComfyUI it read. For a first template that is ComfyUI\'s own nodes.',
      },
      card: {
        title: 'The environment card',
        body: 'Add a {card} node beside the graph and write in its `value`:\n\n- the operating system;\n- the graphics card and its memory (the “Device:” and “Total VRAM” lines);\n- the ComfyUI version (the “ComfyUI version:” line) and the way of install;\n- where ComfyUI and its models folder are.\n\nWrite folders without your user name if you will share the workflow. No keys, no passwords. The text node changes nothing in the run: a node that leads to no output is skipped.',
      },
      keep: {
        title: 'Keep the known good pair',
        body: `${SAVE}\n\nThis workflow and its picture are your known good pair: after an update, the same workflow must give the same picture.`,
        items: {
          export: { label: 'I saved the workflow with the card under a clear name, such as control-first-picture.' },
          picture: { label: 'I kept the first picture next to it.' },
        },
      },
      assess: {
        title: 'Is the install proven?',
        body: 'Answer for yourself. The app does not see the log or the picture.',
        criteria: {
          log: {
            title: 'The start log.',
            levels: { errors: 'Red errors', warnings: 'Only warnings', clean: 'Clean' },
            tryNext: 'Read each red line from the bottom up. A line about a pack is for the lesson on packs; a line about Python or the graphics card goes back to the install page.',
          },
          card: {
            title: 'The card has the system, the graphics card, the version, the way and the folders.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Take the missing line from the start log; it prints the version, the device and the memory.',
          },
          again: {
            title: 'I can start ComfyUI again by myself, without these notes.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'Close ComfyUI, start it once more the same way, and write the one line you needed onto the card.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing.',
        questions: {
          proof: {
            text: 'What proves that the install works?',
            choices: { window: 'The window opened', picture: 'A picture was made and saved', log: 'The install ended without a message' },
            explain: 'Only a run proves the whole chain: Python, the graphics card, the model, the nodes and the output folder.',
          },
          version: {
            text: 'Where do you read the exact ComfyUI version?',
            choices: { log: 'In the start log, the line “ComfyUI version:”', folder: 'In the name of the folder', app: 'This app shows it' },
            explain: 'ComfyUI prints its version at every start. This app does not keep it, so the lesson asks you to write it down.',
          },
          empty: {
            text: 'The list in Load Checkpoint is empty. What does it mean?',
            choices: { broken: 'ComfyUI is broken', 'no-file': 'There is no file in models/checkpoints yet', reinstall: 'You must reinstall' },
            explain: 'A loader lists only its own folder. Put a file there and press R.',
          },
        },
      },
      transfer: {
        title: 'On your own: a cold start',
        body: 'Tomorrow, or after a restart of the computer, do it without the lesson.',
        items: {
          cold: { label: 'I started ComfyUI from a switched off computer, without these steps.' },
          compare: { label: 'I compared the start log with my card: the version, the device and the memory.' },
          note: { label: 'I wrote down what differed and why, or that nothing did.' },
        },
      },
    },
  },
  'model-library': {
    title: 'A model library and shared folders',
    result: 'Models in the folders ComfyUI looks in, one copy of each, and a manifest of the important files with their hashes.',
    roles: { model: 'model from your library' },
    meta: {
      skill: 'Keep model files where ComfyUI finds them, share one folder instead of copying it, and write a manifest that lets you rebuild the library.',
      requires: ['A working ComfyUI (the lesson “Install and a first run without errors”) with at least one checkpoint.'],
      mistakes: [
        {
          sign: 'A file is on disk, but no loader lists it.',
          fix: 'It is in the folder of another kind, or ComfyUI has not read the folders again. Move it to the folder of its kind, press R in ComfyUI, then “Sync now” here.',
        },
        {
          sign: 'After you edited extra_model_paths.yaml nothing changed, or ComfyUI does not start.',
          fix: 'ComfyUI reads the file only at start: restart it. If it fails, put back the copy you saved before, and check the spaces of the indents and the base_path.',
        },
        {
          sign: 'The same 6 GB model lies in two installs.',
          fix: 'Keep one copy in a shared folder and point both installs to it with extra_model_paths.yaml (Desktop: add lines to its extra_models_config.yaml). Delete the second copy only after the shared one works.',
        },
        {
          sign: 'A downloaded file has a new name and you no longer know which model it is.',
          fix: 'Compare its hash with the one in your manifest or on the model\'s page. A name proves nothing; a hash does.',
        },
      ],
      provenance: 'The folders, extra_model_paths.yaml and the refresh come from docs.comfy.org (models) and the example file in the ComfyUI repository, as of 2026-11-15. The hash commands are the ones built into Windows, macOS and Linux. No model comes with the lesson: mind the license of each file you keep.',
      notChecked: `${NOT_CHANGED} It checks that it read your ComfyUI, that models/checkpoints lists a file, and that the loader on the canvas holds a picture model. It does not see your disk, the YAML file or the hashes: moving files, the manifest and the run are your own word.`,
    },
    steps: {
      intro: {
        title: 'A library, not a heap',
        body: 'Models are the largest files you will have: gigabytes each. A heap of them in one folder costs disk and hides which file is which.\n\nIn this lesson you put each file in the folder of its kind, share one folder between installs where you need it, and write a manifest of the important files with their hashes. Moving and deleting files can lose work: every step that touches files starts with a copy.',
      },
      ready: {
        title: 'Before you start',
        body: 'The app checks both of these itself.',
        items: {
          comfy: { label: 'ComfyUI is running, and the app has read it.', how: 'The app sees this when it has read your ComfyUI (Sync).' },
          model: { label: 'models/checkpoints holds at least one file.', how: 'The app sees it in the list of models of the last sync.' },
        },
      },
      kinds: {
        title: 'One folder per kind',
        body: 'ComfyUI looks for files in sub-folders of `ComfyUI/models`, one per kind:\n\n- `checkpoints`: whole models (SD 1.5, SDXL);\n- `diffusion_models`: only the part that draws (Flux, Wan, Qwen-Image);\n- text_encoders, vae, loras, controlnet, upscale_models and more.\n\nEach loader lists only its own folder. A file in the wrong folder is not an error: it is simply absent from the list. Sub-folders are fine and show as part of the name, for example `sdxl/juggernaut.safetensors`. After you add or move a file, press R in ComfyUI (or restart it) and choose “Sync now” here.',
      },
      sort: {
        title: 'Sort the files',
        body: 'Sort what you have. Copy first, move after: a model you deleted by mistake is gigabytes to download again.',
        items: {
          backup: { label: 'Before moving anything I made sure I can get each file again (its page, or a copy on another disk).' },
          list: { label: 'I know the kind of each file: a whole checkpoint, a diffusion model, a text encoder, a VAE, a LoRA.', how: 'The model\'s page says it; this app\'s glossary explains each kind.' },
          move: { label: 'Each file is in the folder of its kind, with sub-folders by family where I have many.' },
          refresh: { label: 'I pressed R in ComfyUI and “Sync now” in the app.' },
        },
      },
      loader: {
        title: 'Practice: the library in a loader',
        body: 'Add a {model} node and choose a picture model in its `ckpt_name`. The list shows your checkpoints folder, sub-folders included.\n\nThe app checks that the file is a picture model, not a video model or a file of another kind.',
      },
      shared: {
        title: 'One folder for several installs',
        body: 'Two installs (for example Desktop and Portable), or ComfyUI and another program, can share one model folder instead of two copies. ComfyUI reads extra folders from `extra_model_paths.yaml`:\n\n- Portable and manual: copy `extra_model_paths.yaml.example` in the ComfyUI folder to `extra_model_paths.yaml` in the same folder and edit it.\n- Desktop keeps its own file, `extra_models_config.yaml`: add your lines to it, never replace what it wrote.\n\n`base_path` is the shared folder; each other line of the block below names a kind and its sub-folder. `is_default: true` makes these folders the first ones and the place downloads go. ComfyUI reads the file only at start: restart it after every change.\n\nA block of it looks like this:\n\n````\nmy_library:\n    base_path: D:/ai-models\n    checkpoints: checkpoints\n    loras: loras\n    vae: vae\n````',
      },
      share: {
        title: 'Decide, then share',
        body: 'You may not need a shared folder. With one install, keep the models in `ComfyUI/models`.',
        items: {
          decide: { label: 'I decided whether I need a shared folder, and wrote why.', how: 'Yes for two installs or another program that uses the same models; no for one install.' },
          copy: { label: 'I saved a copy of the YAML file before editing it.' },
          edit: { label: 'I added a block with base_path and the kinds I share.' },
          restart: { label: 'I restarted ComfyUI, and its log shows no error about the file.' },
        },
      },
      still: {
        title: 'The models are still found',
        body: 'Choose “Sync now” in the app. It checks that it read your ComfyUI and that models/checkpoints still lists a file after the change.',
      },
      manifest: {
        title: 'A manifest of the important files',
        body: 'A manifest is a short text file next to your models: for each important file its name, kind, size, where it came from and its hash. The hash is a fingerprint of the content: the same hash means the same file, whatever its name.\n\nTo get the SHA-256 hash:\n- Windows: `certutil -hashfile file.safetensors SHA256`\n- macOS: `shasum -a 256 file.safetensors`\n- Linux: `sha256sum file.safetensors`\n\nMany model pages show the SHA-256 too: compare them.',
        items: {
          file: { label: 'I made a manifest file next to my models.' },
          hash: { label: 'It holds the SHA-256 of the files I would hate to lose.' },
          source: { label: 'For each one I wrote the page it came from and its license.' },
        },
      },
      run: {
        title: 'Run from the library',
        body: `${SAVE}\n\nOr open your control workflow from the lesson before. If you moved its model into a sub-folder, choose the file again in the loader: the name now holds the sub-folder.`,
        items: {
          ran: { label: 'A workflow ran with a model from its new place, without “Value not in list”.', how: 'The log prints “Prompt executed in … seconds”.' },
        },
      },
      assess: {
        title: 'Is the library in order?',
        body: 'Answer for yourself. The app does not see your disk.',
        criteria: {
          found: {
            title: 'Every model appears in the list of its loader.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Find the file that is missing and check its kind on its page. Then the folder, then R in ComfyUI.',
          },
          copies: {
            title: 'Copies of the same model.',
            levels: { many: 'Many', few: 'A few', none: 'None' },
            tryNext: 'Compare the hashes of files that look alike. Keep one copy in a shared folder.',
          },
          manifest: {
            title: 'With the manifest I could rebuild the library on a new disk.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Add the source page of every file you could not download again from memory.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing.',
        questions: {
          'wrong-folder': {
            text: 'A LoRA lies in models/checkpoints. What happens?',
            choices: { error: 'ComfyUI shows an error', absent: 'Load LoRA does not list it', crash: 'ComfyUI stops' },
            explain: 'Each loader lists only its own folder. The file is not an error, only invisible to the loader of its kind.',
          },
          'after-yaml': {
            text: 'You changed extra_model_paths.yaml. What next?',
            choices: { nothing: 'Nothing: it works at once', refresh: 'Press R', restart: 'Restart ComfyUI' },
            explain: 'ComfyUI reads the file only when it starts.',
          },
          hash: {
            text: 'Two files have different names. How do you know they are the same model?',
            choices: { name: 'By the name', size: 'By the size', hash: 'By the hash' },
            explain: 'Names change and sizes may match by chance. The same hash means the same content.',
          },
        },
      },
      transfer: {
        title: 'On your own: a new kind of file',
        body: 'Add a model of another kind than a checkpoint (a LoRA, a VAE or an upscaler) without the lesson.',
        items: {
          'new-kind': { label: 'I put the file into the folder of its kind.' },
          listed: { label: 'Its loader lists it after R in ComfyUI and “Sync now” here.' },
          written: { label: 'I added it to the manifest with its hash, page and license.' },
        },
      },
    },
  },
  'first-pack': {
    title: 'The Manager: a first node pack, safely',
    result: 'A first node pack installed through the Manager, its source and version checked, the import log clean, and a run that uses its node.',
    roles: { card: 'note about the pack' },
    meta: {
      skill: 'Tell a node, a model, a dependency and a workflow apart, and install a node pack the safe way: source and version checked, the import log read, the version written down.',
      requires: ['A working ComfyUI (the lesson “Install and a first run without errors”).', 'The Manager turned on: it is in Desktop; Portable and manual installs need `--enable-manager`.'],
      mistakes: [
        {
          sign: 'The log shows the pack with “(IMPORT FAILED)”, and its nodes are missing.',
          fix: 'Read the lines above the list: they name the error, often a missing Python package or a too old ComfyUI. Update or remove the pack in the Manager; do not install packages by hand you do not understand.',
        },
        {
          sign: 'There is no Manager in the menu.',
          fix: 'In Portable and manual installs it is off by default: install `manager_requirements.txt` and start ComfyUI with `--enable-manager`, as the official Manager page says.',
        },
        {
          sign: 'You installed a pack from a link in a video, without looking at who made it.',
          fix: 'A pack runs code with all the rights of ComfyUI. Check the author, the repository and how many people use it, or remove the pack.',
        },
        {
          sign: 'You installed it and the nodes are not in the library.',
          fix: 'ComfyUI loads packs at start: restart it, refresh the browser page, and choose “Sync now” here.',
        },
      ],
      provenance: 'The Manager steps come from docs.comfy.org (Manager install, pack management, legacy interface) and the install guide for custom nodes, as of 2026-11-15. The pack is ComfyUI-Custom-Scripts by pythongosssss, MIT license, version 1.2.5 in the Registry on that date. It is an example: the method fits any pack.',
      notChecked: `${NOT_CHANGED} It checks that it read your ComfyUI, that a node of the pack is installed after a sync, and that your note is written on the canvas. It does not see the Manager, the log or the run: those are your own word.`,
    },
    steps: {
      intro: {
        title: 'A pack is a program',
        body: 'A node pack adds nodes ComfyUI does not have. It is a folder in `ComfyUI/custom_nodes` with Python code, and that code runs with all the rights of ComfyUI on your computer. So the first pack is a good place to learn the safe way, once.\n\nThe pack here is ComfyUI-Custom-Scripts by pythongosssss: widely used, with no extra Python packages. Its node Show Text 🐍 shows a text on the canvas.',
      },
      kinds: {
        title: 'Node, model, dependency, workflow',
        body: 'Four things people mix up:\n\n- a **node** is one block of a graph; ComfyUI has its own, and packs add more;\n- a **model** is a file of numbers in `models/…`, read by a loader node; it is not a pack;\n- a **dependency** is a Python package a pack needs; the Manager installs it with the pack;\n- a **workflow** is a graph saved as `.json` (or inside a picture); it names nodes and files but holds neither.\n\nA workflow that “needs a pack” needs its nodes; one that “needs a model” needs a file in a folder.',
      },
      ready: {
        title: 'Before you install',
        body: 'Make a way back first, in case the pack breaks the start.',
        items: {
          comfy: { label: 'ComfyUI is running, and the app has read it.', how: 'The app sees this after a sync.' },
          manager: { label: 'The Manager opens in ComfyUI.', how: 'Desktop has it. In Portable and manual installs it needs `--enable-manager`; the legacy interface has a “Manager” button in the top bar.' },
          backup: { label: 'I made a way back: a snapshot (Desktop: Manage ▸ Snapshots ▸ Create Snapshot; legacy Manager: Save snapshot), or I wrote down the list of my packs.' },
        },
      },
      find: {
        title: 'Find it and check the source',
        body: 'In the Manager search for “Custom-Scripts” (with the filter on node packs, where there is one) and open its card.',
        items: {
          search: { label: 'I found ComfyUI-Custom-Scripts by pythongosssss.' },
          source: { label: 'Its repository is github.com/pythongosssss/ComfyUI-Custom-Scripts, and many people use it.', how: 'The card links the repository; the number of installs or stars is on the card or the repository page.' },
          version: { label: 'I wrote down the version I am about to install.', how: 'The card shows it; the Manager may offer a “Version” to choose.' },
        },
      },
      install: {
        title: 'Install, restart, read the log',
        body: 'Press “Install”. ComfyUI loads packs only at start: restart it when the Manager asks, then refresh the browser page.\n\nIn the start log, find “Import times for custom nodes:”. Each pack has a line; a pack that failed has “(IMPORT FAILED)” after its name.',
        items: {
          install: { label: 'I pressed “Install” and waited for it to finish.' },
          restart: { label: 'I restarted ComfyUI and refreshed the page.' },
          log: { label: 'The line of ComfyUI-Custom-Scripts under “Import times for custom nodes:” has no “(IMPORT FAILED)”.' },
        },
      },
      installed: {
        title: 'The pack is loaded',
        body: 'Choose “Sync ▸ Sync now” in the app. It checks that a node of the pack (Show Text 🐍, Math Expression 🐍 or String Function 🐍) is now installed in your ComfyUI.',
      },
      record: {
        title: 'Write the pack down',
        body: 'Add a {card} node and write in its `value` the pack, its author and the version you installed, for example: `ComfyUI-Custom-Scripts by pythongosssss, 1.2.5, installed 2026-11-15`.\n\nThis note is also the input of the run below.',
      },
      run: {
        title: 'Run a node of the pack',
        body: `${SAVE}\n\nIn ComfyUI add Show Text 🐍 (or here: the library shows it after the sync), link the \`STRING\` output of the note to its text input, and press Run.`,
        items: {
          export: { label: 'I opened the workflow with the note in ComfyUI.' },
          link: { label: 'I linked the note to Show Text 🐍.' },
          ran: { label: 'I ran it, and the note appeared on Show Text 🐍.', how: 'The log prints “Prompt executed in … seconds”.' },
        },
      },
      assess: {
        title: 'Was it safe and clean?',
        body: 'Answer for yourself. The app does not see the Manager or the log.',
        criteria: {
          source: {
            title: 'I checked the author and the repository before I pressed Install.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'Open the pack\'s repository now: who wrote it, when it changed last, and what its issues say. Remove it if you would not install it after reading.',
          },
          log: {
            title: 'The import log of the pack.',
            levels: { failed: 'IMPORT FAILED', warnings: 'Warnings', clean: 'Clean' },
            tryNext: 'Read the error above the list of import times, then update the pack or ComfyUI, or remove the pack.',
          },
          record: {
            title: 'I wrote down the pack, its author and its version.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Add the missing part from the Manager\'s card: the version is what you need to go back.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Four short questions. A wrong answer costs nothing.',
        questions: {
          lora: {
            text: 'A file my-style.safetensors in models/loras is a…',
            choices: { node: 'node', model: 'model', pack: 'node pack' },
            explain: 'It is a model file, read by a LoRA loader. A pack is code in custom_nodes.',
          },
          code: {
            text: 'Does a node pack run code on your computer?',
            choices: { no: 'No, it only adds boxes', yes: 'Yes, with all the rights of ComfyUI' },
            explain: 'A pack is Python code that ComfyUI loads at start. Install packs from authors you trust.',
          },
          failed: {
            text: 'A pack shows “(IMPORT FAILED)” in the log. What does it mean?',
            choices: { 'missing-model': 'A model is missing', 'pack-not-loaded': 'The pack did not load, so its nodes are missing', slow: 'The pack is slow' },
            explain: 'The pack\'s code failed at start. The lines above the list name the cause.',
          },
          after: {
            text: 'What must follow an install?',
            choices: { nothing: 'Nothing', restart: 'A restart of ComfyUI' },
            explain: 'ComfyUI loads packs only when it starts.',
          },
        },
      },
      transfer: {
        title: 'On your own: the next pack',
        body: 'Next time a workflow needs a pack, use the same method without the lesson.',
        items: {
          need: { label: 'I named the nodes I need and the pack that brings them.' },
          check: { label: 'I checked its author, repository, version and recent issues.' },
          decide: { label: 'I installed it the same way and read the log, or decided not to, and wrote why.' },
        },
      },
    },
  },
  snapshots: {
    title: 'Snapshots, updates and the way back',
    result: 'An update made with a tested point to return to, the control workflow run before and after, and a written way back.',
    roles: { save: 'saver of the control workflow', card: 'environment card' },
    meta: {
      skill: 'Update ComfyUI so that you can go back: a snapshot kept outside the install, a control workflow run before and after, and a written rollback path.',
      requires: ['The control workflow and environment card of the lesson “Install and a first run without errors”.', 'At least one pack installed (the lesson “The Manager: a first node pack, safely”).'],
      mistakes: [
        {
          sign: 'After the update a pack shows “(IMPORT FAILED)”.',
          fix: 'Update that pack in the Manager first. If it still fails, restore the snapshot you made before, or set the pack back to its old version.',
        },
        {
          sign: 'You took the newest commits, and things broke.',
          fix: 'Commits between stable releases may be unstable. Go back to the stable channel (Desktop: Stable; Portable: update_comfyui_stable.bat; manual: the last release tag).',
        },
        {
          sign: 'You expected the snapshot to bring back your models and pictures.',
          fix: 'A snapshot records versions of ComfyUI, packs and Python packages. Models, workflows and outputs are files: back them up separately.',
        },
        {
          sign: 'You restored a Manager snapshot and nothing changed.',
          fix: 'A Manager restore takes effect at the next start of ComfyUI. Restart it and read the log.',
        },
      ],
      provenance: 'Snapshots and updates as docs.comfy.org describes them on 2026-11-15 (Desktop: manage installations; updating ComfyUI; the Manager legacy interface) and the ComfyUI README on releases. The control workflow is your own from the earlier lesson.',
      notChecked: `${NOT_CHANGED} It checks the control workflow on the canvas, that every node of it is installed before and after the update, and that it read your ComfyUI again. It does not see snapshots, versions or pictures: the snapshot, the update, both runs and the comparison are your own word.`,
    },
    steps: {
      intro: {
        title: 'An update you can undo',
        body: 'ComfyUI makes a release every week or two, and packs change too. Most updates go well. The one that does not breaks a workflow you need on the day you need it.\n\nIn this lesson you make the update reversible: you run a control workflow, make a snapshot and keep it outside the install, update, run the control workflow again, and write how you would go back.',
      },
      what: {
        title: 'What a snapshot holds',
        body: 'A snapshot records the state of an install: the version of ComfyUI, the packs and their versions, the Python packages. It does not hold models, workflows or pictures.\n\n- **Desktop**: the Manage panel of an install, tab “Snapshots”: “Create Snapshot”, “Export”, “Import”. Desktop also makes a snapshot itself before every update.\n- **Manager, legacy interface**: “Save snapshot”, and “Restore”, which takes effect at the next start.\n- **Manual install**: Git knows the version; `git log --oneline -1` shows the commit you are on.\n\nWhat you see in the menus may differ by version: look for the tab or button with “snapshot” in its name.',
      },
      control: {
        title: 'The control workflow',
        body: 'Open your known good workflow from the lesson “Install and a first run without errors” (the picture, or its saved file), with {save} at its end and the {card} on it. Write in its `value` the run time you will compare.\n\nIf you do not have it, open any small picture workflow that ran well, and add the card.',
      },
      complete: {
        title: 'Every node is installed now',
        body: 'Before the update, the app checks that every node of the control workflow is installed in your ComfyUI.',
      },
      before: {
        title: 'Before the update',
        body: `${SAVE}\n\nThen make the way back.`,
        items: {
          baseline: { label: 'I ran the control workflow and kept its picture and time.', how: 'The log prints “Prompt executed in … seconds”.' },
          version: { label: 'I wrote the version from the line “ComfyUI version:” onto the card.' },
          snapshot: { label: 'I made a snapshot (Desktop: Create Snapshot; legacy Manager: Save snapshot; manual: I wrote down the commit).' },
          export: { label: 'I keep a copy of the snapshot outside the ComfyUI folder.', how: 'Desktop: “Export”. Otherwise copy the snapshot file or the commit line to another place.' },
        },
      },
      update: {
        title: 'Update',
        body: 'Update the way of your install:\n\n- Desktop: the Manage panel, tab “Update”. “Stable” is the default; “Latest on GitHub” takes newer, less tested commits.\n- Portable: `update/update_comfyui_stable.bat`. Leave `update_comfyui_and_python_dependencies.bat` for a broken environment.\n- Manual: in the ComfyUI folder `git pull`, then `pip install -r requirements.txt` in its environment.\n\nThen update the packs in the Manager, one at a time if you can.',
        items: {
          channel: { label: 'I chose the stable channel, or wrote why I take newer commits.' },
          update: { label: 'I updated and started ComfyUI again.' },
          log: { label: 'I read the new “ComfyUI version:” line and the import list of the packs.' },
        },
      },
      'after-read': {
        title: 'Read it again',
        body: 'Choose “Sync now” in the app. It checks that it read your updated ComfyUI and that every node of the control workflow is still installed.',
      },
      after: {
        title: 'The same workflow, after',
        body: 'Run the control workflow again with the same seed and compare.',
        items: {
          ran: { label: 'I ran the control workflow after the update.', how: 'The log prints “Prompt executed in … seconds”.' },
          compare: { label: 'I compared the new picture and time with the ones from before.' },
        },
      },
      rollback: {
        title: 'The way back',
        body: 'Write the way back before you need it:\n\n- Desktop: restore the snapshot from the “Snapshots” tab, or go back to “Stable” if you were ahead of it. “Copy & Update” updates a copy and leaves the original alone: a safe way to try an update first.\n- Manager: open the snapshot, “Restore”, then restart ComfyUI.\n- Manual: `git checkout` the commit you wrote down, then `pip install -r requirements.txt`.\n- One pack: choose its old version in the Manager.\n\nModels, workflows and outputs are not in a snapshot: keep their copies yourself.',
      },
      plan: {
        title: 'Your rollback path',
        body: 'Write it where you will find it on a bad day.',
        items: {
          write: { label: 'I wrote the steps back for my way of install, with the name of my snapshot or my commit.' },
          where: { label: 'I know where the exported snapshot lies, outside the ComfyUI folder.' },
          drill: { label: 'I tried the way back on a copy (Desktop: Copy & Update) or on a spare install.' },
        },
      },
      assess: {
        title: 'Is the update reversible?',
        body: 'Answer for yourself. The app does not see the snapshot or the pictures.',
        criteria: {
          same: {
            title: 'The control workflow gave the same picture after the update.',
            levels: { no: 'No', partly: 'Nearly', yes: 'Yes' },
            tryNext: 'Tiny differences can come from new code for the graphics card. A different layout means something changed: read the release notes, or go back.',
          },
          changed: {
            title: 'I can say what changed: the version of ComfyUI and of each pack.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Desktop shows the version change on each snapshot; elsewhere compare the “ComfyUI version:” lines and the Manager\'s versions.',
          },
          path: {
            title: 'My way back.',
            levels: { no: 'None', written: 'Written', tried: 'Written and tried' },
            tryNext: 'Write the three or four steps back for your way of install with the name of the snapshot.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing.',
        questions: {
          holds: {
            text: 'What does a snapshot hold?',
            choices: { models: 'The models', versions: 'The versions of ComfyUI, packs and Python packages', pictures: 'The pictures you made' },
            explain: 'A snapshot is a record of versions. Files such as models and pictures need their own copies.',
          },
          when: {
            text: 'When do you make a snapshot?',
            choices: { before: 'Before the update', after: 'After the update', broken: 'When something breaks' },
            explain: 'A snapshot taken after the change records the broken state.',
          },
          restore: {
            text: 'You press Restore in the Manager. When does it work?',
            choices: { 'at-once': 'At once', 'next-start': 'At the next start of ComfyUI' },
            explain: 'The Manager applies a restore when ComfyUI starts next time.',
          },
        },
      },
      transfer: {
        title: 'On your own: one pack',
        body: 'Next time a single pack offers an update, do it with the same method, without the lesson.',
        items: {
          'one-pack': { label: 'I chose one pack to update and wrote its current version.' },
          'same-method': { label: 'Snapshot, update, restart, read the log, run the control workflow.' },
          result: { label: 'I kept the update or went back, and wrote which and why.' },
        },
      },
    },
  },
};
