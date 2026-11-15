[Русский](Workflow-Files.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# JSON, API JSON and the workflow inside a PNG

<!-- lesson: workflow-files -->
Lesson "workflow-files", in the group **The daily work cycle** of the lesson list. Level 1, core; track Base. It
follows the new standard of lessons (standard 2).

## What you will be able to do
Tell the editable workflow, the API format and a picture with a workflow apart, choose the right one for a purpose, and
check it before you share it.

## What you need
- [A first picture from text](Image.md) and [Reading someone else's workflow](Reading-A-Workflow.md), or the same skills.
- A ComfyUI you can run, with one picture model in `models/checkpoints`, and a plain text editor.
- Checked on 2026-11-15.

## The steps
1. **One graph, three forms** (reading).
2. **Before you start** (checklist).
3. **The picture graph**, with a Save Image.
4. **A mark to recognize**: a `filename_prefix` that starts with `formats/`.
5. **Every node is in your ComfyUI** (a check the app makes).
6. **Make the three files** (checklist): run it, so a PNG appears; save it with "Export" and with "Export (API)" from
   the menu of ComfyUI.
7. **What each form holds** (reading): the workflow holds `"nodes"` and `"links"` with positions, groups and notes; the
   API format holds numbered entries with `"class_type"` and `"inputs"`, nothing else; the picture carries both,
   `"workflow"` and `"prompt"`, in its metadata. All three carry every value of every field.
8. **Open each one again** (checklist): the two .json files in a text editor, the PNG in this app with
   **File ▸ Open workflow…**.
9. **Before it leaves your computer** (checklist): no keys, tokens or private paths in the files; the picture carries
   the prompt, and ComfyUI started with `--disable-metadata` writes pictures without a workflow.
10. **Open the API file here** (a check the app makes): the last file the app opened was in the API format.
11. **How did it go?** (rubric): the forms told apart, the right form for each purpose, nothing private left (this one
    must be "yes").
12. **Check yourself** (three questions).
13. **On your own: a package to hand over** (your own task).

## What the lesson checks
- On the canvas, by the app: the picture graph and the mark `formats/`. The API file keeps both, so the graph is still
  there after it is opened.
- From what it already reads: that ComfyUI was read, that `models/checkpoints` holds a file, that every node is
  installed, and that the last workflow the app opened was an API-format file. Open no other file before the lesson
  ends.
- Not checked: the run, the files you made and what is in them. They are your own word.

## Mistakes people make
- An API file sent to someone who will edit the graph: send the workflow from "Save" or "Export".
- A shared picture opens with no workflow: a site or a chat app rewrote it. Send the file as a file, or the .json beside it.
- A key, a private path or an unwanted prompt in a shared file: every field travels in all three forms. This app asks
  before it saves a field that looks like a key.
- No "Export (API)" in the menu: an older interface; update ComfyUI.

## Sources
The `workflow` and `prompt` metadata, the formats that carry it, `--disable-metadata` and loss on rewriting:
docs.comfy.org, workflow metadata. "Export" and "Export (API)": the English locale of the ComfyUI frontend. What this app
opens and how it saves: [Opening a workflow](../graph/Opening-Workflows.md) and
[Saving a workflow for ComfyUI](../graph/Saving-Workflows.md).

## See also
- [How lessons work](How-Lessons-Work.md)
- [Workflows and their file formats](../concepts/Workflow-Formats.md)
- [Logs and a minimal failing example](Minimal-Example.md)
