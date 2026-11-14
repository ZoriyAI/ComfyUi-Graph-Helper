[Русский](Working-With-A-Graph.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Working with a graph

A graph is a set of nodes joined by links: each node does one step, each link carries data from an output of one node to an input of another. ComfyUI runs the graph and makes a picture or a video. In this app you build and understand the graph; you run it in ComfyUI. This page is the path from an empty canvas to a workflow, with a link to each step.

## The path

1. **Start.** An empty canvas ([New project](New-Project.md)), a workflow you already have ([Opening a workflow](Opening-Workflows.md)), a lesson ([Learn](../assistant/Learn.md)) or a request to the assistant ([Build](../assistant/Build.md)).
2. **Add nodes.** From the library, the search or a model card. See [Adding nodes](Adding-Nodes.md).
3. **Connect them.** Drag from an output to an input of the same type. See [Connecting nodes](Connecting-Nodes.md).
4. **Set the fields.** Numbers, lists, the prompt, the model files. See [Node fields](Node-Fields.md) and [Choosing a model file](Model-Files.md).
5. **Tidy up.** [Arrange](Arranging.md) the graph, [group](Groups.md) parts of it, fold repeated parts into [subgraphs](Subgraphs.md), [describe](Notes-And-Descriptions.md) what each node is for.
6. **Understand it.** Take the [tour of the graph](Tour.md), read the [description cards](../interface/Description-Cards.md), ask the assistant about any part.
7. **Check it.** [Checking a graph](Checking-A-Graph.md) finds what ComfyUI would refuse.
8. **Save.** A [project file](Project-Files.md) keeps the explanations; a [workflow for ComfyUI](Saving-Workflows.md) is what ComfyUI opens.
9. **Run it in ComfyUI.** See [Running the result in ComfyUI](Running-In-ComfyUI.md), and [An error in ComfyUI](ComfyUI-Errors.md) when it complains.

Every change is a new version of the graph: you can always [undo it or look back](History-And-Undo.md).

## What the app never does

It never runs the graph, never installs a node pack, never downloads a model and never changes anything in ComfyUI. See [Read-only](../trust/Read-Only.md).

## See also

- [Nodes and links](../concepts/Nodes-And-Links.md)
- [The canvas](../interface/Canvas.md)
- [The first hour](../start/First-Hour.md)
