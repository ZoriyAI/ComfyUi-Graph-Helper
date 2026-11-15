[Русский](Notes-Reroutes-Primitives.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Notes, reroutes and primitives

Helper nodes that do no image work but make a graph readable and easier to control.

## Note and Markdown Note
A **Note** is a text box on the canvas; **Markdown Note** allows headings, lists and links. They do nothing when the graph runs. Template authors use them for "which files you need and where to put them", and for instructions. Read them first when you open someone's workflow.

## Reroute
A **Reroute** is a small dot that passes one link through unchanged. It keeps long links tidy, lets one output fan out from a convenient place, and takes the type of what is connected to it. It changes nothing in the result.

Some packs offer "Set" and "Get" nodes that carry a value by name instead of by a visible link; they make a graph tidy but hide where data flows.

## Primitive
A **Primitive** holds one value (a number, text or choice) and feeds it to a field that has been turned into an input. Connect one Primitive to the `seed` of three samplers and they always share a seed; connect one to `width` of several nodes and they share a size. It has its own `control_after_generate` when it holds a number.

The Primitive exists only in the ComfyUI editor. In the API format that ComfyUI actually runs, its value is written straight into the nodes it feeds. Newer ComfyUI also has ordinary "primitive" value nodes (Int, Float, String, Boolean) that do appear in the API format.

## Groups
A **group** is a coloured frame with a title around several nodes. It moves its nodes together and can be bypassed or muted as a whole in ComfyUI. It does not change how the graph runs.

## Typical mistakes
- Deleting a Reroute and leaving two halves of a link unconnected.
- Changing a field on a node that is fed by a Primitive: the Primitive's value wins.
- Ignoring the notes of a template and then missing a model file.

## How the app helps
The app draws notes, reroutes, primitives and groups from imported files and explains them in the **Explain** tab like any other node. The lessons [Reading someone else's workflow](../lessons/Reading-A-Workflow.md) and [Two versions of a prompt with one switch](../lessons/Prompt-Switch.md) use primitives.

## See also
- [Nodes, inputs, outputs and links](Nodes-And-Links.md)
- [Bypass and mute](Bypass-And-Mute.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
- [Notes and descriptions in the app](../graph/Notes-And-Descriptions.md)
- [Groups](../graph/Groups.md)
