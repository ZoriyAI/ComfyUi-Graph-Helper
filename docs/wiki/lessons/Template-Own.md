[Русский](Template-Own.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Templates: from a ready workflow to your own

<!-- lesson: template-own -->
Lesson "template-own", in the group **The daily work cycle** of the lesson list. Level 1, core; track Base. It follows
the new standard of lessons (standard 2): a checklist, canvas steps, a check the app makes, a rubric, questions to check
yourself and a task to do on your own.

## What you will be able to do
Open a template, name its inputs, outputs, models and notes, and change it for a new task in a copy that leaves the
template as it was.

## What you need
- [A first picture from text](Image.md) and [Reading someone else's workflow](Reading-A-Workflow.md), or the same skills.
- A ComfyUI you can run, with one picture model in `models/checkpoints`.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image. All are
  ComfyUI's own.
- Written for ComfyUI's core nodes and its interface as documented in November 2026, checked on 2026-11-15.

## The steps
1. **A template is a starting point** (reading): a template works and names its models, but changed in place it is lost.
2. **Before you start** (checklist): ComfyUI read and a picture model there (the app sees both), the versions of your
   ComfyUI written down (your own word).
3. **Open a template and keep it safe** (checklist, in ComfyUI): open the template browser ("Templates" in the sidebar
   or "Browse Templates" in the menu), choose a text to picture template, put its models in place from the link it
   gives, "Save As" under your own name before any change, "Export" and open the file here with
   **File ▸ Open workflow…**.
4. **What to look for in a template** (reading): inputs, outputs, models, notes; a template wrapped in a subgraph.
5. **The graph of the template**: the seven nodes of the picture graph on the main canvas.
6. **Write down what you found** (checklist): the inputs, the outputs, the models and the notes.
7. **Change it for a new task**: a wide banner with two pictures to choose from: `width` from 640 to 1600
   (**Do this for me** sets 768) and `height` below it, `batch_size` from 2 to 4 (2), and a `filename_prefix` that starts
   with `banner/`.
8. **Every node is in your ComfyUI** (a check the app makes).
9. **Run your version** (checklist): saved for ComfyUI under a new name, run, two wide pictures in `output/banner`, and
   the template still as it was.
10. **How did it go?** (rubric): you can point to every input, output, model and note; the pictures fit the task; the
    template and your version are two workflows (this one must be "yes").
11. **Check yourself** (three questions): what to do first, where to get a missing model, which node decides where the
    result goes.
12. **On your own: another template** (your own task, no **Do this for me**).

## What the lesson checks
- On the canvas, by the app: the nodes and links of the picture graph, a model and a prompt, the wide size, two to four
  pictures and the folder `banner/`.
- From what it already reads: that ComfyUI was read, that `models/checkpoints` holds a file, that every node on the
  canvas is installed.
- Not checked: which template you opened, the copy, the run and the pictures. The end of the lesson says **Run in
  ComfyUI: your own word** and **Result assessed: your own word**.

## Mistakes people make
- The original template is gone after a save: templates come with ComfyUI; open it again from the browser and use
  "Save As" next time.
- A red loader and "errors found": a model of the template is missing. Download it only from the link the template
  gives, after reading its license.
- One big node on the canvas: the template is wrapped in a subgraph. Take the default graph (Ctrl+D) instead.
- Out of memory after the change: lower `batch_size` to 2 or make the picture smaller.

## Sources
The template browser, its missing-model errors and the package comfyui-workflow-templates:
docs.comfy.org, Interface, Templates. The menu labels "Browse Templates", "Save As" and "Export": the English locale of
the ComfyUI frontend. Ctrl+D loads the default graph: the ComfyUI README.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Opening a workflow](../graph/Opening-Workflows.md)
- [Workflows and their file formats](../concepts/Workflow-Formats.md)
