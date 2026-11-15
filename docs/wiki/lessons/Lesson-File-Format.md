[Русский](Lesson-File-Format.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The lesson file format

A lesson file holds one lesson or a whole group of lessons. The app writes it when you export and reads it when you
import (see [My lessons](My-Lessons.md)). It is JSON, its name ends in `.lesson.json`, and it is data only: nothing
in it is run, evaluated or opened.

## An example
The comments after `//` are for reading here; a real file has none. The app reads this file as it is.

```jsonc
{
  "format": "nodewise-studio/lessons",   // what the file is; any other value is not a lesson file
  "version": 1,                          // the version of the format; a newer one is refused with a message
  "lessons": [                           // one lesson or more (at most 200)
    {
      "id": "sdxl-size",                 // lower-case letters, digits and hyphens; in the app it becomes my:sdxl-size
      "author": "Your name",             // shown as text
      "source": "Made in the lesson editor", // shown as text, never opened
      "continues": ["image"],            // lessons whose graph this one starts from: a hint, not a lock
      "needs": { "packs": [], "classes": ["CheckpointLoaderSimple", "EmptyLatentImage"] },
      "texts": {                         // the words, in "en", "ru" or both
        "en": {
          "title": "The size of an SDXL picture",
          "result": "You set the blank to the size SDXL was trained at.",
          "steps": {                     // the words of each step, by step id
            "intro": { "title": "Why the size matters", "body": "SDXL was trained near one megapixel." },
            "model": { "title": "Load the model", "body": "Add {checkpoint} and choose a file in `ckpt_name`." },
            "size": { "title": "Set the size", "body": "In {latent} set `width` to 1024." }
          }
        }
      },
      "steps": [                         // what must be on the canvas after each step
        { "id": "intro", "read": true }, // a step that only explains
        {
          "id": "model",
          "roles": [{ "role": "checkpoint", "classes": ["CheckpointLoaderSimple"] }],
          "fields": [{ "role": "checkpoint", "field": "ckpt_name", "test": { "kind": "chosen" } }]
        },
        {
          "id": "size",
          "roles": [{ "role": "latent", "classes": ["EmptyLatentImage"] }],
          "fields": [{
            "role": "latent", "field": "width",
            "test": { "kind": "between", "min": 640, "max": 1536, "prefer": 1024 }, // Do this for me sets 1024
            "why": "im.sdxlSize"         // a reason the app wrote; a file cannot bring its own sentence
          }]
        }
      ]
    }
  ]
}
```

## The parts of a lesson
- `id`: the lesson's own id. In the app a lesson of yours is `my:` and this id, so it never replaces a built-in
  lesson.
- `group`: an id and a title in each language, for a lesson that belongs to a group.
- `follows`: lessons whose ideas this one goes on from. `continues`: lessons whose graph it starts from. Both are
  hints in the list, never locks.
- `adult`: `true` keeps the lesson behind the switch **Adult content (18+)**.
- `author` and `source`: shown as plain text.
- `needs`: node packs and classes, said on the card. The app checks the classes against your ComfyUI itself.
- `texts`: the words in `en`, `ru` or both. Each has `title`, `result` and the words of every step: `title` and
  `body`. In a body, `{role}` becomes the name of that node in bold.
  It may also have `roles`: a short label for a role, by role name, such as `"first": "first frame"`. The label
  is shown beside the node's name in "Still to do", so two alike nodes are told apart.
- `steps`: what each step asks for.

## What a step asks for
A step either only explains (`"read": true`) or asks for something on the canvas, never both.
- `roles`: nodes the step adds. A role is a name the lesson gives a node (`sampler`, `positive`); any of its
  `classes` fills it. A role is added once, in one step.
- `links`: from the output of one role to the input of another: `from`, `output`, `to`, `input`. `via` lists
  classes that may stand in between, such as a LoRA loader. `alt` lists other links that do the same work.
- `fields`: values. Each has `role`, `field` and `test`, and may have `why` (the id of a reason the app wrote),
  `soft` (advice that does not hold the step back) and `identifies`.

The tests:

| `kind` | What it asks |
|---|---|
| `chosen` | something is chosen or written |
| `equals` | exactly this `value` |
| `between` | a number from `min` to `max`; `prefer` is the number the text names and the one **Do this for me** sets; `frames` asks for 4n + 1 |
| `text` | at least `minChars` characters; optionally `words`, `has`, `english`, `notCopyOf`, `noNegation` |
| `weighted` | a weight such as `(red coat:1.2)` from `min` to `max`, other than 1 |
| `file` | a model file of a kind the app knows, or one described by words its name must hold |
| `sameFamily` | a file made for the family of the file in another field |
| `same`, `differs`, `less` | the same as, not the same file as, or below another field |
| `size` | near the size the model in another field was trained at |
| `aspect` | the proportions of another node |
| `has-trigger` | the trigger words of a LoRA chosen in the given fields |

## Version 2: steps you answer, outcomes and the template
Version 2 of the format adds what a lesson of version 1.1 of the app can hold. A file that uses none of it is still
written as version 1, so version 1.0 of the app opens it; this app reads both.

A step may be, instead of a step to read or a canvas step, one of these (never two at once):
- `checklist`: items `{ "id", "optional"?, "check"?, "run"? }`. Their words are in `texts.<language>.steps.<step>.items`:
  `{ "label", "how"? }`. `check` is a condition the app reads itself (below); `run: true` marks the item that says
  the workflow was run in ComfyUI.
- `rubric`: criteria `{ "id", "levels", "pass"? }`, two to four level ids from low to high; `pass` is the lowest level
  that lets the person go on. Words in `criteria`: `{ "title", "levels": { "<level>": "…" }, "tryNext"? }`.
- `quiz`: one to five questions `{ "id", "choices", "answer" }`. Words in `questions`: `{ "text", "choices": { … },
  "explain" }`.
- `readCheck`: one to six conditions the app checks from what it already reads, never by running anything:
  `comfy-read`, `node-class` (`classes`), `model-file` (`folder`, `words`?), `workflow-complete`, `workflow-size`
  (`min`?, `max`?), `workflow-from` (`from`: `picture` or `api`), `workflow-partner` (`present`).
- `transfer: true` on a canvas step or a checklist: a task without a ready answer and without **Do this for me**.

A lesson may also say:
- `outcomes`: which of `structure`, `run` and `result` it ends with. `structure` needs a canvas step, `run` an item with
  `run: true`, `result` a rubric. Without it a lesson has only `structure`.
- `level` (0 to 5), `tracks` (`base`, `image`, `video`, `audio-3d`, `lora`, `api`, `nodes`, `projects`) and `priority`
  (`core`, `pro`, `deep`).
- `standard`: `2` for a lesson of the new standard. It must have `meta` with `versions` and `checkedOn` (YYYY-MM-DD),
  a quiz, a transfer task, and in each language `meta` words: `skill`, `requires` (or `meta.prerequisites`),
  at least three `mistakes` (`sign` and `fix`), `provenance` and `notChecked`.
- `meta`: `prerequisites` (lesson ids), `versions` (text) and `checkedOn`.

A small complete example (this exact file opens in the app):

```json
{
  "format": "nodewise-studio/lessons",
  "version": 2,
  "lessons": [
    {
      "id": "first-run-check",
      "outcomes": ["run", "result"],
      "level": 1,
      "tracks": ["base"],
      "texts": {
        "en": {
          "title": "Did my first picture work?",
          "result": "A first run in ComfyUI, checked and assessed.",
          "steps": {
            "intro": { "title": "What this is", "body": "You run the first picture in ComfyUI and look at it." },
            "run": {
              "title": "Run it",
              "body": "Open the workflow in ComfyUI and press Run.",
              "items": {
                "read": { "label": "The app has read my ComfyUI." },
                "ran": { "label": "I ran it, and a picture appeared.", "how": "A new file in the output folder." }
              }
            },
            "look": {
              "title": "Look at it",
              "body": "The app does not see the picture: this is your own assessment.",
              "criteria": {
                "subject": { "title": "The subject matches the prompt.", "levels": { "no": "No", "partly": "Partly", "yes": "Yes" }, "tryNext": "Put the subject first in the prompt." }
              }
            },
            "recall": {
              "title": "Check yourself",
              "body": "One question.",
              "questions": {
                "seed": { "text": "What gives the same picture again?", "choices": { "seed": "The same seed and settings", "luck": "Luck" }, "explain": "The seed decides the noise a picture starts from." }
              }
            },
            "own": {
              "title": "On your own",
              "body": "Try it without help.",
              "items": { "other": { "label": "I made a second picture with another seed and compared the two." } }
            }
          }
        }
      },
      "steps": [
        { "id": "intro", "read": true },
        { "id": "run", "checklist": [{ "id": "read", "check": { "kind": "comfy-read" } }, { "id": "ran", "run": true }] },
        { "id": "look", "rubric": [{ "id": "subject", "levels": ["no", "partly", "yes"] }] },
        { "id": "recall", "quiz": [{ "id": "seed", "choices": ["seed", "luck"], "answer": "seed" }] },
        { "id": "own", "transfer": true, "checklist": [{ "id": "other" }] }
      ]
    }
  ]
}
```

## What the app checks before it keeps a file
- The size (at most 2 MB), how deeply it nests, that it is JSON, the `format` and the `version`.
- Every text and list against its cap; no control characters and no hidden direction marks.
- Unknown keys are refused, so a file from a newer version says so instead of being half read.
- The parts hold together: no lesson or step twice, a role is added before a step names it, every step has its
  words in each language the lesson has, a range is not empty, at least one step asks for something.
- The same rules of lessons the built-in lessons are held to.
- Only kinds of model file and reasons the app knows.
- That the lesson can be done from an empty canvas.

When a check fails, the message names the lesson and the step in plain words, for example "In lesson “…”, step “…”
speaks of a node “…” that no step before it adds."

## See also
- [My lessons](My-Lessons.md)
- [How lessons work](How-Lessons-Work.md)
- [Writing a lesson](../dev/Writing-A-Lesson.md)
