Русская версия: [README.ru.md](README.ru.md)

# CozyGraph

**A desktop tutor for ComfyUI graphs**

CozyGraph is an independent, experimental learning tool. It is not affiliated with or endorsed by Comfy Org. It
contains no ComfyUI code and only reads a running ComfyUI; it never changes it.

An experimental desktop app that helps you learn ComfyUI and understand its graphs. Ideas and wishes are welcome in
[Discussions](../../discussions); problems go to [Issues](../../issues).

The app reads which nodes and models your ComfyUI has, explains every node and link, teaches with lessons you do by
hand, and has an assistant that can explain and build a graph step by step. It never runs or changes anything in
ComfyUI: what you build, you save as an ordinary workflow and open in ComfyUI yourself.

> **Experimental.** This is a young project. Things change between versions, some parts are unfinished, and there
> is no promise of support. It is useful today, and it is honest about its limits: see
> [Known limitations](docs/wiki/reference/Known-Limits.md).

<!-- screenshots: the pictures package inserts this section -->

## Install

On Linux (64-bit x86, a distribution with `.deb` packages such as Ubuntu 22.04 or newer, Debian 12 or newer,
Linux Mint 21 or newer):

1. Download the `.deb` file of the latest version from [Releases](../../releases).
2. Install it:

   ```bash
   sudo apt install ./cozygraph_*_amd64.deb
   ```
   <!-- verify: technical rename -->

3. Start "CozyGraph" from the menu, or run `cozygraph` in a terminal. <!-- verify: technical rename -->

Each release also has a `SHA256SUMS` file. To check the download: `sha256sum -c SHA256SUMS --ignore-missing`.

Updating is the same command with the new file; settings, keys and projects are kept. Removing, the data folder
and every other way to install: [Installing](docs/wiki/start/Installing.md).

### Windows and macOS: build from source

There are no ready packages for Windows or macOS. You can build and run the app from source:
[Windows](docs/wiki/dev/Building-On-Windows.md), [macOS](docs/wiki/dev/Building-On-macOS.md). These steps follow
from the project's build setup and have not been tested on those systems; please tell us in
[Issues](../../issues) what happens.

## Quick start

1. Have ComfyUI running. If you have none yet, see [ComfyUI and where to get it](docs/wiki/start/ComfyUI.md).
2. Start the app. The empty canvas shows three steps and marks the ones already done.
3. Connect ComfyUI and read it once: your nodes and models appear in the library on the left.
   <!-- verify: the connection steps are being rebuilt; the wiki page connect/Connecting is written last -->
4. Open the right panel, choose Learn and take the lesson "A first picture from text". No model is needed for lessons.
5. When the graph is ready: File ▸ Save workflow for ComfyUI…, then open that file in ComfyUI and run it there.

The whole path, step by step: [Quick start](docs/wiki/start/Quick-Start.md).

## What works today

- **Reading your ComfyUI.** Node classes, node packs, model files and what is written about them next to the files
  (LoRA trigger words, base model, example pictures). Only reading.
- **A canvas** for ComfyUI graphs: nodes with real fields (lists from your ComfyUI, numbers with their limits, model
  files with their family), links that check their data types, subgraphs edited from the inside, groups, an
  arrangement in one command, a history of versions with undo and redo.
- **Explanations** of every node, input, output and link, with their source shown: built-in, read from the files,
  from the internet, or written by you.
- **Twenty lessons** you do by hand on the real canvas, from a first picture to video with WanVideoWrapper. The app
  checks each step on the graph. No model is needed.
- **An assistant** in three modes: Ask (answers and grey drafts you accept), Build (builds on the canvas step by
  step and says why), Learn (the lessons). It answers with a cloud model (OpenAI, Anthropic, Google; you bring a
  key) or a model on your own computer (Ollama, LM Studio, vLLM or any OpenAI-compatible server).
- **A check** before saving: missing nodes and models, LoRAs that do not fit the checkpoint, empty fields, advice
  on descriptions.
- **Workflows in and out:** open a workflow saved in ComfyUI; save one for ComfyUI that comes back as it was except
  for what you changed. Project files keep your explanations too.
- **A conversation log** that shows what was sent to the model and what came back, without keys.
- Russian and English interface; Help with this documentation inside the app.

Known limits are listed on one page: [Known limitations](docs/wiki/reference/Known-Limits.md).

## What the app never does

- It never installs, downloads, deletes, writes or queues anything in ComfyUI.
- It never sends your keys anywhere except to the address you pasted them for.
- It has no telemetry, no crash reporting and no update check. Every place it can contact is listed in
  [Privacy](docs/wiki/trust/Privacy.md).

## Documentation

- [The documentation](docs/wiki/Home.md) (also in the app: Help ▸ User guide), in English and Russian.
- [Questions and answers](docs/wiki/start/FAQ.md), [Troubleshooting](docs/wiki/reference/Troubleshooting.md),
  [Glossary](docs/wiki/reference/Glossary.md).
- [Content rules](docs/wiki/trust/Content-Rules.md).
- [Privacy](docs/wiki/trust/Privacy.md) and [Security](SECURITY.md).
- [Changes](CHANGELOG.md).

## Taking part

Ideas, wishes and questions: [Discussions](../../discussions). Problems: [Issues](../../issues) (Help ▸ Report a
problem in the app fills in the versions for you). Code: [CONTRIBUTING.md](CONTRIBUTING.md) and
[the developer documentation](docs/wiki/dev/README.md). Everyone taking part follows the
[Code of Conduct](CODE_OF_CONDUCT.md).

**How this project is made.** Most of the code and the texts were written by AI coding agents, directed and reviewed
by the maintainer, who answers for everything that is published here.

## Licence

The source code is public under the MIT licence with the Commons Clause condition: you may use, change and share the
app for free, but you may not sell it or a product or service whose value comes mainly from it. See
[LICENSE](LICENSE), the explanation in plain words in [Licence](docs/wiki/trust/Licence.md), and for commercial use
[COMMERCIAL.md](COMMERCIAL.md). This is not "open source" in the usual sense of the word: it is source-available.
Third-party components keep their own licences: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
