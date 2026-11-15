[Русский](Minimal-Example.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Logs and a minimal failing example

<!-- lesson: minimal-example -->
Lesson "minimal-example", in the group **The daily work cycle** of the lesson list. Level 1, core; track Base. It
follows the new standard of lessons (standard 2).

## What you will be able to do
Read a failure in the log and cut the workflow down to the smallest one that still fails, then write a report another
person can repeat.

## What you need
- [Run, queue, history and cancel](Queue-History.md), or the same skills.
- A ComfyUI you can run. No model is needed for the cut-down example.
- Nodes: Save Image and Empty Image, both ComfyUI's own. The lesson starts from any graph with a Save Image, such as the
  picture graph of [A first picture from text](Image.md).
- Checked on 2026-11-15.

## The steps
1. **Find the cause, not a workaround** (reading): repeat, read, cut, report.
2. **Before you start** (checklist): ComfyUI read (the app sees this), where your log is (the Logs tab of the bottom
   panel, the console, or the log files of the Desktop app), and the versions written down.
3. **A failure on purpose**: `filename_prefix` of Save Image set to `../broken`. ComfyUI refuses to save outside its
   output folder ("Saving image outside the output folder is not allowed."), so the run fails every time and nothing is
   written anywhere.
4. **Repeat it and find it in the log** (checklist): the run fails at Save Image, the block "Exception during
   processing" with its traceback, and the same error a second time.
5. **How to read the block** (reading): the last line is the reason; `custom_nodes` in a path points to a pack; a check
   of the graph before the run reads "Prompt outputs failed validation".
6. **Cut it down**: an Empty Image feeds Save Image, every other node deleted.
7. **Is it small, and does it still fail?** (checklist): the app checks that the workflow has at most three nodes; the
   same error comes, in a moment, without a model.
8. **Write the report** (checklist): the minimal workflow, the versions and the packs, the log block and what you
   expected, with private paths and keys removed.
9. **How good is the example?** (rubric): nothing more can go, it fails every time (this one must be "yes"), the report
   is complete.
10. **Check yourself** (three questions).
11. **On your own: a real failure** (your own task): a workflow of yours that failed, cut down and reported.

## What the lesson checks
- On the canvas, by the app: the name that fails, the Empty Image that feeds the saver, and at most three nodes.
- From what it already reads: that ComfyUI was read.
- Not checked: the log, the runs and the report. They are your own word.

## Mistakes people make
- Several changes at once, the error is gone and nobody knows why: one change per run.
- Only the last red line read: read the whole block.
- The cut-down workflow no longer fails: the cause was in what you removed; put back half.
- A report with your user name, private folders or a key: look through it before you send it.

Give Save Image a normal name again when you are done.

## Sources
The refusal to save outside the output folder: ComfyUI folder_paths.py. "!!! Exception during processing !!!" and
"Prompt outputs failed validation": ComfyUI execution.py. The Logs tab and the Terminal of the bottom panel:
docs.comfy.org, Interface, Bottom Panel. The log folder of the Desktop app and what a bug report holds:
docs.comfy.org, Troubleshooting. Empty Image: ComfyUI nodes.py.

## See also
- [How lessons work](How-Lessons-Work.md)
- [An error in ComfyUI](../graph/ComfyUI-Errors.md)
- [Partial execution and the cache](Partial-Cache.md)
