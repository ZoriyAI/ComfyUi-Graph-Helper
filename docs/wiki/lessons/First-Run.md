[Русский](First-Run.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Install and a first run without errors

<!-- lesson: first-run -->
Lesson "first-run", in the group **Start and a reliable setup** of the lesson list. Level 0, core; track Base. It
follows the new standard of lessons (standard 2).

## What you will be able to do
Install ComfyUI so that it is proven to work: read its start log, run a first picture, and write an environment card
someone else could repeat.

## What you need
- Your choice from [Desktop, Portable, a manual install or Cloud](Choose-Setup.md). The card says so; it is a hint,
  not a lock.
- About 10 GB of free disk for ComfyUI and a first model.
- Written against ComfyUI 0.45.0, Comfy Desktop and the official first generation tutorial, checked on 2026-11-15.

## The steps
1. **Working means a picture, not a window** (reading).
2. **Install and start** (checklist, your own word): the official instructions of your way; the start log prints
   `To see the GUI go to:`; find the lines `ComfyUI version:`, `Device:` and `Total VRAM`.
3. **Connect the app** (a check the app makes): Settings ▸ Connection ▸ Find on this computer, then Read ComfyUI.
4. **A first model** (reading): a fresh ComfyUI has no models; the tutorial's
   `v1-5-pruned-emaonly-fp16.safetensors` in `models/checkpoints`; the missing models list with **Download**; R makes
   ComfyUI read the folders again.
5. **Run a first picture** (checklist): a template opened; a model file in `models/checkpoints` (the app sees this
   after a sync); Run, with `Prompt executed in … seconds` in the log; the file in the output folder. The run is your
   own word.
6. **Open the picture here** (a check the app makes): File ▸ Open workflow… and the picture; the app checks that the
   last file it opened was a picture with a workflow.
7. **The graph that made it**: Save Image on the canvas.
8. **Every node is in your ComfyUI** (a check the app makes).
9. **The environment card**: a Text (Multiline) node with the system, the graphics card and memory, the version, the
   way of install and the folders (without your user name if you share the workflow).
10. **Keep the known good pair** (checklist): the workflow with the card and the first picture.
11. **Is the install proven?** (rubric): the start log, the card, a second start without notes.
12. **Check yourself** (three questions).
13. **On your own: a cold start** (checklist, no **Do this for me**).

## What the lesson checks
- From what it already reads: that ComfyUI was read, that `models/checkpoints` lists a file, that the last workflow
  opened came from a picture, that every node of the graph is installed.
- On the canvas: a Save Image and the card with a text.
- Not checked: the install, the log, the run. The end of the lesson says **Run in ComfyUI: your own word**.

## Mistakes people make
- An empty list of checkpoints: a fresh ComfyUI has no models; download one and press R.
- Red lines in the start log: read the last ones and compare with the official install page.
- The app cannot find ComfyUI: open the printed address first; Desktop uses port 8000, the others 8188.
- "Latest" on the card instead of the version number from `ComfyUI version:`.

## Sources
docs.comfy.org: Installation, First generation; ComfyUI's own start log (server.py, main.py, model_management.py).

## See also
- [ComfyUI and where to get it](../start/ComfyUI.md)
- [The first hour](../start/First-Hour.md)
- [A model library and shared folders](Model-Library.md)
- [How ComfyUI works](How-ComfyUI-Works.md)
