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
};
