[Русский](Node-Packs.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Node packs

Custom nodes made by other people: what they are, how people install them, and the risk of running someone else's code.

## In plain words
ComfyUI ships with built-in ("core") nodes. Everything else comes in **node packs** (custom nodes): folders of Python code in `custom_nodes/` that add new nodes when ComfyUI starts. Thousands exist: new model families before core supports them (WanVideoWrapper), preprocessors (comfyui_controlnet_aux), GGUF loaders, video helpers, utilities.

## How people install them
- **ComfyUI Manager** (built into ComfyUI Desktop and recent versions, or installed as a pack itself): search the registry, install, restart ComfyUI. It can also install the packs a loaded workflow is missing.
- **comfy-cli**: `comfy node install <name>`.
- **By hand**: `git clone` the pack into `custom_nodes/`, install its Python requirements into ComfyUI's own Python, restart.

After installing, restart ComfyUI so the new nodes load. Then, in this app, choose **Sync ▸ Sync now** so the library and the lessons see them. The app never installs anything.

## The risk
A node pack is a program. It runs with the same rights as ComfyUI on your computer: it can read and write your files, reach the network and install more software. A malicious or careless pack can do damage, and there have been real cases of packs that stole data.
- Prefer well-known packs with many users and an active repository.
- Install from the official registry through ComfyUI Manager, which has security levels and flags known bad packs.
- Be wary of a workflow that asks for many unknown packs.
- Keep ComfyUI and packs updated, and remove packs you do not use.
- Run ComfyUI in a separate environment (a virtual environment, a container or another user account) if you try many packs.

## Typical mistakes
- Red or missing nodes after opening a workflow: its packs are not installed, or failed to import (see ComfyUI's start-up log, "IMPORT FAILED").
- Two packs that break each other's Python requirements: one of them stops loading.
- Expecting a pack's nodes to connect to core nodes: some use their own types.

## How the app helps
- The **Library** groups nodes into **Core** and **Node packs**.
- A lesson that needs a pack says **It needs the node pack …** and names missing nodes.
- **Check** lists nodes that are not installed in your ComfyUI, with the class to look for.

## See also
- [Where ComfyUI files live](Where-Files-Live.md)
- [Unsafe model formats](Unsafe-Model-Formats.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
- [The node library](../interface/Node-Library.md)
- [Security](../trust/Security.md)
