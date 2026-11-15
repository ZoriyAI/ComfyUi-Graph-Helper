[Русский](Quick-Start.ru.md)
[Home](../Home.md) › [Start](README.md)

# Quick start

From nothing to a first picture made in ComfyUI from a graph you built and understand. Plan an hour the first time,
most of it for installing ComfyUI and downloading a model.

## 1. Get ComfyUI running

Install ComfyUI, put one checkpoint model into `ComfyUI/models/checkpoints`, start ComfyUI and open its address in
the browser (usually `http://127.0.0.1:8188`). Details: [ComfyUI and where to get it](ComfyUI.md).

## 2. Install NodeWise Studio

```bash
sudo apt install ./nodewise-studio_*_amd64.deb
```

Get the file from the project's Releases page. Details: [Installing](Installing.md).

## 3. Start it

Open "NodeWise Studio" from the menu. An empty canvas with a welcome card appears. The card lists three steps and marks
the ones that are done: connect ComfyUI and read it, choose who answers, ask or build. See
[The welcome card](../interface/Welcome.md).

## 4. Connect ComfyUI and read it

Choose **Connect…** on the welcome card. In Settings ▸ Connection choose **Find on this computer**, or enter the
address you open ComfyUI at in the browser (for example `http://127.0.0.1:8188`), choose **Check ComfyUI**, then
**Save settings**. Back on the card choose **Read ComfyUI**. When it is done, the card says how many node types and
model files it read, and the library on the left shows them. The whole chapter: [Connecting to ComfyUI](../connect/Connecting.md).

## 5. Take a first lesson

Open the right panel (**View ▸ Tools panel**, `Ctrl+J`) and choose **Learn**. Pick the lesson **A first picture from
text** and follow its steps. You add the nodes and links yourself; the lesson checks each step on the graph and says
in words what is missing. **Show me where** points at the place on the canvas; **Do this for me** does a step where
the choice is not yours to make. No assistant model is needed. See
[A first picture from text](../lessons/Image.md).

## 6. Check and save for ComfyUI

1. **Graph ▸ Check graph** (`Ctrl+Shift+C`). Fix what it finds, or read why a finding is fine.
2. **File ▸ Save workflow for ComfyUI…** (`Ctrl+E`) and choose where to put the `.json` file.

## 7. Run it in ComfyUI

Drag the `.json` file onto the ComfyUI page in the browser and press its run button. The picture appears in the Save
Image node and is written to `ComfyUI/output`. Details: [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md).

## 8. Optional: an assistant

To ask questions about any node or let the assistant build, choose who answers: a cloud model with your key, or a
model on your own computer (Ollama, LM Studio, vLLM). Choose the assistant in the top toolbar or in Settings ▸
Assistant. See [Choosing who answers](../assistant/Choosing-Who-Answers.md). Cloud answers cost money per question.

## See also

- [Start](README.md)
- [The first hour](First-Hour.md)
- [Questions and answers](FAQ.md)
- [Troubleshooting](../reference/Troubleshooting.md)
