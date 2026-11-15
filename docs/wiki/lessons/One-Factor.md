[Русский](One-Factor.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A controlled experiment: one change at a time

<!-- lesson: one-factor -->
Lesson "one-factor", in the group **Experiments and quality** of the lesson list. Level 2, core; tracks Base and
Pictures. It follows the new standard of lessons (standard 2): it has a checklist, canvas steps, a check the app makes,
a rubric, questions to check yourself and a task to do on your own.

## What you will be able to do
Change exactly one setting between two runs and say what that setting did, with a repeat that confirms it.

## What you need
- [A first picture from text](Image.md), or the same graph built by hand, and [Sampler settings](Sampler-Settings.md)
  for the idea of each field. The card says so; it is a hint, not a lock.
- A ComfyUI you can run, with one picture model in `models/checkpoints`.
- Nodes: Load Checkpoint, CLIP Text Encode (Prompt), Empty Latent Image, KSampler, VAE Decode, Save Image. All are
  ComfyUI's own.
- Written for ComfyUI's core nodes, checked on 2026-11-15.

## The steps
1. **Why one change at a time** (reading): one good picture proves little; keep everything the same but one setting.
2. **Before you start** (checklist): ComfyUI is running and the app has read it (the app sees this), there is a picture
   model in `models/checkpoints` (the app sees this in the last sync), and you wrote down the question of the
   experiment (your own word).
3. **The first variant**: the picture graph of the first lesson with a Save Image at its end.
4. **The seed decides the noise** (reading): `seed`, `control_after_generate`, and why both samplers share one seed.
5. **The second variant**: a second KSampler, VAE Decode and Save Image fed from the same model, prompts and blank.
6. **One difference: cfg**: `cfg` 4 on the first sampler and 8 on the second; `seed`, `steps`, `sampler_name`,
   `scheduler` and `denoise` the same on both.
7. **Names that tell the variants apart**: another `filename_prefix` on the second saver, such as `experiment/b`.
8. **Every node is in your ComfyUI** (a check the app makes): every node on the canvas is installed in the ComfyUI the
   app read.
9. **Run it, then repeat it** (checklist): save the workflow for ComfyUI, run it, set `control_after_generate` to
   `fixed`, restart ComfyUI and run again. ComfyUI reuses its results: a second run with nothing changed ends at once,
   so only a run after a restart is a repeat. Every tick here is your own word.
10. **What did cfg do?** (rubric): the layout is shared and the pictures differ in how strictly they follow the
    prompt; the repeat gave the same pictures; you can say which cfg suits the prompt. A low answer shows what to try.
11. **Check yourself** (three questions): two changes at once, why one seed, what a repeated Run does.
12. **On your own: another setting** (your own task, no **Do this for me**): a third variant that differs from the first
    only in `sampler_name`.

## What the lesson checks
- On the canvas, by the app: the nodes and links of both variants (and the third), `cfg` from 3 to 5 on the first
  sampler (**Do this for me** sets 4) and from 7 to 9 on the second (8), every other setting of the second sampler the
  same as the first, the two savers with different names, and in the last step every setting of the third sampler the
  same as the first but `sampler_name`.
- From what it already reads: that ComfyUI was read, that `models/checkpoints` holds a file, that every node on the
  canvas is installed.
- Not checked: the run, the restart, `control_after_generate` (the app does not read that switch) and the pictures. The
  end of the lesson says **Run in ComfyUI: your own word** and **Result assessed: your own word**.

## Mistakes people make
- The two pictures differ in their whole layout: the seeds differ. Set them equal and set `control_after_generate` to
  `fixed` on both.
- The second run ends at once with the same pictures: that is ComfyUI reusing results. Restart ComfyUI.
- cfg and the prompt changed in one run: go back to one change.
- One variant saved over the other: give the savers different `filename_prefix` values.

## See also
- [How lessons work](How-Lessons-Work.md)
- [A quality rubric and a blind comparison](Blind-Compare.md)
- [Seed](../concepts/Seed.md)
- [CFG](../concepts/CFG.md)
- [Sampler](../concepts/Sampler.md)
