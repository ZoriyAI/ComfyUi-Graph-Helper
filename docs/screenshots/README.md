[Русский](README.ru.md)

# Screenshots

Every picture below is taken from the app itself by `npm run shots:public`, with test data only: a test ComfyUI
server and a scripted assistant, no real person's files. Window 1440 x 900.

## 01 First start

![The welcome card on an empty canvas](en/01-first-start.png)

A new person sees three steps (connect ComfyUI, choose who answers, ask or build) and what each one needs.

## 02 A graph, explained

![A text-to-picture graph with the sampler selected and its description open](en/02-canvas-explained.png)

Select any node and the app says what it is, why it is there, and shows its inputs, outputs and settings.

## 03 Library

![Node search with results and the card of a node](en/03-library.png)

The library lists the nodes and models your ComfyUI really has; a card explains a node before you add it.

## 04 Ask the assistant

![An answer with three grey drafts on the canvas](en/04-assistant-ask.png)

The assistant suggests nodes as grey drafts; nothing enters the graph until you accept it.

## 05 Build with the assistant

![A graph built step by step, each step with its reason](en/05-assistant-build.png)

In Build mode the assistant adds one node or link at a time and says why for every step.

## 06 Lessons

![The list of built-in lessons](en/06-lessons.png)

95 built-in lessons in sixteen groups need no model: you build by hand and the app checks each step on the canvas.
Each card says the lesson's level, its tracks and what it ends with.

## 07 A lesson step

![A lesson step with the link to make lit on the canvas](en/07-lesson-step.png)

A step says what to do and why, and "Show me where" lights the exact output and input on the canvas.

## 08 Check

![The Check tab with findings for an unfinished graph](en/08-check.png)

Check compares the graph with your installed nodes and models and says what is missing before you export.

## 09 Inside a subgraph

![The inside of a subgraph with its inputs and outputs](en/09-subgraph.png)

A subgraph opens on the canvas; its inputs and outputs are shown at the edges.

## 10 A large workflow

![A workflow of six variants in groups, seen from above](en/10-large-workflow.png)

A large workflow is shown from above in readable blocks; zoom in to see every field.

## 11 Settings: connection

![Settings, the connection to ComfyUI](en/11-settings-connection.png)

The app connects to ComfyUI read-only: nothing is installed, queued or changed there.

## 12 Settings: assistant

![Settings, the choice of assistant](en/12-settings-assistant.png)

Choose a cloud model with your key or a model on your own computer; lessons work without either.

## 13 Help

![The built-in user guide](en/13-help.png)

The user guide is built in and opens from the Help menu, also without the internet.

## 14 Lessons as a path

![The lesson list read as the path of one track, numbered](en/14-lesson-path.png)

**Show the lessons** reads the list by Topics, Levels, Tracks or as a Path: the recommended order for one track,
numbered. Every lesson stays open.

## 15 A step you answer

![A checklist step: one item the app sees, one ticked by the person, two still open](en/15-lesson-checklist.png)

A checklist step asks about things done outside the app. An item the app can read says "The app sees this"; your tick
says "Your own word".

## 16 What a lesson ends with

![The end of a lesson with its three outcomes and who stands behind each](en/16-lesson-outcomes.png)

A lesson ends with up to three outcomes: structure checked, run in ComfyUI and result assessed, each with who stands
behind it. The app runs nothing in ComfyUI and does not see your pictures.
