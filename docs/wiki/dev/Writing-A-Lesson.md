[Русский](Writing-A-Lesson.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Writing a lesson

A lesson is a list of steps, each one described as **what must be on the canvas** after it. The app reads the canvas
to know where the person is, so a lesson never keeps its own state: delete a node and the lesson goes back to its
step. How lessons look to a person: [How lessons work](../lessons/How-Lessons-Work.md).

## Where things are

| What | Where |
| --- | --- |
| The steps | `src/shared/lessons/lessons.ts` (and `src/shared/lessons/sets/` for groups of lessons, such as the picture model families). |
| The words | `src/shared/lessons/texts.en.ts`, `texts.ru.ts` (and `sets/*.texts.*.ts`), under the same lesson and step ids. |
| Checking the canvas | `src/shared/lessons/engine.ts`, `fit.ts` (does this ComfyUI have what the lesson needs), `flow.ts`. |
| The panel | `src/renderer/components/lessons/LessonPanel.tsx`. |
| The wiki page | `docs/wiki/lessons/<Name>.md` and `.ru.md`, with the comment `<!-- lesson: <id> -->`. |

## A step

```ts
{ id: 'model', roles: [node('checkpoint', 'CheckpointLoaderSimple')], fields: [field('checkpoint', 'ckpt_name', chosen)] }
```

- `read: true`: a step that only explains; the person reads it and goes on. Put the knowledge here and keep the doing
  steps short.
- `roles`: nodes that must be on the canvas, each with a role name and the classes that count.
- `links`: `link(from, output, to, input, via?)`; `via` lists nodes that may stand in between (a LoRA loader).
- `fields`: `field(role, name, test)`. The tests (`FieldTest` in `src/shared/lessons/engine.ts`): `chosen`, `equals`,
  `between` (with `prefer`, the value Do this for me sets), `text` (a minimum length, marks it must hold), `weighted`
  (a prompt weight in a range), `has-trigger` (the trigger words of a chosen LoRA) and `differs` (not the same file as
  another loader).

Use ComfyUI's own class names and port names. A lesson is offered only when the person's ComfyUI has every class it
names with the inputs it names, so a ComfyUI where a node is built differently gets "this lesson does not fit"
instead of wrong instructions.

## The words

For each lesson: `title`, `result` (one line: what the person ends up with) and, for every step id, a short `title`
and a `body` (a small markdown: paragraphs, a list, `code`). Write `{role}` to name a node of the lesson: the app
puts in the node's name as this ComfyUI's library shows it. Plain words, the action first, the menu named as the
menu names it.

## Order

- `LESSONS` is the order a person meets them.
- `LESSON_AFTER` says which lesson's graph a lesson stands on (shown in the list, not enforced).

## Tests

- `tests/unit/lessons.test.ts` walks every lesson from an empty canvas to the end by doing what it says, checks that
  every explaining step is shown once, and that the place in a lesson is read off the graph (a deleted node sends
  it back).
- `tests/unit/lessonFit.test.ts` checks when a lesson fits a ComfyUI and when it does not.
- `tests/unit/wiki.test.ts` checks that every lesson id has a wiki page marked `<!-- lesson: <id> -->` in both
  languages.
- `tests/e2e/lessons.test.ts` goes through a lesson in the window.

## See also

- [For developers](README.md)
- [How lessons work](../lessons/How-Lessons-Work.md)
- [Writing built-in knowledge](Writing-Knowledge.md)
