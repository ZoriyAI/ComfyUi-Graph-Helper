[Русский](Build.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Build

In **Build** mode the assistant builds the graph on the canvas while you watch: it adds nodes, draws links, sets fields, and writes next to each node why it is there. "Builds on the canvas step by step and explains each step." Every build can be paused, stopped and undone in one step.

## How to ask for a build

1. Open the **Assistant** tab and choose **Build** under the conversation.
2. Write in **Ask for a graph change** what you want, for example "a picture from text with my SDXL checkpoint" or "add a LoRA to this graph". Press `Enter`.
3. Watch. Do not edit the canvas while it builds.

## What you see while it builds

- **On the canvas**: each new node fades in, each link is drawn, each changed field lights up, at the pace set in Settings ▸ Canvas (**Build pace, ms per step**, 820 ms by default). With **Follow the assistant** on, the view moves to each new node; any pan or zoom of yours stops following for now.
- **A bubble at the step**: its kind (**New node**, **New link**, **Field changed**), "9/16", what was done and why, for example "Link: Positive prompt → KSampler. What you want goes into the sampler's positive input."
- **A strip under the canvas toolbar**: "The assistant is building: step 3 of 8", with **Pause the build**, **Resume the build**, **Stop the build** and **Show all now** (skip the animation).
- **In the conversation**: **Build · 8 steps**, a list of the steps ("Added the node KSampler", "Link: Load Checkpoint → KSampler", "Field steps = 20 on KSampler"), each with **Show on the canvas**. **Why each step** shows the reason the assistant gave. Steps that did not work are marked "did not work", with the reason ("This node is not in your ComfyUI. Similar ones: …").
- **In the status bar**: "The assistant is changing the graph" with **Pause** and **Stop**.
- **On each node it touched**: a spark, "Changed by the assistant".

## When it ends

A **Build result**: "Done: 7 nodes, 9 links, 5 fields set." (or "Stopped: … What is done stays in the graph.") and **What next:** **Tour the graph**, **Check the graph**, **Save workflow…**. The canvas tidies the new nodes and fits the view.

## How to undo a build

One `Ctrl+Z` takes back the whole build: "Undo: the assistant's build (steps: 16)". It works only when the build has ended (stop it first), and only while the version of the graph before the build is still kept.

## Limits

- The assistant builds on the main canvas; if you are inside a subgraph, the canvas goes back to the main one.
- It uses only nodes and models your ComfyUI has. A node you do not have is refused, with similar names.
- A long build pauses at the step limit. See [Pausing and stopping](Pause-And-Stop.md).
- A model on your own server with a small context window may lose track in a long build. See [The context window](Context-Window.md).
- If the app is closed during a build: "The assistant's work stopped when the app was closed. What it had added stayed on the canvas (nodes: 4); undo takes it back in one step."

## See also

- [Pausing and stopping](Pause-And-Stop.md)
- [Ask](Ask.md)
- [The canvas toolbar](../interface/Canvas-Toolbar.md)
- [History and undo](../graph/History-And-Undo.md)
