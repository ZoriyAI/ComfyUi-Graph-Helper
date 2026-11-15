[Русский](Lessons-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The lessons tab

The lessons are the **Learn** mode of the **Assistant** tab. Instead of the conversation the tab shows the list of lessons, or the lesson you are in. You build the graph by hand on the real canvas; the app says what to do and why, shows where, and sees from the canvas when a step is done. No model is needed. What each lesson teaches is in [Lessons](../lessons/README.md).

<!-- picture: a lesson step with Still to do, Show me where and Do this for me -->

## How to open it

- **Learn** in the mode switch of the Assistant tab.
- **Assistant ▸ Lessons: build it yourself**.
- **Take a lesson** ▸ **Choose a lesson** on the welcome card.

If a lesson was open when the app closed, the tab opens on it at the next start.

## The list

The 45 lessons are arranged in six topic groups. Each group heading says how many of its lessons are done ("3 of 8 done"). Each card shows the title, what you build, the step count beside its one button, and the lessons it goes on from as quiet links. A link scrolls to that card; you do not have to finish it first. The button is **Start**, **Continue** for a lesson you began, or **Start over** for one marked **Done**. A finished lesson stays **Done** even when a later lesson rewires the graph.

At the end of the list:

- **For adults (18+)**: while the switch **Adult content (18+)** in Settings ▸ Privacy is off, this is one closed row with a lock: "Lessons about adult content: pictures, LoRAs and video. They open with the switch “Adult content (18+)” in Settings ▸ Privacy." and **Open the setting**. See [Settings: Privacy](Settings-Privacy.md#adult-content).
- **My lessons**: lessons you made here, imported from a file, or drafted by the assistant. See below.

A lesson that your ComfyUI cannot do shows its first reason; the rest are under **More reasons**: "This lesson does not fit your ComfyUI yet.", "It needs the node pack … Missing nodes: …", "It needs a newer ComfyUI.", and "You install nodes in ComfyUI yourself, then press Sync ▸ Sync now. The app never installs anything." with a warning that a node pack runs its own code on your computer. Before ComfyUI is read: "Lessons are fitted to your ComfyUI: they use only the nodes it has. Connect ComfyUI and read it first." with **Connect ComfyUI…**.

## A lesson

- A compact head: the back button (**All lessons**), the title of the lesson and "Step 2 of 11" with a thin progress bar.
- The step card: what to do, why, and a box **Still to do** that says in words what is missing, for example "There is no Load Checkpoint node on the canvas yet." or "The input model of "KSampler" is empty. Drag a link to it from the output MODEL of "Load Checkpoint"."
- The place the step is about stands out on the canvas and the rest of the graph dims. When the step is passed, what passed it flashes and the view goes on to the next place.
- **Show me where** lights up the place on the canvas and rings the node. **Do this for me** does the step, where the choice is not yours to make: it sets the number the step names, or picks the first file of the right kind.
- A file of the wrong kind, a number outside what the step asks, two prompts swapped or a similar but wrong node are each explained in one line under **Still to do**. When the list has no fitting file, the app says that it downloads nothing: put the file into the models folder of ComfyUI, then choose Sync ▸ Sync now.
- If something on the canvas undoes a finished step: "Step 2 is not done any more: something on the canvas changed."
- The first mention of each glossary word in a step is underlined with dots; hover over it or reach it with `Tab` to read what it means.
- A step that only explains has **Got it, next**.
- **Ask the assistant about this step** sends the step to the assistant as a question (this needs a model).
- **Steps of the lesson** lists the steps near the current one, each "done" or "now"; steps still to come are hollow dots. **All steps (N)** shows the whole list. **To the current step** comes back from an earlier one.
- At the end: "The lesson is done. Everything this lesson is about is on the canvas.", "N of N" with a full bar, **Save workflow for ComfyUI…** and **Start the next lesson** (the next lesson of the list that fits your ComfyUI and whose earlier lessons are done; never a lesson for adults).

Lessons follow the main canvas: inside a subgraph the tab says "Lessons follow the main canvas. Leave the subgraph to go on."

## My lessons

- **Make from this graph** (or **File ▸ Make a lesson from this graph**) opens the lesson editor: an intro step and one step per node, in the order the data flows. Edit the title, **What the person ends up with**, the language of the texts, the switch **Adult content (18+)**, each step's title and text, and **This value matters** for each value. **Try the lesson** plays it from an empty canvas ("The lesson can be done from an empty canvas."); **Save to My lessons** keeps it.
- **Import…** (or **File ▸ Import lessons…**, or a lesson file dropped on the list: "Drop to import the lessons") adds lessons from a `.lesson.json` file. A message says how many came in, or why the file was refused.
- The export icon on every card and beside every group title writes a `.lesson.json` file.
- Each of your lessons shows where it came from: **Made here**, **From a file** or **Drafted by the assistant**, with buttons to edit, export, mark as 18+ and remove.
- A shared lesson is data only: it cannot run code, open a link, download anything or make the app call ComfyUI. "Shared lessons follow the content rules of the app." with **Content rules**. See [Content rules](../trust/Content-Rules.md).


## See also

- [Learn](../assistant/Learn.md)
- [How lessons work](../lessons/How-Lessons-Work.md)
- [The assistant tab](Assistant-Panel.md)
