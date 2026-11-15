[Русский](First-Pack.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# The Manager: a first node pack, safely

<!-- lesson: first-pack -->
Lesson "first-pack", in the group **Start and a reliable setup** of the lesson list. Level 0, core; track Base. It
follows the new standard of lessons (standard 2).

## What you will be able to do
Tell a node, a model, a dependency and a workflow apart, and install a node pack the safe way: source and version
checked, the import log read, the version written down.

## What you need
- A working ComfyUI: [Install and a first run without errors](First-Run.md).
- The Manager turned on: Desktop has it; Portable and manual installs install `manager_requirements.txt` and start
  with `--enable-manager`.
- The example pack: ComfyUI-Custom-Scripts by pythongosssss (MIT license, 1.2.5 in the Registry on 2026-11-15). The
  method fits any pack.
- Written against ComfyUI 0.45.0 and the Manager built into it, checked on 2026-11-15.

## The steps
1. **A pack is a program** (reading): it runs with all the rights of ComfyUI.
2. **Node, model, dependency, workflow** (reading).
3. **Before you install** (checklist): ComfyUI read (the app sees this), the Manager opens, a way back (a snapshot or
   the list of your packs).
4. **Find it and check the source** (checklist): the author, the repository, how many people use it, the version.
5. **Install, restart, read the log** (checklist): **Install**, a restart, and the pack's line under
   `Import times for custom nodes:` without `(IMPORT FAILED)`.
6. **The pack is loaded** (a check the app makes): Show Text 🐍, Math Expression 🐍 or String Function 🐍 is installed.
7. **Write the pack down**: a Text (Multiline) node with the pack, the author and the version.
8. **Run a node of the pack** (checklist): the note linked to Show Text 🐍 in ComfyUI and run.
9. **Was it safe and clean?** (rubric): source checked before Install (must be yes), the import log, the record.
10. **Check yourself** (four questions).
11. **On your own: the next pack** (checklist, no **Do this for me**).

## What the lesson checks
- From what it already reads: ComfyUI read; a node class of the pack installed after a sync.
- On the canvas: the note with a text.
- Not checked: the Manager, the log, the run.

## Mistakes people make
- `(IMPORT FAILED)` after the pack's name: read the error above it; update or remove the pack.
- No Manager: Portable and manual installs need `--enable-manager`.
- A pack from a link in a video: check the author and the repository, or remove it.
- Nodes missing after Install: restart ComfyUI and refresh the page.

## Sources
docs.comfy.org: Manager install, pack management, legacy interface, installing custom nodes; ComfyUI's nodes.py (the
import list); the pack's own repository and its Registry entry.

## See also
- [Node packs](../concepts/Node-Packs.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
