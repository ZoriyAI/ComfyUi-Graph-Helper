[Русский](Partial-Cache.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Partial execution and the cache

<!-- lesson: partial-cache -->
Lesson "partial-cache", in the group **The daily work cycle** of the lesson list. Level 1, core; track Base. It follows
the new standard of lessons (standard 2).

## What you will be able to do
Run only the branch you are working on, and tell from the time and the files which nodes ran again and why.

## What you need
- [Run, queue, history and cancel](Queue-History.md), or the same skills.
- A ComfyUI you can run, with one picture model in `models/checkpoints`, and an interface (frontend) of version 1.24 or
  newer for partial execution.
- Nodes: the picture graph, Upscale Image By and Preview Image. All are ComfyUI's own.
- Checked on 2026-11-15.

## The steps
1. **Run only what you are working on** (reading): ComfyUI remembers results and works out only what changed.
2. **Before you start** (checklist).
3. **The picture graph**, with a Save Image.
4. **A second branch: a small preview**: Upscale Image By fed by VAE Decode, `scale_by` from 0.25 to 0.75
   (**Do this for me** sets 0.5), and a Preview Image after it.
5. **Every node is in your ComfyUI** (a check the app makes).
6. **A full run and a run with nothing changed** (checklist): `control_after_generate` set to `fixed`, the time of
   the run from "Prompt executed in … seconds", and a second run that ends at once.
7. **What runs again** (reading): a changed node and everything after it run again; the nodes before it come from memory.
8. **Change the end of the graph** (checklist): only `scale_by` changed: the sampler did not run, the run was short.
9. **Run one branch only** (checklist): the preview selected and run alone from the run button of the selection
   toolbox (or "Queue Selected Output Nodes"): no new file; a new seed run on the preview alone: the sampler runs, still
   no file; the whole graph: Save Image writes the new picture.
10. **What did you prove?** (rubric): which branch ran, why it was faster, what a change upstream reruns.
11. **Check yourself** (three questions).
12. **On your own: keep the small copy** (your own task on the canvas, no **Do this for me**): a second Save Image fed
    by the small copy, with another `filename_prefix`.

## What the lesson checks
- On the canvas, by the app: the picture graph, the preview branch and its scale, and in the last step the second saver
  with another name.
- From what it already reads: that ComfyUI was read, that `models/checkpoints` holds a file, that every node is installed.
- Not checked: which nodes ran, the times and the files. They are your own word.

## Mistakes people make
- No run button on the selection: partial execution starts from an output node.
- A partial run runs everything: an old interface; update ComfyUI.
- Nothing ran again after a change: the change is not on the way to the output you run, or the value did not change.
- Everything runs every time: the seed changes after each run; set `control_after_generate` to `fixed`.

## Sources
Partial execution and the frontend version: docs.comfy.org, Interface, Partial Execution. The cache: the ComfyUI README
and docs.comfy.org, custom nodes, server overview. "Queue Selected Output Nodes": the English locale of the ComfyUI
frontend. Upscale Image By and Preview Image: ComfyUI nodes.py. "Prompt executed in … seconds": ComfyUI main.py.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Run, queue, history and cancel](Queue-History.md)
- [Logs and a minimal failing example](Minimal-Example.md)
