[Русский](Running-In-ComfyUI.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# Running the result in ComfyUI

This app never runs a graph: it builds and explains. To get the picture or the video, open the saved workflow in ComfyUI and run it there. This page is the bridge.

## Before you go

1. **Check graph** (`Ctrl+Shift+C`) until it says "No problems found.", or you know why a finding is fine. See [Checking a graph](Checking-A-Graph.md).
2. **File ▸ Save workflow for ComfyUI…** and remember where you saved the `.json` file. See [Saving a workflow for ComfyUI](Saving-Workflows.md).
3. Optional: **File ▸ Save project** to keep the explanations.

## The card "Run it in ComfyUI"

After every **File ▸ Save workflow for ComfyUI…** the card **Run it in ComfyUI** opens. It says: "The workflow is saved. This app does not run graphs: ComfyUI does. Three steps:"

1. **Open ComfyUI** opens the ComfyUI address from Settings ▸ Connection, or the address your MCP server reported, in your browser. When the app knows no address, the step says so and the button is **Connection settings**.
2. Drag the saved file into the ComfyUI window, or open it there with **Workflow ▸ Open**. **Show the file** shows it in your file manager. **Copy workflow** copies the workflow as it was written; then press `Ctrl+V` on the ComfyUI canvas.
3. Press **Run** (`Ctrl+Enter`) in ComfyUI. The result appears under the save node and in the output folder of ComfyUI.

At the bottom, **Explain a ComfyUI error…** opens the error card (see [An error in ComfyUI](ComfyUI-Errors.md)).

- To stop the card from opening after every save, untick **Show this after every save**. The save message still has **How to run it**.
- **Help ▸ Run it in ComfyUI** opens the same card at any time.
- The app opens a browser only when you press a button.

## In ComfyUI, step by step

1. Open ComfyUI in your browser, at the address you always use (for example `http://127.0.0.1:8188`).
2. Drag the `.json` file from your file manager onto the ComfyUI page. Or use ComfyUI's own menu to open a workflow file.
3. The graph appears in ComfyUI as it was here, with the same nodes, links and values.
4. Press ComfyUI's run button (**Run**, or **Queue Prompt** in older versions).
5. The nodes light up one after another while ComfyUI works. The result appears in the Save Image (or Save Video) node.
6. The file is written to ComfyUI's `output` folder, with the name that starts with the `filename_prefix` of that node.

The first run takes longer: ComfyUI loads the models into memory.

## When it does not work

ComfyUI shows a red message and outlines the node that failed. Copy the message and bring it here with **Help ▸ Explain a ComfyUI error…**. See [An error in ComfyUI](ComfyUI-Errors.md).

## Make room for generation

In the export handoff choose **Make room for ComfyUI**. The app pauses its assistant requests and background translations, attempts to unload the models it used through native Ollama and verifies the result. Failures offer retry; availability for other servers is stated explicitly. [Assistant settings](../interface/Settings-Assistant.md).

This also runs by default when the desktop app closes. Closing a phone tab does not close the desktop app. If you no longer need the NodeWise canvas, close it after export; browser access ends too. Resource estimates do not replace measuring memory during a real ComfyUI run.

## See also

- [An error in ComfyUI](ComfyUI-Errors.md)
- [Saving a workflow for ComfyUI](Saving-Workflows.md)
- [ComfyUI](../start/ComfyUI.md)
- [Where files live](../concepts/Where-Files-Live.md)
