[Русский](Snapshots.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Snapshots, updates and the way back

<!-- lesson: snapshots -->
Lesson "snapshots", in the group **Start and a reliable setup** of the lesson list. Level 0, core; track Base. It
follows the new standard of lessons (standard 2). After it, the list goes on with [How ComfyUI works](How-ComfyUI-Works.md).

## What you will be able to do
Update ComfyUI so that you can go back: a snapshot kept outside the install, a control workflow run before and after,
and a written rollback path.

## What you need
- The control workflow and environment card of [Install and a first run without errors](First-Run.md).
- At least one pack: [The Manager: a first node pack, safely](First-Pack.md).
- Written against ComfyUI 0.45.0, Comfy Desktop and the Manager, checked on 2026-11-15.

## The steps
1. **An update you can undo** (reading).
2. **What a snapshot holds** (reading): versions of ComfyUI, packs and Python packages, not models, workflows or
   pictures. Desktop: the Manage panel, tab Snapshots (Create Snapshot, Export, Import), and a snapshot before each
   update. Manager (legacy interface): Save snapshot, Restore at the next start. Manual: the Git commit.
3. **The control workflow**: Save Image and the environment card (a Text (Multiline) node) on the canvas.
4. **Every node is installed now** (a check the app makes).
5. **Before the update** (checklist): the control run, the version, the snapshot, a copy of it outside the ComfyUI
   folder.
6. **Update** (checklist): Desktop, tab Update (Stable or Latest on GitHub); Portable,
   `update/update_comfyui_stable.bat`; manual, `git pull` and `pip install -r requirements.txt`; packs one at a time.
7. **Read it again** (a check the app makes): ComfyUI read and every node of the control workflow still installed.
8. **The same workflow, after** (checklist): the control run again, compared.
9. **The way back** (reading): Desktop restore or Stable, Copy & Update to try on a copy; Manager Restore and a
   restart; manual `git checkout`; one pack's old version.
10. **Your rollback path** (checklist; trying it on a copy is optional).
11. **Is the update reversible?** (rubric): the same picture, what changed, the way back (at least written).
12. **Check yourself** (three questions).
13. **On your own: one pack** (checklist, no **Do this for me**).

## What the lesson checks
- From what it already reads: every node of the control workflow installed before and after; ComfyUI read again.
- On the canvas: Save Image and the card with a text.
- Not checked: the snapshot, the update, the versions, both runs and the comparison.

## Mistakes people make
- `(IMPORT FAILED)` after the update: update the pack, or restore the snapshot.
- The newest commits broke things: go back to the stable channel.
- A snapshot expected to bring back models: back up files separately.
- A Manager restore that "did nothing": it works at the next start.

## Sources
docs.comfy.org: Desktop, managing installations; Updating ComfyUI; the Manager legacy interface. The ComfyUI README on
releases.

## See also
- [ComfyUI and where to get it](../start/ComfyUI.md)
- [The Manager: a first node pack, safely](First-Pack.md)
- [How ComfyUI works](How-ComfyUI-Works.md)
