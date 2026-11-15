[Русский](Audit-Workflow.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Auditing someone else's workflow and a custom pack

<!-- lesson: audit-workflow -->
Lesson "audit-workflow", in the group **Diagnostics, performance and safety** of the lesson list. Level 2, core; track
Base. It follows the new standard of lessons (standard 2).

## What you will be able to do
Decide before anything runs whether a workflow from someone else and the packs it needs are safe to run, and under
which limits.

## What you need
- [Reading someone else's workflow](Reading-A-Workflow.md).
- A workflow from someone else that you want to try, as a `.json` file or a picture.
- Written against the ComfyUI Manager README, the Registry standards and the start flags of ComfyUI as documented on
  2026-11-15.

## The steps
1. **Where the risk is** (reading): opening a workflow in the app runs nothing; a pack runs with the rights of ComfyUI
   from its start; pickle model files can run code; the start of ComfyUI decides who can reach it.
2. **Open it as data** (checklist): **File ▸ Open workflow…** and **Check graph** (your own word); whether every node
   is installed (the app checks it; this item is optional, a missing node is a pack to audit).
3. **What it writes**: find a node that saves or shows a result.
4. **What it loads**: find a model loader and write the format of each file.
5. **What a pack can do, and what limits it** (reading): the Registry forbids `eval`, `exec`, installs at run time and
   obfuscated code; ComfyUI Manager's `security_level`, `allow_git_url_install` and `allow_pip_install`; `--listen`.
6. **Where each pack comes from** (checklist, your own word): from the Manager's list or the Registry, its author and
   repository, the version.
7. **What each pack brings** (checklist, your own word): its Python packages, `eval`, `exec`, `subprocess` and pip in
   its code, what it downloads or sends, the formats of its model files.
8. **Keys and the network** (checklist, your own word): no key in the workflow, ComfyUI on 127.0.0.1, the
   `security_level` not lowered.
9. **The verdict** (checklist, your own word): run, run with limits, or do not run; the limits; a snapshot before any
   install. Nodes of rejected packs are removed from the canvas.
10. **What you will run is installed** (a check the app makes): every node on the canvas is installed.
11. **Run what passed** (checklist, your own word): the run, and no "(IMPORT FAILED)" for the new packs.
12. **How good is the audit?** (rubric): evidence for each pack and file, unknowns written as unknown (needed to go
    on), a verdict with reasons.
13. **Check yourself** (three questions).
14. **On your own: a pack you want** (your own task): audit a pack without a workflow to guide you.

## What the lesson checks
- On the canvas, by the app: a node that saves or shows a result and a model loader are there.
- From what it already reads: whether every node of the workflow is installed in your ComfyUI.
- Not checked: the code of a pack, its repository, your settings and start flags, any install, the run. They are your
  own word. A careful review is a habit, not a guarantee: it can miss what an author hides.

## Mistakes people make
- Every missing pack installed with one button, then read: restore the snapshot and audit first.
- A pack from a link or a command in the workflow's notes: find it in Manager or on its author's page.
- A `.ckpt` or `.pth` from an unknown site: look for `.safetensors`, treat a pickle file as a program.
- `--listen` to share with a friend: without an address it opens ComfyUI to every address of the network.

## See also
- [Node packs](../concepts/Node-Packs.md)
- [Unsafe model formats](../concepts/Unsafe-Model-Formats.md)
- [Security](../trust/Security.md)
- [Diagnosing missing nodes, models and IMPORT FAILED](Diagnose-Missing.md)
- [How lessons work](How-Lessons-Work.md)
