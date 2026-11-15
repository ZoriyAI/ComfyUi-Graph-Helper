[Русский](Writing-A-Lesson.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Writing a lesson

A lesson is a list of steps, each one described as **what must be on the canvas** after it. The app reads the canvas
to know where the person is, so a lesson never keeps its own state: delete a node and the lesson goes back to its
step. How lessons look to a person: [How lessons work](../lessons/How-Lessons-Work.md). This page is about a built-in
lesson in the code; a person makes their own in the app, and it travels as a lesson file:
[The lesson file format](../lessons/Lesson-File-Format.md).

## Where things are

| What | Where |
| --- | --- |
| The steps | `src/shared/lessons/lessons.ts` (and `src/shared/lessons/sets/` for groups of lessons, such as the picture model families or video). |
| The words | `src/shared/lessons/texts.en.ts`, `texts.ru.ts` (and `sets/*.texts.*.ts`), under the same lesson and step ids. |
| Why a value | `src/shared/lessons/reasons.en.ts`, `reasons.ru.ts`: one sentence per rule. |
| Which file | `src/shared/lessons/files.ts` (the kinds of model file, `FILES`), `fileTables.ts` (the tables of the later sets and the same-family pairs). |
| The rules every lesson must follow | `src/shared/lessons/schema.ts` (`lessonProblems`). |
| Checking the canvas | `src/shared/lessons/engine.ts`, `fit.ts` (does this ComfyUI have what the lesson needs), `flow.ts`. |
| Lesson files | `src/shared/lessons/share/` (`format.ts` reads and checks a file, `mine.ts` My lessons, `authoring.ts` the editor, `tryLesson.ts` the empty-canvas try). |
| The panel | `src/renderer/components/lessons/LessonPanel.tsx`, `MyLessons.tsx`, `LessonEditor.tsx`. |
| The steps a person answers | `src/shared/lessons/steps.ts` (checklist, rubric, quiz, read-check, outcomes); the panel draws them in `src/renderer/components/lessons/PersonStep.tsx`. |
| Level, tracks, priority | `src/shared/lessons/programme.ts` (`LESSON_PROGRAMME`); the views by level, by track and the path in `navigation.ts` and `LessonViews.tsx`. |
| The writer's check | `node scripts/lesson-lint.js` (`src/shared/lessons/share/lint.ts`). |
| The example to copy | `src/shared/lessons/sets/experiments.ts` and its `experiments.texts.*.ts`: the lessons `one-factor` and `blind-compare`. |
| The wiki page | `docs/wiki/lessons/<Name>.md` and `.ru.md`, with the comment `<!-- lesson: <id> -->`. |

## A step

```ts
{ id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] }
```

- `read: true`: a step that only explains; the person reads it and goes on. Put the knowledge here and keep the doing
  steps short. A step to read asks for nothing; a step that asks for nothing must be a step to read.
- `roles`: nodes that must be on the canvas, each with a role name and the classes that count.
- `links`: `link(from, output, to, input, via?)`; `via` lists nodes that may stand in between (a LoRA loader).
- `fields`: `field(role, name, test)`. The tests (`FieldTest` in `src/shared/lessons/engine.ts`): `chosen`, `equals`,
  `between` (with `prefer`, the value Do this for me sets; `frames` for Wan's 4n + 1), `text` (a minimum length and
  real words, marks it must hold, Latin letters, no "no hat"), `weighted` (a prompt weight in a range), `file` (a
  model file of a kind), `sameFamily` (a LoRA or ControlNet of the checkpoint's family), `size` and `aspect` (the
  size a model was trained at), `less`, `same` and `differs` (against another field), and `has-trigger` (the trigger
  words of a chosen LoRA).
- `why`: the id of a sentence in `reasons.*.ts`. "Still to do" shows it when the value is wrong, so a person learns
  why the step wants this value, not only that it is wrong.

Use ComfyUI's own class names and port names. A lesson whose classes or inputs the person's ComfyUI does not have says
"This lesson does not fit your ComfyUI yet" with its reasons, instead of giving wrong instructions.

## Steps a person answers
The app never runs a workflow and never sees a picture. What happens in ComfyUI is either something the app already
reads, or the person's own word, and the step says which. Four kinds (`src/shared/lessons/steps.ts`), one per step:

```ts
{ id: 'ready', checklist: [{ id: 'comfy', check: { kind: 'comfy-read' } }, { id: 'question' }] },
{ id: 'run', checklist: [{ id: 'ran', run: true }, { id: 'repeat', run: true }] },
{ id: 'complete', readCheck: [{ kind: 'workflow-complete' }] },
{ id: 'assess', rubric: [{ id: 'difference', levels: ['no', 'partly', 'yes'] }, { id: 'blind', levels: ['no', 'yes'], pass: 'yes' }] },
{ id: 'recall', quiz: [{ id: 'cache', choices: ['new', 'cached', 'error'], answer: 'cached' }] },
{ id: 'transfer', transfer: true, roles: [...], links: [...], fields: [...] },
```

- `checklist`: things done outside the app. An item with `check` is ticked by the app while the check holds; while the
  app cannot tell, the person's tick counts as their own word; while it fails, a tick does not count. `run: true` marks
  the evidence of a run. `optional: true` items never hold the step.
- `readCheck`: conditions the app checks from what it already reads, never by a request of its own: `comfy-read`,
  `node-class`, `model-file`, `workflow-complete`, `workflow-size`, `workflow-from` (`picture` or `api`),
  `workflow-partner`. The ComfyUI version is not one: sync does not keep it, so a lesson asks for it as a checklist item.
  While the app cannot tell, the person may press **I checked it myself**.
- `rubric`: two to four levels per criterion, low to high; `pass` (optional) is the lowest level that lets the person go
  on. The rubric records a choice; the app never judges the picture.
- `quiz`: one to five questions; any answer moves the lesson on, and the explanation shows.
- `transfer: true` on a canvas step or a checklist: no **Do this for me**, and "Still to do" stays folded.

Their words live beside the step's title and body: `items` (`label`, `how`), `criteria` (`title`, `levels`, `tryNext`)
and `questions` (`text`, `choices`, `explain`). The engine is cumulative: a canvas step after another never contradicts
it (the transfer task of `one-factor` adds a third sampler instead of changing the second).

## Outcomes
`outcomes: ['structure', 'run', 'result']` says what a lesson ends with: the graph checked by the app, a run in ComfyUI
(the item with `run: true`; the app's own check where one exists), a result assessed against the rubric (always the
person's word). A lesson without `outcomes` has only `structure` and looks as in version 1.0. The end of a lesson and
its card say which outcome the app checked and which is the person's word.

## Level, tracks and priority
Every built-in lesson has an entry in `LESSON_PROGRAMME` (`programme.ts`): `level` 0 to 5 (0 setting up ComfyUI, 1 graph
basics, 2 reliable practice, 3 pictures, video, sound and 3D, 4 technical tracks, 5 projects), one or more `tracks`
(`base`, `image`, `video`, `audio-3d`, `lora`, `api`, `nodes`, `projects`) and a `priority` (`core`, `pro`, `deep`). A
lesson never stands below a lesson it leans on (a test holds it). `meta.prerequisites` adds an edge to the path of a
track; `LESSON_AFTER` still says whose graph a lesson starts from.

## The template of standard 2
A lesson with `standard: 2` must have (`lessonStandardProblems` in `schema.ts`):

| Part of the template | Where |
| --- | --- |
| One target skill | `meta.skill` in the words of each language |
| Prerequisites | `meta.prerequisites` (lesson ids) or `meta.requires` (plain requirements) |
| Versions and date | `meta.versions` and `meta.checkedOn` (YYYY-MM-DD) in the lesson |
| At least three expected mistakes | `meta.mistakes`: `sign` (how to recognize it) and `fix` (what to do) |
| Run, result, rubric | a checklist item with `run: true`, a `rubric`, `outcomes` |
| What the app does not check | `meta.notChecked` |
| Transfer | a step with `transfer: true` |
| Retrieval | a `quiz` |
| Provenance and license | `meta.provenance` |

Lessons of standard 1 are not forced; `node scripts/lesson-lint.js --all` lists what each one lacks.

## Check a lesson: lesson-lint
`node scripts/lesson-lint.js` lints the built-in lessons of standard 2; give lesson ids or `.lesson.json` paths to lint
those, `--all` for every built-in lesson, `--strict` to fail on a missing part as well. It prints every rule a lesson
breaks, every word a checklist item, criterion or question lacks, a step that cannot be done from an empty canvas, and
what the template still asks for, one plain sentence each.

## A worked example
`one-factor` (`sets/experiments.ts`) is the lesson to copy. It opens with a step to read; a checklist where two items
are checked by the app (`comfy-read`, `model-file`) and one is the person's word; the canvas steps of two variants that
differ only in `cfg` (`same` rules on every other setting of the second sampler, `between` with `prefer` and a `why` on
each cfg); a read-check that every node is installed; a run checklist with `run: true`; a rubric with `tryNext` words;
a quiz; and a transfer task on the canvas. `blind-compare` continues its graph and adds a rubric criterion with `pass`,
a `workflow-from` read-check and a transfer task as a checklist. Every ComfyUI fact in them is named in the header
comment of `experiments.ts` with where it was confirmed.

## Recipe: writing lesson N..
1. Read the lesson's row in the programme (goal, practice, measurable result, priority) and decide its one skill.
2. Confirm every ComfyUI fact you will state in the app's knowledge (`src/shared/knowledge/`) or the official
   documentation; what cannot be confirmed is worded so the lesson does not depend on it.
3. Write the steps in a set file (`src/shared/lessons/sets/<set>.ts`): canvas steps where the graph can show the skill,
   a checklist for what happens in ComfyUI (mark the run item `run: true`), a `readCheck` where the app can read the
   fact, a rubric for the result, a quiz, a transfer task. Set `standard: 2`, `outcomes` and `meta`.
4. Write the words in `<set>.texts.en.ts` and `.ru.ts` under the same ids, with `meta` (skill, requires, at least three
   mistakes, provenance, notChecked) and the words of every item, criterion and question. A reason for every number
   (`reasons.*.ts`) and a role label (`lessons.role` in the catalog) for every new role.
5. Register the set in `lessons.ts` (`LESSONS` before the lessons for adults, `LESSON_PATH`, `LESSON_AFTER`), its words in
   `texts.en.ts` and `texts.ru.ts`, and its place in `programme.ts`.
6. Write the wiki pages `docs/wiki/lessons/<Name>.md` and `.ru.md` with `<!-- lesson: <id> -->`, and list them in the
   lessons index.
7. Run `node scripts/lesson-lint.js <id>`, then `npm run type-check` and the lesson tests
   (`tests/unit/lesson*.test.ts`, `lessons.*.test.ts`, `wiki.test.ts` with `WIKI_STRICT=1`, `screenText.test.ts`).

## Which model file

A step that only asked "is something chosen" counted the first file of the list, whatever it was. So a field that
takes a model file names the kind it wants:

- `FILES` in `files.ts`: a kind with the families it may be of (or not), the marks its name must hold (`high`,
  `i2v`, `umt5`) and must not, the folder under `models`, and an example name. A file is judged by the family its
  metadata names, else by its name; a file whose family nothing tells is held only to the marks.
- A set may give its kinds as a table of words instead (`FileRow`: `has`, `any`, `not`): `VIDEO_FILE_KINDS` in
  `sets/video.ts` and `SET_FILE_KINDS` in `fileTables.ts`. `withFileTable` puts each row into its lesson.
- `FAMILY_PAIRS` in `fileTables.ts` holds a LoRA or a ControlNet to the family of the checkpoint it works with;
  `withFamilyPairs` puts the rule in place.
- A wrong file is told in the person's words: each kind has a sentence `lessons.fileKind.<kind>` in the catalog.

## The words

For each lesson: `title`, `result` (one line: what the person ends up with) and, for every step id, a short `title`
and a `body` (a small markdown: paragraphs, a list, `code`). Write `{role}` to name a node of the lesson: the app
puts in the node's name as this ComfyUI's library shows it. Plain words, the action first, the menu named as the
menu names it. A word of the glossary is underlined with dots where it first appears, so you need not explain it in
place.

## Order

- `LESSONS` is the order a person meets them, in groups (`LESSON_PATH`).
- `LESSON_AFTER` says which lesson's graph a lesson stands on (shown in the list, not enforced).
- The lessons for adults (`ADULT_LESSONS`) stay behind Settings ▸ Privacy ▸ Adult content (18+) as one closed row.

## Tests

- `tests/unit/lessonSchema.test.ts` runs `lessonProblems` over every lesson: ids, steps, roles before use, a reason
  for every `why`, file kinds the app knows.
- `tests/unit/lessons.test.ts` and `lessons.<set>.test.ts` walk every lesson from an empty canvas to the end by doing
  what it says, check that every explaining step is shown once, and that the place in a lesson is read off the graph
  (a deleted node sends it back).
- `tests/unit/lessonFit.test.ts` checks when a lesson fits a ComfyUI and when it does not; `lessonImageFiles.test.ts`
  and `lessonModel.test.ts` the file kinds.
- `tests/unit/lessonFiles.*.test.ts` read, check, store, export and import lesson files.
- `tests/unit/wiki.test.ts` checks that every lesson id has a wiki page marked `<!-- lesson: <id> -->` in both
  languages.
- `tests/e2e/lessons.test.ts` goes through a lesson in the window.
- `tests/unit/lessonSteps.test.ts` covers the steps a person answers and the outcomes; `lessonProgramme.test.ts` the
  levels, tracks and paths; `lessonFiles.v2.test.ts` version 2 of the file; `lessonLint.test.ts` the lint;
  `lessons.experiments.test.ts` the example lessons; `tests/e2e/lesson-steps.test.ts` walks one in the window.

## See also

- [For developers](README.md)
- [How lessons work](../lessons/How-Lessons-Work.md)
- [The lesson file format](../lessons/Lesson-File-Format.md)
- [Writing built-in knowledge](Writing-Knowledge.md)
