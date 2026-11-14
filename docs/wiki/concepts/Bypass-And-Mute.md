[Русский](Bypass-And-Mute.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Bypass and mute

Two ways to switch a node off without deleting it.

## In plain words
- **Bypass** (Ctrl+B in ComfyUI; the node turns purple): ComfyUI skips the node, and what comes into it goes straight out to the outputs of the same type. Bypass a LoRA loader and the model passes through unchanged; bypass an upscale step and the picture goes on at its old size. Good for "try without this step".
- **Mute** (Ctrl+M in ComfyUI; the node turns grey, mode "Never"): ComfyUI does not run the node at all. Mute an output node (Save Image, Save Video) and its whole branch stops running. Mute a node in the middle and the nodes after it lose their input, so ComfyUI reports a missing input.

Both are saved in the workflow file as the node's mode, so a shared workflow may arrive with switched-off parts. Templates often ship optional branches bypassed (for example a Load Image you enable for image to video).

## Typical uses
- Work on the first frame of a two-model graph while the video part is muted.
- Compare with and without a LoRA by bypassing it.
- Keep alternative branches in one workflow and switch between them.

## Typical mistakes
- Bypassing a node whose input and output types differ: there is nothing to pass through, and the next node gets no input.
- Forgetting a muted Save node: "nothing is saved".
- A shared workflow that "does nothing" because its output nodes arrived muted.

## How the app helps
The app shows the marks **Bypassed** ("ComfyUI skips this node: what comes in goes straight on to the outputs.") and **Muted** ("ComfyUI does not run this node.") on nodes from imported workflows, and keeps the mode when it saves.

## See also
- [Notes, reroutes and primitives](Notes-Reroutes-Primitives.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
- [Lesson: Two models in one graph](../lessons/Two-Models.md)
- [Working with a graph](../graph/Working-With-A-Graph.md)
