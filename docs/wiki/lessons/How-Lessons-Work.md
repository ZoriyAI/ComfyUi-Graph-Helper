[Русский](How-Lessons-Work.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# How lessons work

Choosing a lesson, following its steps, "Show me where" and "Do this for me".

## Opening Learn mode
Lessons live in the **Assistant** panel. Choose **Learn** next to Ask and Build under the message box, or **Assistant ▸ Lessons: build it yourself** in the menu. No assistant model is needed: lessons are built into the app and work offline.

Lessons are fitted to your ComfyUI: a lesson uses only nodes your ComfyUI has, with the inputs it names. So the app must have read your ComfyUI first. If it has not, the list says so and offers **Connect ComfyUI…**.

## The list
Each card shows the title, one line about what you end up with, **Steps: N**, and, for a lesson that stands on another one's graph, **Goes on from the lesson "…"**. A card has **Start**, **Go on** or **Go through it again**, and a **Done** mark once finished.

A lesson that needs nodes you lack says why: **This lesson does not fit your ComfyUI yet**, with the missing nodes and, for nodes from a pack, the pack's name. You install packs in ComfyUI yourself, then press **Sync ▸ Sync now**. The app never installs anything.

## Inside a lesson
- **Step N of M** and a list of all steps marked **done** and **now**.
- A **reading step** explains an idea; press **Understood, next**.
- A **doing step** asks for something on the canvas: add a node, drag a link, set a field. You do it by hand on the real canvas. The app watches the canvas and ticks the step off by itself the moment it is done.
- **Still to do** lists what is missing, in words: "There is no KSampler node on the canvas yet", "The input clip of … is empty. Drag a link to it from the output CLIP of …", "The field cfg of … is 8. Set it from 1 to 4".
- **Show me where** moves the canvas to the node or input the step is about.
- **Do this for me** does the step for you: adds the node, draws the link or sets the value.
- **Ask the assistant about this step** sends the step to the assistant (this one needs an assistant).
- If you undo or delete something a finished step needed, the lesson goes back to that step. If the canvas already holds part of the graph, the lesson skips the steps that are already done.
- Lessons follow the main canvas: inside a subgraph the lesson waits until you leave it.

## The end
**The lesson is done**: everything the lesson is about is on the canvas. From there: **Save workflow for ComfyUI…** to take the graph to ComfyUI and run it, or **Start the next lesson**. The app does not run the graph and does not download the model files a lesson names; you need them in your ComfyUI already. Each lesson's text says how to find the missing ones through an official ComfyUI template.

## See also
- [Lessons](README.md)
- [Learn mode](../assistant/Learn.md)
- [The lessons panel](../interface/Lessons-Panel.md)
- [Where ComfyUI files live](../concepts/Where-Files-Live.md)
- [Writing a lesson](../dev/Writing-A-Lesson.md)
