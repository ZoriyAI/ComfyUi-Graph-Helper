[Русский](Diagnose-Missing.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Diagnosing missing nodes, models and IMPORT FAILED

<!-- lesson: diagnose-missing -->
Lesson "diagnose-missing", in the group **Diagnostics, performance and safety** of the lesson list. Level 2, core;
track Base. It follows the new standard of lessons (standard 2).

## What you will be able to do
Name the class of a ComfyUI failure (a node, a model, a pack that failed to import, the frontend, the environment) with
evidence before installing anything.

## What you need
- [A first picture from text](Image.md), or the same graph built by hand.
- A workflow that fails in your ComfyUI, with its error, and access to the terminal or log of ComfyUI.
- Written for ComfyUI's core nodes, the ComfyUI frontend and ComfyUI Manager as documented on 2026-11-15.

## The steps
1. **Find the class before you install** (reading): the route from the error to a fix or a way back.
2. **Before you change anything** (checklist): ComfyUI was read (the app sees this); the versions of ComfyUI, Python and
   PyTorch from the About page of ComfyUI's settings, and a way back (a snapshot in ComfyUI Manager, or a copy of
   `custom_nodes`): your own word.
3. **Five classes and their signs** (reading): a missing node, a missing model ("Value not in list", "This workflow is
   missing models"), a pack that failed to import ("Import times for custom nodes:" with "(IMPORT FAILED)"), the
   frontend, the environment.
4. **Collect the evidence** (checklist, your own word): the error text, **Graph ▸ Explain a ComfyUI error…**, **Check
   graph** on the failing workflow, the start log.
5. **Name the class** (checklist, your own word): the class, its line of evidence, nothing installed yet.
6. **ComfyUI's own nodes are there** (a check the app makes): KSampler, Load Checkpoint and Save Image are installed.
7. **A known-good small graph**: the picture graph, only ComfyUI's own nodes.
8. **Every node is in your ComfyUI** (a check the app makes).
9. **Test, fix, run again** (checklist, your own word): the small graph runs; optionally a start with
   `--disable-all-custom-nodes`; one fix by the class; the failing workflow run again.
10. **How did the diagnosis go?** (rubric): class with evidence, named before any install (needed to go on), the small
    graph ran, the workflow fixed or the next step known.
11. **Check yourself** (three questions).
12. **On your own: a report** (your own task): the next failure, a report and the smallest workflow that fails.

## What the lesson checks
- On the canvas, by the app: the nodes, links and fields of the small graph.
- From what it already reads: that ComfyUI was read, that its own KSampler, Load Checkpoint and Save Image are
  installed, that every node of the small graph is installed.
- Not checked: the log of ComfyUI, your versions, any install, update or restore, and every run. They are your own word.

## Mistakes people make
- A red node, and the first pack a search shows installed: read why it is red first; look for "(IMPORT FAILED)".
- "Value not in list: ckpt_name" answered with a reinstall: it is a missing model file.
- Everything fails, even the small graph: try `--disable-all-custom-nodes`; then it is a pack or the environment.
- Everything updated at once: restore the snapshot and change one thing at a time.

## See also
- [An error in ComfyUI](../graph/ComfyUI-Errors.md)
- [Checking a graph](../graph/Checking-A-Graph.md)
- [Node packs](../concepts/Node-Packs.md)
- [Auditing someone else's workflow and a custom pack](Audit-Workflow.md)
- [How lessons work](How-Lessons-Work.md)
