[Русский](ComfyUI.ru.md)
[Home](../Home.md) › [Start](README.md)

# ComfyUI and where to get it

ComfyUI is a free program that makes pictures and video with AI models. You build the work as a graph: boxes
(nodes) joined by wires (links). NodeWise Studio teaches you to build and read those graphs; ComfyUI is the one that runs
them. You need both.

## What ComfyUI is

- It runs on your computer and uses your graphics card. A card with more memory runs larger models.
- You work with it in a web browser: ComfyUI starts a small web server, usually at `http://127.0.0.1:8188`.
- What it can do depends on the models and node packs you add to it. See [Checkpoint](../concepts/Checkpoint.md)
  and [Node packs](../concepts/Node-Packs.md).
- It is made by its own project, independent of NodeWise.

## Ways to get it

The official instructions are at [docs.comfy.org](https://docs.comfy.org/) (Installation), and the download page
is [comfy.org/download](https://www.comfy.org/download), the one the app's "No ComfyUI yet" window opens. In short,
as those pages name the ways in November 2026:

| Way | For | What it is |
|---|---|---|
| Comfy Desktop (the desktop app) | Windows, macOS, Linux | An installer that sets everything up. It answers at port 8000. |
| Portable | Windows | A folder you unpack and start. |
| Manual install | Linux, any system | Get the source with Git, install Python packages, start `main.py`. |
| comfy-cli | Linux, any system | A command line tool that installs and starts ComfyUI for you. |

On Linux, the manual way looks like this (the details for your graphics card are in the official instructions):

```bash
git clone https://github.com/Comfy-Org/ComfyUI.git
cd ComfyUI
python3 -m venv venv
. venv/bin/activate
# NVIDIA graphics card; for AMD, Intel or the processor alone take the line from the official instructions
pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu130
pip install -r requirements.txt
python main.py
```

The repository address and the `torch` line are as the official instructions give them in November 2026; the right
`torch` line changes with new versions, so check it there. NodeWise itself has not been tried with each of these
ways: see [Known limitations](../reference/Known-Limits.md).

With comfy-cli:

```bash
pip install comfy-cli
comfy install
comfy launch
```

## Find its address

When ComfyUI starts, it prints its address in the terminal, for example `To see the GUI go to:
http://127.0.0.1:8188`. Open it in your browser to check that ComfyUI works. That address is what NodeWise needs.

- On the same computer, the address is usually `http://127.0.0.1:8188`.
- To reach ComfyUI from another computer at home, start it with `--listen` (for example `python main.py --listen
  0.0.0.0`) and use that computer's address in the network, for example `http://192.168.1.50:8188`. Only do this on
  a network you trust: ComfyUI has no password.

How NodeWise connects is described in [Connecting to ComfyUI](../connect/Connecting.md).

## A first model

A fresh ComfyUI has no models. For a first picture you need one checkpoint (a main model file):

1. Download a checkpoint (a `.safetensors` file) of a family your graphics card can run. SD 1.5 models are the
   smallest; SDXL needs more memory. See [Model families](../concepts/Model-Families.md).
2. Put it into the folder `ComfyUI/models/checkpoints`.
3. In ComfyUI, refresh the page; in NodeWise, read ComfyUI again (Sync ▸ Sync now) so the library shows it.

Where every kind of file goes: [Where ComfyUI files live](../concepts/Where-Files-Live.md).

## Node packs

Many lessons and workflows use nodes that are not part of ComfyUI itself, for example WanVideoWrapper for video.
They come in node packs, which you install with ComfyUI Manager or by hand. NodeWise never installs them; it tells
you which pack a missing node belongs to when it knows. See [Node packs](../concepts/Node-Packs.md).

## See also

- [Start](README.md)
- [Quick start](Quick-Start.md)
- [Connecting to ComfyUI](../connect/Connecting.md)
- [Where ComfyUI files live](../concepts/Where-Files-Live.md)
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
