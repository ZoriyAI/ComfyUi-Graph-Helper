[Русский](First-Hour.ru.md)
[Home](../Home.md) › [Start](README.md)

# The first hour

What to do in the first hour with NodeWise Studio, in an order that never leaves you stuck. You can look around without
ComfyUI. Lessons and examples are fitted to your ComfyUI, so they need it read, with at least one checkpoint model
([ComfyUI and where to get it](ComfyUI.md)).

## The first start (2 minutes)

- **Language.** The app speaks your system's language: Russian on a Russian system, otherwise English. The welcome
  card has a language button in its top corner ("Русский" or "English"): it switches at once and is remembered.
  Settings ▸ Appearance & Motion ▸ Language does the same.
- **The tour of the window** starts by itself once: six stops, the menu, the library, the canvas, the toolbar, the
  right panel and the status bar. Next, Back, Done, or Skip the tour; `Esc` ends it. Help ▸ Tour of the window shows
  it again at any time.
- The library is open on the left (in a window at least 1180 pixels wide), and the right panel opens on the
  assistant.

The whole window: [The window at a glance](../interface/Window.md).

## The welcome card (10 minutes)

On an empty canvas the welcome card offers **Three ways to start**:

1. **Take a lesson** ▸ Choose a lesson. You build the graph yourself; the app leads you step by step and checks each
   step. No assistant is needed.
2. **Open an example** ▸ Open an example: the finished graph of a lesson, made of your own nodes and model files.
   Examples appear once the app has read your ComfyUI.
3. **Ask the assistant**: write what you want. Before an assistant is chosen, this button says **Choose an
   assistant…**.

Under them, **To get there** lists what these ways need, each with its one button:

- **Connect ComfyUI** ▸ Connect… opens Settings ▸ Connection. There, **Find on this computer** looks for ComfyUI at
  ports 8188 and 8000, or you type the address you open ComfyUI at in the browser. Save, then **Read ComfyUI**. The
  card then says "Read: N node types and M model files" and the library fills.
- **Choose the assistant** ▸ Choose…: a cloud model with your key, or your own model on this computer. Skip it for now
  if you have none: lessons and examples do not need it.

Then **Open a ComfyUI workflow**, your recent files, and **I have no ComfyUI yet**. When ComfyUI is read and the
assistant chosen, the card says "Your ComfyUI is read and the assistant is chosen…". See
[The welcome card](../interface/Welcome.md).

## I have no ComfyUI yet

The button opens a short card: what ComfyUI is, three steps to get it, and the buttons **Open the ComfyUI download
page**, **Find ComfyUI on this computer**, **Open the Ollama download page** (for an assistant on your own computer)
and **Glossary**. The two download pages open in your browser, only on a click. Meanwhile you can read the guide and
the glossary. [ComfyUI and where to get it](ComfyUI.md)

## Take a lesson (20 minutes)

Choose **Take a lesson** on the card, or Assistant ▸ Lessons: build it yourself. Start with **A first picture from
text** (in the group "Pictures: first steps"), or read the group "ComfyUI basics" first. Each step says what to do and
why; you do it on the canvas; the lesson sees it is done and moves on. If a step does not pass, the lesson says in
words what is missing. Words of the glossary are underlined with dots the first time they appear: point at one, or
reach it with `Tab`, to read its meaning. See [How lessons work](../lessons/How-Lessons-Work.md).

There are built-in lessons in groups by topic, and your own in My lessons. A lesson that needs nodes your ComfyUI
lacks says "This lesson does not fit your ComfyUI yet" and gives the reasons.

## Read your graph (10 minutes)

- Click a node and look at **Properties**: its fields and what each does. An "i" beside a field opens its note.
- Right-click a node, an input or a link: the menu offers to explain it or ask the assistant about it.
- **Graph ▸ Guided tour** walks through the graph node by node with a sentence about each.
- **Graph ▸ Check graph** (`Ctrl+Shift+C`) lists what would stop ComfyUI from running it, and marks those nodes.

## Run it in ComfyUI (10 minutes)

**File ▸ Save workflow for ComfyUI…** (`Ctrl+E`). The card **Run it in ComfyUI** opens: **Open ComfyUI**, drag the file
onto the ComfyUI page (or **Copy workflow**, then `Ctrl+V` on the ComfyUI canvas), and press Run there. If ComfyUI
shows an error, **Explain a ComfyUI error…** reads it and shows the node it names. See
[Running the result in ComfyUI](../graph/Running-In-ComfyUI.md).

## Ask the assistant (optional)

With an assistant chosen, write a question in the right panel: "What does the KSampler do?" or "I want a picture
from text". In **Ask** mode it answers and may put grey drafts on the canvas that you accept or not; in **Build**
mode it builds step by step. See [The assistant](../assistant/Assistant.md).

## If something goes wrong

- Undo is always there: `Ctrl+Z`. Every change is a version of the graph you can go back to.
- [Troubleshooting](../reference/Troubleshooting.md) covers the usual problems.
- Help ▸ Copy diagnostics puts a report without keys or addresses on the clipboard, for a question in Discussions or
  an issue.

## See also

- [Start](README.md)
- [Quick start](Quick-Start.md)
- [Working with a graph](../graph/Working-With-A-Graph.md)
- [Glossary](../reference/Glossary.md)
- No ComfyUI yet, or not sure it is set up well: the lessons of the group "Start and a reliable setup", from [Desktop, Portable, a manual install or Cloud](../lessons/Choose-Setup.md)
