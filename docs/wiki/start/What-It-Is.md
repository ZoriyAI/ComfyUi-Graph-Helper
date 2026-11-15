[Русский](What-It-Is.ru.md)
[Home](../Home.md) › [Start](README.md)

# What the app is

NodeWise Studio is a desktop app for people who are learning ComfyUI. It shows what is in your ComfyUI, explains how a
graph works, and lets you build one by hand or with an assistant. It is a tutor, not a runner: it never runs a graph
and never changes your ComfyUI.

## Who it is for

- You installed ComfyUI and the screen full of nodes and wires means little to you yet.
- You found a workflow on the internet and want to know what each node does before you run it.
- You know the basics and want to try something new (video, LoRA, two models) with someone explaining each step.

You do not need to know programming. You do need a ComfyUI to learn on: on this computer or on another one at home.
See [ComfyUI and where to get it](ComfyUI.md).

## What it does

- **Reads your ComfyUI**: the node classes, the node packs, the model files and what is written next to them
  (trigger words, the base model, example pictures). The library on the left shows all of it.
- **A canvas** where you build a graph with the nodes you really have. Fields offer the values your ComfyUI accepts;
  a link only joins outputs and inputs of the same data type.
- **Explains** every node, input, output and link, and says where each explanation comes from.
- **Lessons** you do by hand on the real canvas: 79 built-in ones in twelve groups, and your own in My lessons. The
  app checks each step on the graph itself; no model is needed. File ▸ Examples opens the finished graph of a lesson.
- **An assistant** that answers questions (Ask), builds step by step and says why (Build), or leads a lesson
  (Learn). It answers with a cloud model or a model on your own computer.
- **A check** before saving: missing nodes and models, LoRAs that do not fit, empty fields, advice on prompts.
- **Workflows in and out**: open a workflow saved in ComfyUI, also from the pictures and videos ComfyUI saves; save
  one that ComfyUI opens as it was, except for what you changed.

## What it never does

- It never installs, downloads, deletes, writes or queues anything in ComfyUI. See
  [ComfyUI is only read](../trust/Read-Only.md).
- It never runs a graph. You open the saved workflow in ComfyUI and run it there:
  [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md).
- It never sends a key to an address other than the one you pasted it for, and has no telemetry and no crash reports;
  it asks about new versions only if you switch that on: [Privacy](../trust/Privacy.md).

## How it fits together

```
Your ComfyUI  ──(read only)──>  NodeWise  ──(you save a workflow)──>  a .json file  ──(you open it)──>  ComfyUI runs it
                                    │
                                    └── an assistant: a cloud model or a model on your own computer (optional)
```

## What you need

- A computer with Linux, 64-bit x86: a `.deb` (Ubuntu 22.04 or newer, Debian 12 or newer, Linux Mint 21 or newer),
  an `.rpm`, an AppImage or a `.tar.gz`. Windows and macOS are not supported; you may try
  [building from source](../dev/Building-From-Source.md), but nothing has been tried there.
- ComfyUI, running on this computer or on another one you can reach.
- For the assistant (optional): a key for a cloud model, which costs money per question, or a model server on your
  own computer such as Ollama. Lessons need neither.
- For saved keys (optional): a system keychain such as GNOME Keyring or KWallet.

## An experimental project

NodeWise is young. Things change between versions, some parts are unfinished, and there is no promise of support.
What is not done yet is listed in [Known limitations](../reference/Known-Limits.md). Ideas and wishes are welcome in
the project's Discussions; problems go to Issues (Help ▸ Report a problem in the app). Who makes the app and why:
[The author and the experiment](../trust/Author.md).

## See also

- [Start](README.md)
- [Quick start](Quick-Start.md)
- [The window at a glance](../interface/Window.md)
- [The assistant](../assistant/Assistant.md)
- [How lessons work](../lessons/How-Lessons-Work.md)
