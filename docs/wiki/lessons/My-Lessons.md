[Русский](My-Lessons.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# My lessons

The group **My lessons** stands last in the lesson list. It holds the lessons you make from a graph, the ones you
import from a lesson file and the drafts of the assistant you keep. They run like the built-in lessons.

## Make a lesson from a graph
Build the graph first: it becomes the goal of the lesson. Then choose **File ▸ Make a lesson from this graph**, or
the button **Make from this graph** in the group **My lessons**. On an empty canvas the editor says: "The canvas is
empty. Build the graph first, then make a lesson from it."

The editor, **New lesson from the graph**, opens in the Lessons panel. It proposes a first step that only explains
and then one step per node, in the order a person builds: a node comes only after every node that feeds it. Each
step adds its node, makes the links into it and sets the values that matter.

## The editor
- **Title** and **What the person ends up with**: the two lines a card shows.
- **Language of the texts**: **English** or **Russian**.
- **Adult content (18+)**: the lesson stays behind the switch of that name.
- Each step: **Step title**, **What to do and why**, and below them what the step checks ("Adds …", "Links …",
  "`field` of …: from 1 to 4").
- **This value matters**: a box next to each value of the node. Only a value that matters is checked. By default
  the model file and the multi-line texts matter.
- **Move the step up**, **Move the step down**, **Remove the step**.

Every step needs a title, and the lesson needs one too.

**Add a self-check** adds a checklist step: things to do outside the app, one per line (for example "I saved the
workflow for ComfyUI and ran it there"). The person ticks them; a tick is their own word. A lesson imported or drafted
with a rubric, questions to check yourself or a check the app makes keeps those steps as they are; the editor shows
how many criteria or questions they have and lets you change only the title and the words of such a step. See
[The lesson file format](Lesson-File-Format.md).

## Try and save
**Try the lesson** plays the lesson from an empty canvas, the way **Do this for me** would. It answers "The lesson
can be done from an empty canvas." or names the step that cannot be done and why: none of the nodes it asks for
is there, what it asks for never holds, or it never comes to an end.

**Save to My lessons** tries the lesson again and keeps it. Every lesson in **My lessons** has an **Edit** button
that opens it in the same editor.

## Import
Choose **File ▸ Import lessons…**, press **Import…** in the group, or drop a lesson file on the lesson list (the
list says "Drop to import the lessons"). A message says how many lessons were imported, how many you already had
and were updated, or why the file was not taken, naming the lesson and the step.

- A file comes in whole or not at all.
- A lesson with the id of one you already have updates it. A mark for adults you set yourself stays.
- Each lesson is tried from an empty canvas before it is kept.
- My lessons hold at most 500 lessons.

The format and what the app checks are on [The lesson file format](Lesson-File-Format.md).

## Export
Every lesson card, built-in or yours, has an export button (**Export lesson**), and so has every group title
(**Export group**). It saves a `.lesson.json` file through the save dialog. A whole group becomes one file. A file
the app exported always imports again.

## The list
Each card of the group shows where the lesson came from: **Made here**, **From a file** (the file name shows when
you hover), or **Drafted by the assistant**. It has buttons to edit, export, mark it as adult content (18+) and
**Remove**. Remove asks "Remove “…” from My lessons?" with **Remove** and **Keep**.

The lessons are files in the `lessons` folder of your profile and stay after a restart. A lesson marked as adult in
its file, or by you, is shown only while **Adult content (18+)** is on in **Settings ▸ Privacy**; while it is off,
such lessons are one closed row.

While one of your lessons runs, the panel shows where it came from, its author and source as plain text, the
warning for an assistant's draft, and "Shared lessons follow the content rules of the app." with the button
**Content rules**, which opens [Content rules](../trust/Content-Rules.md).

## The assistant's draft
Ask the assistant for a lesson and it uses its tool **Draft a lesson**. The chat shows a card with the title, the
number of steps, "Drafted by the assistant: check it before you share it." and how it was tried: with the nodes of
your ComfyUI, or only with the nodes the lesson names when your ComfyUI was not read. **Keep in My lessons** keeps
it; **Discard** drops it. Nothing is kept until you choose. After a restart the card says the draft is no longer
available.

## What a shared lesson can never do
A lesson file is data only: ids, texts and the same checks the built-in lessons use. So a lesson from anyone:
- runs no code;
- opens no link: its text is shown by a reader that opens nothing;
- makes the app call ComfyUI or download nothing;
- writes nothing but its own file in the `lessons` folder of your profile, under a name made from its own checked
  id;
- never replaces a built-in lesson: its id in the app is `my:` and its own id;
- brings no sentence of its own into the reasons of "Still to do": it can only point to a reason the app wrote.

## See also
- [The lesson file format](Lesson-File-Format.md)
- [How lessons work](How-Lessons-Work.md)
- [Content rules](../trust/Content-Rules.md)
- [Lessons](README.md)
