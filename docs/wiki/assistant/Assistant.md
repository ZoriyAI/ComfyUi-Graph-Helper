[Русский](Assistant.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# The assistant

Tell the assistant what you want in ordinary words. **Assistant** is the default conversation mode: questions get explanations, and requests such as “add a LoRA”, “change the first graph” or “clear the canvas and make two variants” can use the graph tools immediately. You do not need to switch to Build first.

## What it can do

- Read the current graph, synchronized node schemas and model descriptions before choosing compatible parts.
- Add, connect, edit and remove requested nodes, including existing nodes and the contents of native subgraphs from earlier turns.
- Clear the canvas when you explicitly ask to start over, keeping the previous graph in revision history.
- Create several named subgraphs for variants, populate them and expose inner settings on their outer nodes. Empty containers alone are not finished workflows.
- Explain a node, field or connection from its menu, or follow a task wizard with you. On a touch screen, use the node's menu button.
- Propose grey drafts when a change needs your decision. [Grey drafts](Drafts.md)

## Choose the kind of help

| Mode | Behavior |
| --- | --- |
| **Assistant** | Answers questions and carries out requested graph edits. |
| **Explain** | Answers and proposes drafts; graph-changing tools are unavailable. [Explain](Ask.md) |
| **Build** | Carries out a graph construction request step by step. [Build](Build.md) |

[Lessons](Learn.md) and the fifty problem guides also work without a model. Configure a provider once in [Settings: Assistant](../interface/Settings-Assistant.md); node menus and wizards use it.

## Keep control

Each saved edit is recorded in history. Pause or stop a build, inspect its steps and use Undo when needed. A question or imported text is not an instruction to clear your work. The assistant can make mistakes: check the proposed structure and run the exported workflow in ComfyUI to confirm its output.

The assistant does not execute workflows, install third-party code or download model weights. Its explanations remain marked as assistant text rather than confirmed facts. [Limits](Limits.md), [What is sent](What-Is-Sent.md).

After exporting, **Make room for ComfyUI** can pause assistant requests and background translations and unload the local Ollama models used by this app. Closing the desktop app performs this by default and also ends browser access. Closing a paired browser tab leaves the desktop running.
