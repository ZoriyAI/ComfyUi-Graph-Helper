[Русский](Queue-History.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Run, queue, history and cancel

<!-- lesson: queue-history -->
Lesson "queue-history", in the group **The daily work cycle** of the lesson list. Level 1, core; track Base. It follows
the new standard of lessons (standard 2).

## What you will be able to do
Queue several runs on purpose, cancel the one you do not need, and find a finished run with its settings in the history.

## What you need
- [A first picture from text](Image.md), or the same graph built by hand.
- A ComfyUI you can run, with one picture model in `models/checkpoints`.
- Written for ComfyUI's core nodes and its interface as documented in November 2026, checked on 2026-11-15.

## The steps
1. **Run puts a job into a queue** (reading): the states of a job, and why pressing Run again adds a job that ends at once.
2. **Before you start** (checklist): ComfyUI read and a picture model there (the app sees both), the versions written
   down (your own word).
3. **A graph to queue**: the picture graph with a Save Image.
4. **A folder for the runs**: a `filename_prefix` that starts with `queue/`.
5. **Every node is in your ComfyUI** (a check the app makes).
6. **Where to watch the queue** (reading): the run bar with **Run** and **Cancel**, Shift for the front of the queue,
   the modes "Run", "Run (On Change)" and "Run (Instant)", the counter of active jobs, and **Job History** with its job
   menus. In some versions Job History needs the setting "Docked job history/queue panel".
7. **Queue three jobs** (checklist): three jobs with three prompts; the counter goes down.
8. **Cancel one, stop one** (checklist): "Cancel job" on a waiting job, "Cancel" or Ctrl+Alt+Enter on the running one,
   and the state of each of the six jobs.
9. **Find a run again** (checklist): a finished job found by its picture, opened with "Open as workflow in a new tab",
   its prompt and seed read, its file found.
10. **How did it go?** (rubric): the state of every job, the run restored, how often Run was pressed blind.
11. **Check yourself** (three questions): Run with nothing changed, what clearing the queue removes, how to put a job
    first.
12. **On your own: a series** (your own task): four seeds, the needless jobs cancelled, the best one's seed written down.

## What the lesson checks
- On the canvas, by the app: the picture graph and the folder `queue/`.
- From what it already reads: that ComfyUI was read, that `models/checkpoints` holds a file, that every node is installed.
- Not checked: the queue, the history, the cancelling and the runs. They are your own word.

## Mistakes people make
- Three presses of Run, one picture: nothing changed between them, so ComfyUI reused its result.
- ComfyUI keeps starting runs: the Run button is in "Run (Instant)" or "Run (On Change)".
- The queue was cleared and the running job went on: clearing removes only waiting jobs; "Cancel" stops the running one.
- No Job History: turn on "Docked job history/queue panel" (Settings, Comfy, Queue), or use the queue panel of an older
  version (key Q).

A run with partner nodes, the paid nodes that run on an outside service, costs credits each time it is queued: cancel
early what you do not need.

## Sources
The run bar, its modes and the counter: docs.comfy.org, Interface, Overview. Job History, its tabs, job menus, "Clear
queue" and "Clear history": docs.comfy.org, Interface, Job History. Ctrl+Enter, Ctrl+Shift+Enter, Ctrl+Alt+Enter and the
key Q: the ComfyUI README. Reuse of results: the ComfyUI README and the official custom node documentation.

## See also
- [How lessons work](How-Lessons-Work.md)
- [Templates: from a ready workflow to your own](Template-Own.md)
- [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md)
