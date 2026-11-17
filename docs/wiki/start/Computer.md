[Русский](Computer.ru.md)
[Home](../Home.md) › [Start](README.md) › Computer

# What can my computer do?

Choose **What can my computer do?** on the welcome screen, or open **Settings → Computer**. This check reads the computer running NodeWise. ComfyUI and an AI model are not required. From a paired phone it still reads that computer, not the phone.

The report explains the processor, available RAM, each detected graphics card and space on the drive holding NodeWise data. GPU memory is measured for NVIDIA cards when their driver reports it. Other systems may report a card name without memory figures; missing data does not mean a missing card. Apple Silicon uses shared system memory. Several cards are kept separate: their memory is not automatically combined.

**Refresh measurements** updates the figures at most once every ten seconds. The check does not start a model, install software or stop another application. Free memory changes as other applications work. The drive holding your models may differ from the drive in this report.

## Choose a first useful result

- Classroom materials, built-in lessons and graph editing can be used without ComfyUI. Manual preparation does not need a model.
- For image generation, start with one small official workflow and one image per batch. The report’s six-GiB starting threshold is a heuristic, not a requirement or a compatibility guarantee.
- If memory is already occupied, review **Settings → Services** or the assistant’s memory controls before a demanding run. Do not stop a service that is doing work you need.
- For video or several models, connect ComfyUI and inspect the actual graph’s resources. Model families, precision, image dimensions, frames and offloading affect memory; a successful test run is still needed.

## Install ComfyUI when you need generation

The report links to the official Windows, Apple Silicon macOS or manual installation instructions for the host. Follow the guide, choose a drive with space for models, start ComfyUI and try an official example there. Then open **Connection settings**, check its address and synchronize the node/model catalog.

For ComfyUI on another machine, the host report is not its hardware report. The graph’s resource check reads the connected ComfyUI’s statistics separately.

Official references: [downloads](https://www.comfy.org/download), [Windows](https://docs.comfy.org/installation/desktop/windows), [macOS](https://docs.comfy.org/installation/desktop/macos), [manual installation](https://docs.comfy.org/installation/manual_install).
