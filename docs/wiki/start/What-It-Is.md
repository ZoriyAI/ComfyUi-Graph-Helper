[Русский](What-It-Is.ru.md)
[Home](../Home.md) › [Start](README.md)

# What the app is

NodeWise Studio is a workspace for creating ComfyUI graphs and learning how they work. Choose a result, build a graph manually, through a wizard or with an assistant, then save an ordinary workflow for ComfyUI.

## Who it is for

- Beginners: plain explanations, ready starting tasks and lessons with step checks.
- Workflow authors: import settings and connections, create subgraphs and processing variants, check dependencies and export.
- Teachers: create lessons and student materials, distinguishing structural checks from assessment of the resulting image.

Ordinary use does not require programming. Generation requires a running [ComfyUI](ComfyUI.md) with suitable models; the assistant requires a chosen local or cloud model.

## Getting started

1. [Install the app](Installing.md) and [connect ComfyUI](../connect/Connecting.md).
2. Choose a [task wizard](../graph/Task-Wizards.md), a first [lesson](../lessons/README.md), or open your own workflow.
3. Configure nodes, connections and models. The [assistant](../assistant/Assistant.md) can explain or carry out a request; history lets you undo its edits.
4. [Check the graph](../graph/Checking-A-Graph.md), save a workflow and [run it in ComfyUI](../graph/Running-In-ComfyUI.md).

For phone access, enable [Wi-Fi browser access](Browser-Access.md) on the computer. No separate mobile app is needed; keep the computer and NodeWise running.

## What is included

- 115 official blueprints from a pinned catalog revision: images, video, audio, 3D, text and combined stages.
- A subgraph constructor with inputs, outputs, exposed settings and editable inner nodes.
- 95 lessons in 16 groups and 50 guided routes through common difficulties.
- A model catalog, LoRA metadata and descriptions, rereading and synchronization repair explanations. Russian description translation uses the configured assistant.
- Help in node menus, touch controls, selected-file uploads, undo and edit history.
- Dependency checks and resource estimates, workflow export and releasing assistant model memory before a ComfyUI run.

## How the app accesses data

Catalog reads preserve ComfyUI models, extensions and queue. Selecting media explicitly uploads it to input without overwriting existing files. NodeWise does not install generated extensions or execute workflows: you review code and run the result in ComfyUI. [Access details](../trust/Read-Only.md).

Lessons, the manual canvas and wizards work without an AI model. The assistant contacts the server you choose; cloud providers may charge for requests. [Privacy](../trust/Privacy.md) describes sent data.

## What checks establish

Graph checks find structural problems and missing dependencies. They do not establish image quality, compatibility with every third-party extension or exact peak GPU usage. Those require a real run. [Known limitations](../reference/Known-Limits.md).

Linux x64 packages are available; Windows and macOS use scripts that build and install a specific release's source. [Installing](Installing.md). NodeWise is an independent, experimental project; [the author and principles](../trust/Author.md).
