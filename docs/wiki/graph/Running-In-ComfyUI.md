[Русский](Running-In-ComfyUI.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Running the result in ComfyUI

This app never runs a graph: it builds and explains. To get the picture or the video, open the saved workflow in ComfyUI and run it there. This page is the bridge.

## Before you go

1. **Check graph** (`Ctrl+Shift+C`) until it says "No problems found.", or you know why a finding is fine. See [Checking a graph](Checking-A-Graph.md).
2. **File ▸ Save workflow for ComfyUI…** and remember where you saved the `.json` file. See [Saving a workflow for ComfyUI](Saving-Workflows.md).
3. Optional: **File ▸ Save project** to keep the explanations.

## In ComfyUI

1. Open ComfyUI in your browser, at the address you always use (for example `http://127.0.0.1:8188`).
2. Drag the `.json` file from your file manager onto the ComfyUI page. Or use ComfyUI's own menu to open a workflow file.
3. The graph appears in ComfyUI as it was here, with the same nodes, links and values.
4. Press ComfyUI's run button (**Run**, or **Queue Prompt** in older versions).
5. The nodes light up one after another while ComfyUI works. The result appears in the Save Image (or Save Video) node.
6. The file is written to ComfyUI's `output` folder, with the name that starts with the `filename_prefix` of that node.

The first run takes longer: ComfyUI loads the models into memory.

## When it does not work

ComfyUI shows a red message and outlines the node that failed. See [An error in ComfyUI](ComfyUI-Errors.md).

<!-- verify: the files and start branch adds a "how to run it in ComfyUI" help in the app and a way to bring an error back; describe them when they land -->

## See also

- [An error in ComfyUI](ComfyUI-Errors.md)
- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [ComfyUI](../start/ComfyUI.md)
- [Where files live](../concepts/Where-Files-Live.md)
