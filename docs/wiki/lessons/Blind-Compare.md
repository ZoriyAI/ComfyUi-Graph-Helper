[Русский](Blind-Compare.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# A quality rubric and a blind comparison

<!-- lesson: blind-compare -->
Lesson "blind-compare", in the group **Experiments and quality** of the lesson list. Level 2, core; tracks Base and
Pictures. It follows the new standard of lessons (standard 2).

## What you will be able to do
Choose between two variants by criteria written in advance, scored without knowing which variant is which.

## What you need
- [A controlled experiment: one change at a time](One-Factor.md): this lesson starts from its graph of two variants.
- Someone who can rename two files for you, or ten quiet minutes to do it yourself.
- Written for ComfyUI's core nodes, checked on 2026-11-15.

## The steps
1. **Pretty is not the same as right** (reading): decide what "good" means before you look; score without knowing
   which is which.
2. **Criteria before the run** (checklist): the task in one sentence, two to four criteria with what "no", "partly"
   and "yes" look like, and (optional) the time of each run.
3. **The first variant** and 4. **The second variant**: the graph of the lesson before. The second sampler keeps
   `seed`, `steps`, `sampler_name`, `scheduler` and `denoise` of the first; its `cfg` may differ.
5. **Names that hide the variants**: both savers write into one folder under names that say nothing, such as
   `blind/x` and `blind/y`.
6. **How to score blind** (reading): copy the pictures, have the copies renamed, score in an image viewer. A picture
   saved by Save Image carries its whole workflow, so it is not opened in ComfyUI before the scores are written.
7. **Run and hide** (checklist): the run, the neutral names, the time ComfyUI printed ("Prompt executed in …
   seconds"). Your own word.
8. **Score each picture** (rubric): the subject matches the prompt; defects; it fits the task; scored before the key
   was opened. The last criterion must be **Yes** to go on: a comparison is only fair blind.
9. **What a picture carries** (a check the app makes): open one of the pictures in the app with **File ▸ Open
   workflow…**. The app checks that the last file it opened was a picture with a workflow. When it cannot tell (the
   picture was opened before the app was started), **I checked it myself** counts it as your own word.
10. **Check yourself** (three questions): when the criteria are written, what blinding protects from, what decides a tie.
11. **On your own: two models** (your own checklist task): two of your picture models, three prompts, one seed, scored
    blind, with a small table of scores and times.

## What the lesson checks
- On the canvas, by the app: both variants, the same settings on the second sampler as on the first but `cfg`, both
  `filename_prefix` values in the folder `blind/` and different from each other.
- From what it already reads: that the last workflow it opened came from a picture.
- Not checked: the criteria you wrote, the run, the renaming, the time and every score. The end of the lesson says
  **Run in ComfyUI: your own word** and **Result assessed: your own word**. Nothing is uploaded, and the app does not
  judge a picture.

## Mistakes people make
- Criteria written after looking at the pictures: they tend to describe the one you already like.
- Knowing which file is which while scoring: copy the files and give the copies neutral names.
- Opening a copy in ComfyUI: a picture saved by Save Image shows its settings there.
- A tie decided by taste: with equal scores, the cheaper setting wins.

## See also
- [How lessons work](How-Lessons-Work.md)
- [A controlled experiment: one change at a time](One-Factor.md)
- [Workflow formats](../concepts/Workflow-Formats.md)
- [CFG](../concepts/CFG.md)
