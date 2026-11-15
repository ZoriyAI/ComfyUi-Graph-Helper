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

## See also

- [For developers](README.md)
- [How lessons work](../lessons/How-Lessons-Work.md)
- [The lesson file format](../lessons/Lesson-File-Format.md)
- [Writing built-in knowledge](Writing-Knowledge.md)
