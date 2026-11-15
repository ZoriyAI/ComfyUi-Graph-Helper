[Русский](How-Lessons-Work.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# How lessons work

Choosing a lesson, following its steps, what the app checks, "Show me where" and "Do this for me", and what comes
after the end.

## Opening Learn mode
Lessons live in the **Assistant** panel. Choose **Learn** next to Ask and Build under the message box, or
**Assistant ▸ Lessons: build it yourself** in the menu. No assistant model is needed: lessons are built into the app
and work offline. If a built-in lesson was open when you closed the app, it is on screen again when the app starts.

Lessons are fitted to your ComfyUI: a lesson uses only nodes your ComfyUI has, with the inputs it names. So the app
must have read your ComfyUI first. If it has not, the list says so and offers **Connect ComfyUI…**.

## The list
The list shows the built-in lessons by group, in a fixed order, and **My lessons** last (see
[My lessons](My-Lessons.md)). Each card shows the title, one line about what you end up with, **Steps: N**, and,
for a lesson that stands on another one's graph, **Goes on from the lesson "…"**. That is a hint, not a lock. A card
has **Start**, **Continue** or **Start over**, and a **Done** mark once finished.

A lesson that needs nodes you lack says why: **This lesson does not fit your ComfyUI yet**, with the missing nodes
and, for nodes from a pack, the pack's name ("It needs the node pack …"), or "It needs a newer ComfyUI". You install
nodes in ComfyUI yourself, then press **Sync ▸ Sync now**. The app never installs anything.

## Topics, levels, tracks and the path
Above the list, **Show the lessons** switches between four ways of reading it:
- **Topics**: the groups, as described above.
- **Levels**: every lesson has a level from 0 (setting up ComfyUI) to 5 (projects): 1 the graph basics, 2 reliable
  practice (memory, samplers, loaders, experiments), 3 pictures, video, sound and 3D, 4 the technical tracks. Only
  levels that have lessons are shown.
- **Tracks**: the lessons of one track (Base, Pictures, Video and VFX, Sound and 3D, LoRA training, API and automation,
  Making nodes, Projects). A track without built-in lessons yet says so.
- **Path**: the recommended order for one track: each lesson after the lessons it leans on, lower levels first, numbered,
  with what is done marked. It is a suggestion; every lesson stays open.

Under its title a card says the level, how central the lesson is (core, professional or in depth) and its tracks. A
lesson written to the new standard also has **About this lesson**: the skill it teaches, what it needs before, the
versions it was written for and the date it was checked, common mistakes with what to do, what the app does not check,
and where it comes from.

## The closed group for adults
The group **For adults (18+)** stands at the end of the list. While the switch **Adult content (18+)** in
**Settings ▸ Privacy** is off (it is off in a new profile), the group is one row with a lock, a line that says what
it holds and the button **Open the setting**. A lesson of this group cannot be started while the switch is off. See
[Content rules](../trust/Content-Rules.md).

## Inside a lesson
- **Step N of M** and a list of the steps marked **done** and **now**.
- A **reading step** explains an idea; press **Got it, next**.
- A **doing step** asks for something on the canvas: add a node, drag a link, set a field. You do it by hand on the
  real canvas. The app watches the canvas and ticks the step off by itself the moment it is done.
- **Still to do** lists what is missing, in words: "There is no KSampler node on the canvas yet", "The input clip of
  … is empty. Drag a link to it from the output CLIP of …", "The field cfg of … is 8. Set it from 1 to 4".
- When two nodes of one class are on the canvas, a node is named with the part it plays, for example
  "Load Diffusion Model (first pass)".
- **Show me where** moves the canvas to the node or input the step is about.
- **Do this for me** does the step for you: adds the node, draws the link or sets the value.
- **Ask the assistant about this step** sends the step to the assistant (this one needs an assistant).
- If the canvas already holds part of the graph, the lesson skips the steps that are already done. If something a
  finished step needed is undone or deleted, the lesson goes back to that step and says "Step N is not done any
  more: something on the canvas changed."
- Lessons follow the main canvas: inside a subgraph the lesson waits until you leave it.

## Steps you answer
Some lessons have steps that are not about the canvas. The app does not run anything in ComfyUI and does not see your
pictures, so these steps say plainly who stands behind each answer.
- **A checklist**: things to do outside the app, such as "I ran it, and both pictures appeared". You tick them. An item
  the app can see for itself (ComfyUI was read, a model file is in a folder) is ticked by the app and says **The app
  sees this**; while the app cannot tell, your tick counts as **Your own word**. **Clear my answers** takes the ticks
  back.
- **A rubric**: a question per criterion with two to four levels, for example "The subject matches the prompt: No,
  Partly, Yes". You pick a level; a low one shows what to try. A criterion may need a level to go on (a blind score must
  be blind). Only your choice is kept, on this computer.
- **Questions to check yourself**: one to five questions with choices. Any answer moves the lesson on; the explanation
  shows whether it was right.
- **A check the app makes**: a condition the app reads from what it already knows: that ComfyUI was read, that a node or
  a model file is there, that every node of the workflow on the canvas is installed, how many nodes the workflow has,
  that the last workflow you opened came from a picture or was in API format, whether the workflow has partner nodes.
  When the app cannot tell (not connected), **I checked it myself** lets you go on on your own word.
- **Your own task**: a canvas step or a checklist with no ready answer. It has no **Do this for me**, and what is still
  missing stays folded until you ask for it.

Your answers are kept with the lesson's progress. **Start over** clears them.

## What a step checks
- **The kind of model file.** A step that asks for a file checks what the file is, not only that one is chosen: its
  family (from what the app has read of the file, else from its name) and the marks in its name (`t2v` or `i2v`,
  `high_noise` or `low_noise`, `umt5`). A file of the wrong kind is named with the reason, for example "Its name has
  the mark i2v", and what the step needs. When no file of that kind is in the list, the line adds that the app
  downloads nothing: put the file into the models folder of ComfyUI, then choose **Sync ▸ Sync now**. The step does
  not count until the file fits.
- **A wrong number.** The line says what the field holds and the range, then one sentence of reason and "The step
  says N."
- **A number left as it was.** A value a fresh node starts with does not count when the step's text names another
  number, so the pack's default of 30 steps is not taken for the 20 the text asks.
- **Common slips** are named as such: the two prompts swapped, a similar node in place of the one the step needs
  (KSampler (Advanced) for KSampler), a frame count that is not 4n + 1, a copy of the prompt in the negative, a
  negation such as "no hat" in the prompt.
- **Advice.** Some rules only advise and do not hold the step back, such as the size a picture model was trained at
  in the first lesson.

## Do this for me
For a number, **Do this for me** sets the exact number the step's text names (`shift` 8, `length` 81, `cfg` 3.5,
`steps` 20), also when a fresh node started with another one. A number you chose yourself inside the allowed range
stays. For a file, it picks the first file of the right kind in the list; when there is none, it offers nothing and
the line says the file is missing.

## The end
**The lesson is done**: everything this lesson is about is on the canvas. A lesson that ends with more than a graph lists
what it ended with: **Structure checked** (checked by the app), **Run in ComfyUI** (your own word, or checked by the app
where it can read it) and **Result assessed** (your own word), and says that the app ran nothing and did not see your
pictures. The cards in the list show the same marks. From there: **Save workflow for
ComfyUI…** to take the graph to ComfyUI and run it, or **Start the next lesson**. The app does not run the graph and
does not download the model files a lesson names; you need them in your ComfyUI already. The texts of each lesson
say which files, which folders, and which official ComfyUI template names them.

A finished lesson stays **Done** in the list, also when a later lesson rewires its graph. **Start over** begins it
again from step 1.

## The next lesson
The lesson offered at the end is the next one in the list, in the order of the groups, that is not done yet and
fits your ComfyUI, preferably one whose earlier lessons are done and that is at most one level above the lesson just finished. A lesson for adults is never offered after an
ordinary one, nor an ordinary one after a lesson for adults. After the last lesson of the list nothing is offered.

## See also
- [Lessons](README.md)
- [My lessons](My-Lessons.md)
- [The lesson file format](Lesson-File-Format.md)
- [Learn mode](../assistant/Learn.md)
- [The lessons panel](../interface/Lessons-Panel.md)
- [Where ComfyUI files live](../concepts/Where-Files-Live.md)
- [Writing a lesson](../dev/Writing-A-Lesson.md)
