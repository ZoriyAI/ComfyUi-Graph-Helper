[Русский](Model-Library.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A model library and shared folders

<!-- lesson: model-library -->
Lesson "model-library", in the group **Start and a reliable setup** of the lesson list. Level 0, core; track Base. It
follows the new standard of lessons (standard 2).

## What you will be able to do
Keep model files where ComfyUI finds them, share one folder instead of copying it, and write a manifest that lets you
rebuild the library.

## What you need
- A working ComfyUI with at least one checkpoint: [Install and a first run without errors](First-Run.md).
- Written against ComfyUI 0.45.0, Comfy Desktop and the official page on models, checked on 2026-11-15.

## The steps
1. **A library, not a heap** (reading).
2. **Before you start** (checklist the app checks itself): ComfyUI read, a file in `models/checkpoints`.
3. **One folder per kind** (reading): each loader lists only its own folder; sub-folders show as part of the name;
   R in ComfyUI and Sync now after a change.
4. **Sort the files** (checklist, your own word): a way to get each file again first, then each file to the folder of
   its kind.
5. **Practice: the library in a loader**: Load Checkpoint with a picture model in `ckpt_name`.
6. **One folder for several installs** (reading): `extra_model_paths.yaml` copied from
   `extra_model_paths.yaml.example` (Desktop: add to its `extra_models_config.yaml`, never replace it); `base_path`,
   the kinds, `is_default`; a restart after each change.
7. **Decide, then share** (checklist): whether you need a shared folder; the copy, the edit and the restart are
   optional, for those who do.
8. **The models are still found** (a check the app makes).
9. **A manifest of the important files** (checklist): name, kind, size, source, license and SHA-256
   (`certutil -hashfile … SHA256`, `shasum -a 256 …`, `sha256sum …`).
10. **Run from the library** (checklist): a workflow ran with a model from its new place.
11. **Is the library in order?** (rubric): every model listed, copies, the manifest.
12. **Check yourself** (three questions).
13. **On your own: a new kind of file** (checklist, no **Do this for me**).

## What the lesson checks
- From what it already reads: ComfyUI read, a file in `models/checkpoints`, before and after the change.
- On the canvas: a picture model chosen in Load Checkpoint.
- Not checked: your disk, the YAML file, the hashes, the run.

## Mistakes people make
- A file on disk but in no list: wrong folder, or ComfyUI has not read the folders again.
- The YAML edit does nothing or ComfyUI does not start: it is read at start only; put back your copy if it fails.
- The same model in two installs: one copy in a shared folder.
- A renamed file nobody recognizes: compare its hash.

## Sources
docs.comfy.org: Models; `extra_model_paths.yaml.example` in the ComfyUI repository; the hash tools built into Windows,
macOS and Linux.

## See also
- [Where ComfyUI files live](../concepts/Where-Files-Live.md)
- [Checkpoint](../concepts/Checkpoint.md)
