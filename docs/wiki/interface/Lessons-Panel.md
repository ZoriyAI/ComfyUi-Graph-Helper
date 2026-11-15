[Русский](Lessons-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The lessons tab

The lessons are the **Learn** mode of the **Assistant** tab. Instead of the conversation the tab shows the list of lessons, or the lesson you are in. You build the graph by hand on the real canvas; the app says what to do and why, shows where, and sees from the canvas when a step is done. No model is needed. What each lesson teaches is in [Lessons](../lessons/README.md).

<!-- picture: a lesson step with Still to do, Show me where and Do this for me -->

## How to open it

- **Learn** in the mode switch of the Assistant tab.
- **Assistant ▸ Lessons: build it yourself**.
- **Learn to build it yourself** on the welcome card.

## The list

The 45 lessons are arranged in six topic groups with counts. Each card shows the title, what you build, step count and links to all related lessons. A related link scrolls to that card; completion is not required. The main button is **Start**, **Go on** for a lesson you began, or **Go through it again** for one marked **Done**.

A lesson that your ComfyUI cannot do says why: "This lesson does not fit your ComfyUI yet.", "It needs the node pack … Missing nodes: …", "It needs a newer ComfyUI.", and "You install nodes in ComfyUI yourself, then press Sync ▸ Sync now. The app never installs anything." Before ComfyUI is read: "Lessons are fitted to your ComfyUI: they use only the nodes it has. Connect ComfyUI and read it first." with **Connect ComfyUI…**.

## A lesson

- **All lessons** goes back to the list. The title of the lesson and "Step 2 of 11" with a progress bar.
- The step card: what to do, why, and a box **Still to do** that says in words what is missing, for example "There is no Load Checkpoint node on the canvas yet." or "The input model of "KSampler" is empty. Drag a link to it from the output MODEL of "Load Checkpoint"."
- **Show me where** lights up the place on the canvas. **Do this for me** does the step, where the choice is not yours to make.
- A step that only explains has **Understood, next**.
- **Ask the assistant about this step** sends the step to the assistant as a question (this needs a model).
- **Steps of the lesson** lists all steps, each "done" or "now". **To the current step** comes back from an earlier one.
- At the end: "The lesson is done. Everything this lesson is about is on the canvas.", **Save workflow for ComfyUI…** and **Start the next lesson**.

Lessons follow the main canvas: inside a subgraph the tab says "Lessons follow the main canvas. Leave the subgraph to go on."


## See also

- [Learn](../assistant/Learn.md)
- [How lessons work](../lessons/How-Lessons-Work.md)
- [The assistant tab](Assistant-Panel.md)
