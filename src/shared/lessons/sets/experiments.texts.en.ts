/**
 * The English words of the group "Experiments and quality" (experiments.ts): a controlled experiment and a blind
 * comparison by a rubric. The Russian words are in experiments.texts.ru.ts under the same ids.
 *
 * These lessons say plainly where the app stops: it checks the graph on the canvas and reads what it already knows of
 * ComfyUI; the run in ComfyUI and the judgement of the pictures are the person's, and the panel marks them so.
 */
import type { LessonWords } from '../texts';

const RUN = 'Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. The app runs nothing in ComfyUI itself.';

export const EXPERIMENTS_EN: Record<string, LessonWords> = {
  'one-factor': {
    title: 'A controlled experiment: one change at a time',
    result: 'Two pictures that differ in one setting only, a repeat that gives the same pictures, and a conclusion you can defend.',
    roles: {
      sampler: 'variant A',
      decode: 'decoder of variant A',
      save: 'saver of variant A',
      samplerB: 'variant B',
      decodeB: 'decoder of variant B',
      saveB: 'saver of variant B',
      samplerC: 'variant C',
      decodeC: 'decoder of variant C',
      saveC: 'saver of variant C',
    },
    meta: {
      skill: 'Change exactly one setting between two runs and say what that setting did, with a repeat that confirms it.',
      requires: ['A ComfyUI you can run, with one picture model in models/checkpoints.', 'The lesson “A first picture from text”, or the same graph built by hand.'],
      mistakes: [
        {
          sign: 'The two pictures differ in their whole layout, not only in how strictly they follow the prompt.',
          fix: 'The seeds differ. Look at `seed` of both samplers: the numbers must be the same. Set `control_after_generate` to `fixed` on both.',
        },
        {
          sign: 'The second run ends at once and the pictures do not change.',
          fix: 'That is ComfyUI reusing its results, not a repeat. Restart ComfyUI and run the same workflow again.',
        },
        {
          sign: 'You changed cfg and the prompt in the same run.',
          fix: 'Go back to one change. Put the prompt back, compare cfg first, then compare the prompt on its own.',
        },
        {
          sign: 'One variant is saved over the other, or you cannot tell the files apart.',
          fix: 'Give the two savers different `filename_prefix` values, such as `experiment/a` and `experiment/b`.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes as the official documentation describes them (KSampler, Save Image). No model, picture or prompt comes with the lesson: you use your own. Mind the license of the model you choose.',
      notChecked: 'The app checks the graph on the canvas and what it already reads of your ComfyUI. It does not run the workflow, does not see the pictures and does not judge them: the run and the assessment are your own word.',
    },
    steps: {
      intro: {
        title: 'Why one change at a time',
        body: 'One good picture proves little: the same settings with another seed may give a worse one. To learn what a setting does, keep everything else the same and change only that setting.\n\nIn this lesson you build two variants of one picture in one graph. They share the model, the prompt, the blank and the seed. They differ only in `cfg`, how strictly the model follows the prompt. Then you run the graph in ComfyUI, repeat it, and decide what cfg did.\n\nThe app checks the graph. The run and the judgement are yours, and the lesson says so at the end.',
      },
      ready: {
        title: 'Before you start',
        body: 'Three things before the graph. Two of them the app can see for itself; the third only you know.',
        items: {
          comfy: { label: 'ComfyUI is running, and the app has read it.', how: 'The app sees this when it has read your ComfyUI (Sync).' },
          model: { label: 'There is a picture model in models/checkpoints.', how: 'The app sees this in the list of models of the last sync.' },
          question: { label: 'I wrote down the question of the experiment, for example: "Does cfg 4 or 8 suit this prompt better?"', how: 'One sentence on paper or in a note. A question written before the run keeps you honest.' },
        },
      },
      graph: {
        title: 'The first variant',
        body: 'Build the picture graph of the first lesson, or keep it if it is on the canvas: {checkpoint}, two {positive} nodes for the prompt and the negative prompt, {latent}, {sampler}, {decode} and {save}.\n\nChoose a picture model in `ckpt_name` and write a prompt of a few words in the `text` field of the prompt node. Keep the prompt plain: the experiment is about cfg, not about the prompt.',
      },
      seed: {
        title: 'The seed decides the noise',
        body: 'A sampler starts from noise, and `seed` decides which noise. The same seed with the same settings gives the same picture.\n\nUnder `seed` stands `control_after_generate`. With `randomize` ComfyUI picks a new seed after every run, so the next run starts from other noise. For an experiment set it to `fixed`.\n\nTwo samplers with the same seed start from the same noise. Then the only thing that differs between them is what you change on purpose.',
      },
      second: {
        title: 'The second variant',
        body: 'Add {samplerB}, {decodeB} and {saveB}. Feed {samplerB} from the same places as the first: the model of {checkpoint}, the same {positive} and negative prompt, the same {latent}. Its picture goes through {decodeB} into {saveB}.\n\nNothing is new here: it is the first variant once more, side by side.',
      },
      factor: {
        title: 'One difference: cfg',
        body: 'Set `cfg` of {sampler} to 4 and `cfg` of {samplerB} to 8.\n\nEverything else of {samplerB} stays as in {sampler}: `seed`, `steps`, `sampler_name`, `scheduler` and `denoise`. If you changed one of them, set it back.\n\nNow the two variants differ in one setting only. Whatever differs in the pictures comes from cfg.',
      },
      names: {
        title: 'Names that tell the variants apart',
        body: 'Give {saveB} another `filename_prefix` than {save}, for example `experiment/a` for the first and `experiment/b` for the second. A slash puts the files into a folder of that name inside the output folder of ComfyUI.\n\nWrite down which name is which cfg. Later you will need it.',
      },
      complete: {
        title: 'Every node is in your ComfyUI',
        body: 'Before the graph goes to ComfyUI, the app checks that every node on the canvas is installed there. A missing node would stop the run.',
      },
      run: {
        title: 'Run it, then repeat it',
        body: `${RUN}\n\nComfyUI reuses results: a second run with nothing changed ends at once and shows the same pictures. That is not a repeat. For a real one, restart ComfyUI and run the same workflow again.\n\nTick what you did. The app cannot see ComfyUI run, so these ticks are your own word.`,
        items: {
          export: { label: 'I saved the workflow for ComfyUI and opened it there.' },
          ran: { label: 'I ran it, and both pictures appeared.', how: 'Two new files in the output folder of ComfyUI, under the two names you gave.' },
          fixed: { label: 'Both samplers have `control_after_generate` set to `fixed`.', how: 'Look under `seed` on both KSampler nodes in ComfyUI.' },
          repeat: { label: 'I restarted ComfyUI, ran the workflow again, and compared the new pictures with the first ones.', how: 'Open the old and the new picture of one variant side by side.' },
        },
      },
      assess: {
        title: 'What did cfg do?',
        body: 'Look at the two pictures and answer for yourself. The app does not see the pictures and does not judge them: nothing is sent anywhere, and your answers stay on this computer.',
        criteria: {
          difference: {
            title: 'The pictures share their layout and differ in how strictly they follow the prompt.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'If the layout differs too, the seeds were not the same. Check `seed` of both samplers, set them equal and run again.',
          },
          repeat: {
            title: 'The repeat after a restart gave the same pictures.',
            levels: { no: 'No', nearly: 'Nearly', yes: 'Yes' },
            tryNext: 'Tiny differences can come from the graphics card and are normal. Large ones mean something changed: the seed, a setting or the model file.',
          },
          conclusion: {
            title: 'I can say in one sentence which cfg suits this prompt and why.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Try a third run with cfg 6 between them, or another prompt with the same two values. One pair of pictures may not be enough.',
          },
        },
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          'two-changes': {
            text: 'You changed cfg and the seed at the same time, and the picture got better. What does that show?',
            choices: { cfg: 'cfg helped', seed: 'The seed helped', unknown: 'Nothing certain about either' },
            explain: 'Two changes at once cannot be told apart. Either one, or both together, may have done it.',
          },
          'same-seed': {
            text: 'Why do both samplers get the same seed?',
            choices: { faster: 'So that the run is faster', 'same-noise': 'So that both start from the same noise', required: 'ComfyUI requires it' },
            explain: 'The seed decides the starting noise. With the same noise, the only difference left is the one you made.',
          },
          cache: {
            text: 'You press Run again without changing anything. What happens?',
            choices: { new: 'ComfyUI makes the pictures anew', cached: 'ComfyUI ends at once and shows what it already made', error: 'ComfyUI shows an error' },
            explain: 'ComfyUI remembers results and works out only what changed. A real repeat needs a restart of ComfyUI.',
          },
        },
      },
      transfer: {
        title: 'On your own: another setting',
        body: 'Now use the method without help. Add a third variant, C, beside the two. Let it differ from {sampler} in one other setting: the sampler algorithm, `sampler_name`. Everything else stays as in {sampler}: `seed`, `steps`, `cfg`, `scheduler` and `denoise`.\n\nThe app checks the graph when you are done, but it offers no "Do this for me" here. Then run it in ComfyUI and compare variant A with variant C.',
      },
    },
  },
  'blind-compare': {
    title: 'A quality rubric and a blind comparison',
    result: 'Criteria written before the run, two variants scored without knowing which is which, and a choice with its cost.',
    roles: {
      sampler: 'variant A',
      decode: 'decoder of variant A',
      save: 'saver of variant A',
      samplerB: 'variant B',
      decodeB: 'decoder of variant B',
      saveB: 'saver of variant B',
    },
    meta: {
      skill: 'Choose between two variants by criteria written in advance, scored without knowing which variant is which.',
      requires: ['The lesson “A controlled experiment: one change at a time”.', 'Someone who can rename two files for you, or ten quiet minutes to do it yourself.'],
      mistakes: [
        {
          sign: 'You wrote the criteria after looking at the pictures.',
          fix: 'Criteria written afterwards tend to describe the picture you already like. Next time write them first; this time say so in your notes.',
        },
        {
          sign: 'You know which file is which while you score.',
          fix: 'The names gave it away. Copy the files, give the copies neutral names (x and y), and keep the key where you do not see it.',
        },
        {
          sign: 'You opened a copy in ComfyUI and saw its settings.',
          fix: 'A picture saved by Save Image carries its workflow. Score in an image viewer, not in ComfyUI, and open the workflow only after the scores are written.',
        },
        {
          sign: 'The two variants score the same and you pick by taste.',
          fix: 'Then the cheaper one wins: fewer seconds per picture, less memory. Note the time ComfyUI reports for each run.',
        },
      ],
      provenance: 'Built on ComfyUI\'s own nodes as the official documentation describes them. No picture or prompt comes with the lesson. The rubric is a starting point: change its criteria to fit your task.',
      notChecked: 'The app checks the graph on the canvas and can see that a workflow was opened from a picture. It does not run anything, does not see your pictures and does not score them: the run, the blinding and every score are your own word.',
    },
    steps: {
      intro: {
        title: 'Pretty is not the same as right',
        body: 'A picture can be pretty and still miss the task. To choose well, decide what "good" means before you look, and score the variants without knowing which is which. Otherwise the variant you expect to win tends to win.\n\nIn this lesson you write criteria first, save two variants under names that hide them, score them blind, and only then open the key.',
      },
      criteria: {
        title: 'Criteria before the run',
        body: 'Write these down before you run anything.',
        items: {
          task: { label: 'I wrote the task in one sentence: what the picture is for.', how: 'For example: "a cover for a story about a lighthouse, readable at a small size".' },
          criteria: { label: 'I wrote two to four criteria, each with what "no", "partly" and "yes" look like.', how: 'This lesson offers four below; replace them with yours where they do not fit.' },
          cost: { label: 'I will note the time of each run.', how: 'ComfyUI prints "Prompt executed in … seconds" for every run in its window or log.' },
        },
      },
      graph: {
        title: 'The first variant',
        body: 'Keep the graph of the lesson before, or build it: {checkpoint}, the prompt and the negative prompt in {positive} nodes, {latent}, {sampler}, {decode} and {save}. The model is chosen in `ckpt_name`, the prompt is written in `text`.',
      },
      second: {
        title: 'The second variant',
        body: 'Keep {samplerB} with {decodeB} and {saveB}, fed from the same model, prompts and blank. It keeps the same `seed`, `steps`, `sampler_name`, `scheduler` and `denoise` as {sampler}. Its `cfg` may differ: that is the difference you compare.',
      },
      'blind-names': {
        title: 'Names that hide the variants',
        body: 'Give both savers a `filename_prefix` in one folder, with names that do not say what they are: `blind/x` for {save} and `blind/y` for {saveB}. Not "cfg8", not "good".\n\nWrite on paper which letter is which variant, and put the paper away.',
      },
      shuffle: {
        title: 'How to score blind',
        body: 'After the run, copy the two pictures from the output folder of ComfyUI into a new folder. Ask someone to rename the copies to 1 and 2 and keep the key. Alone, rename them yourself without looking, for example by sorting by size.\n\nScore in an image viewer. Do not open the copies in ComfyUI: a picture saved by Save Image carries its whole workflow, settings included.',
      },
      run: {
        title: 'Run and hide',
        body: `${RUN}\n\nTick what you did. The app cannot see ComfyUI run, so these ticks are your own word.`,
        items: {
          ran: { label: 'I ran the workflow, and both pictures appeared.', how: 'Two new files in the folder blind inside the output folder of ComfyUI.' },
          shuffled: { label: 'The copies have neutral names, and I do not know which is which.' },
          time: { label: 'I noted the time ComfyUI reported for the run.', how: 'The line "Prompt executed in … seconds" in the window or log of ComfyUI.' },
        },
      },
      score: {
        title: 'Score each picture',
        body: 'Score the picture you like more by these criteria, still without the key. The app records your choice and nothing else: no picture is sent anywhere, and the app does not judge the picture itself.',
        criteria: {
          subject: {
            title: 'The subject matches the prompt.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Make the subject the first words of the prompt, and take out what is secondary.',
          },
          defects: {
            title: 'Defects: hands, faces, text, edges.',
            levels: { many: 'Many', few: 'A few', none: 'None' },
            tryNext: 'Check the size of the blank against the size the model was trained at, and try another seed before you change the model.',
          },
          task: {
            title: 'It fits the task you wrote down.',
            levels: { no: 'No', partly: 'Partly', yes: 'Yes' },
            tryNext: 'Read your task sentence again. If the picture is good but off task, the prompt describes something else: rewrite it from the task.',
          },
          blind: {
            title: 'I scored before I looked at the key.',
            levels: { no: 'No', yes: 'Yes' },
            tryNext: 'The comparison is only fair blind. Ask someone to rename the copies again and score once more.',
          },
        },
      },
      picture: {
        title: 'What a picture carries',
        body: 'Now open the key, then open one of the two pictures in this app: "File ▸ Open workflow…" and choose the picture. The app reads the workflow saved inside it, so you see for yourself why scoring happens outside ComfyUI.\n\nThe app checks that the last file it opened was a picture with a workflow.',
      },
      recall: {
        title: 'Check yourself',
        body: 'Three short questions. A wrong answer costs nothing: read the explanation and go on.',
        questions: {
          before: {
            text: 'When do you write the criteria?',
            choices: { before: 'Before the run', after: 'After seeing the pictures', any: 'It does not matter' },
            explain: 'Criteria written after looking tend to describe the picture you already like.',
          },
          'why-blind': {
            text: 'What does scoring blind protect you from?',
            choices: { speed: 'A slow comparison', bias: 'Favoring the variant you expect to win', rules: 'Breaking the license of the model' },
            explain: 'Knowing which variant is which pulls the scores towards what you expect.',
          },
          tie: {
            text: 'Both variants score the same. Which do you choose?',
            choices: { prettier: 'The one I like more', cheaper: 'The one that costs less time and memory', random: 'Toss a coin' },
            explain: 'With equal quality, cost decides: a faster setting gives you more tries in the same time.',
          },
        },
      },
      transfer: {
        title: 'On your own: two models',
        body: 'Use the method on a new question without help: which of two of your picture models suits your task better. The app gives no ready answer here.',
        items: {
          pair: { label: 'I chose two picture models I have and one task.' },
          three: { label: 'I ran both on three different prompts with the same seed, and scored them blind by my criteria.' },
          table: { label: 'I wrote a small table: the scores, the time of each run, and my choice with one sentence why.' },
        },
      },
    },
  },
};
