[Русский](First-Hour.ru.md)
[Home](../Home.md) › [Start](README.md)

# The first hour

What to do in the first hour with CozyGraph, in an order that never leaves you stuck. It assumes ComfyUI runs and
has at least one checkpoint model ([ComfyUI and where to get it](ComfyUI.md)).

## Look around (5 minutes)

- **The menu bar** at the top: File, Edit, View, Graph, Assistant, Sync, Help. `Alt` or `F10` moves into it from the
  keyboard. See [The menu bar](../interface/Menu-Bar.md).
- **The library** on the left: nodes, models and subgraphs. Empty until ComfyUI is read.
- **The canvas** in the middle, with its own toolbar of buttons.
- **The right panel**: the assistant, explanations, the check and lessons. `Ctrl+J` shows or hides it.
- **The status bar** at the bottom: how many nodes and links, the zoom, the version of the graph.

The whole window: [The window at a glance](../interface/Window.md).

## Follow the welcome card (10 minutes)

On an empty canvas the welcome card lists three steps and marks what is done.

1. **Connect ComfyUI** (the address you open ComfyUI at in the browser) and **Read ComfyUI**.
   When it is done, the card says "Read: N node types and M model files" and the library fills.
2. **Choose who answers**: the model that explains and builds. Skip it for now if you have none: lessons do not need
   it.
3. **Ask or build**: write what you want. This needs step 2.

The card also offers **Open a ComfyUI workflow** and **Learn to build it yourself**. See
[The welcome card](../interface/Welcome.md).

## Take a lesson (20 minutes)

Choose **Learn to build it yourself** on the card, or Assistant ▸ Lessons: build it yourself. Start with
**A first picture from text**. Each step says what to do and why; you do it on the canvas; the lesson sees it is done
and moves on. If a step does not pass, the lesson says in words what is missing. See
[How lessons work](../lessons/How-Lessons-Work.md).

Lessons are offered only when your ComfyUI has their nodes: a video lesson needs the video nodes.

## Read your graph (10 minutes)

- Click a node and look at the **Properties** panel: its fields, what each does.
- Right-click a node, an input or a link: the menu offers to explain it or ask the assistant about it.
- **Graph ▸ Guided tour** walks through the graph node by node with a sentence about each.
- **Graph ▸ Check graph** (`Ctrl+Shift+C`) lists what would stop ComfyUI from running it.

## Run it in ComfyUI (10 minutes)

**File ▸ Save workflow for ComfyUI…**, drag the file onto the ComfyUI page, press its run button. See
[Running the result in ComfyUI](../graph/Running-In-ComfyUI.md).

## Ask the assistant (optional)

With an assistant chosen, write a question in the right panel: "What does the KSampler do?" or "I want a picture
from text". In **Ask** mode it answers and may put grey drafts on the canvas that you accept or not; in **Build**
mode it builds step by step. See [The assistant](../assistant/Assistant.md).

## If something goes wrong

- Undo is always there: `Ctrl+Z`. Every change is a version of the graph you can go back to.
- [Troubleshooting](../reference/Troubleshooting.md) covers the usual problems.
- Help ▸ Copy diagnostics puts a report without keys on the clipboard, for a question in Discussions or an issue.

## See also

- [Start](README.md)
- [Quick start](Quick-Start.md)
- [Working with a graph](../graph/Working-With-A-Graph.md)
- [Glossary](../reference/Glossary.md)
