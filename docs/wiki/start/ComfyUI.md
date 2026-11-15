[Русский](ComfyUI.ru.md)
[Home](../Home.md) › [Start](README.md)

# ComfyUI and where to get it

ComfyUI is a free program that makes pictures and video with AI models. You build the work as a graph: boxes
(nodes) joined by wires (links). CozyGraph teaches you to build and read those graphs; ComfyUI is the one that runs
them. You need both.

## What ComfyUI is

- It runs on your computer and uses your graphics card. A card with more memory runs larger models.
- You work with it in a web browser: ComfyUI starts a small web server, usually at `http://127.0.0.1:8188`.
- What it can do depends on the models and node packs you add to it. See [Checkpoint](../concepts/Checkpoint.md)
  and [Node packs](../concepts/Node-Packs.md).
- It is made by its own project, independent of CozyGraph.

## Ways to get it

The official instructions are at [docs.comfy.org](https://docs.comfy.org/) (installation). In short:
<!-- verify: the names of the official installers and the address of the instructions -->

| Way | For | What it is |
|---|---|---|
| ComfyUI Desktop | Windows, macOS | An installer that sets everything up. |
| Portable package | Windows | A folder you unpack and start. |
| Manual install | Linux, any system | Get the source with Git, install Python packages, start `main.py`. |
| comfy-cli | Linux, any system | A command line tool that installs and starts ComfyUI for you. |

On Linux, the manual way looks like this (the details for your graphics card are in the official instructions):

```bash
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
python3 -m venv venv
. venv/bin/activate
pip install torch torchvision torchaudio   # the right command for your graphics card is in the official instructions
pip install -r requirements.txt
python main.py
```

<!-- verify: the repository address of ComfyUI and the torch install line -->

With comfy-cli:

```bash
pip install comfy-cli
comfy install
comfy launch
```

## Find its address

When ComfyUI starts, it prints its address in the terminal, for example `To see the GUI go to:
http://127.0.0.1:8188`. Open it in your browser to check that ComfyUI works. That address is what CozyGraph needs.

- On the same computer, the address is usually `http://127.0.0.1:8188`.
- To reach ComfyUI from another computer at home, start it with `--listen` (for example `python main.py --listen
  0.0.0.0`) and use that computer's address in the network, for example `http://192.168.1.50:8188`. Only do this on
  a network you trust: ComfyUI has no password.

How CozyGraph connects is described in [Connecting to ComfyUI](../connect/Connecting.md).

## A first model

A fresh ComfyUI has no models. For a first picture you need one checkpoint (a main model file):

1. Download a checkpoint (a `.safetensors` file) of a family your graphics card can run. SD 1.5 models are the
   smallest; SDXL needs more memory. See [Model families](../concepts/Model-Families.md).
2. Put it into the folder `ComfyUI/models/checkpoints`.
3. In ComfyUI, refresh the page; in CozyGraph, read ComfyUI again (Sync ▸ Sync now) so the library shows it.

Where every kind of file goes: [Where ComfyUI files live](../concepts/Where-Files-Live.md).

## Node packs

Many lessons and workflows use nodes that are not part of ComfyUI itself, for example WanVideoWrapper for video.
They come in node packs, which you install with ComfyUI Manager or by hand. CozyGraph never installs them; it tells
you which pack a missing node belongs to when it knows. See [Node packs](../concepts/Node-Packs.md).

## See also

- [Start](README.md)
- [Quick start](Quick-Start.md)
- [Connecting to ComfyUI](../connect/Connecting.md)
- [Where ComfyUI files live](../concepts/Where-Files-Live.md)
- [Graphics card memory](../concepts/Graphics-Card-Memory.md)
