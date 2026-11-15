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
