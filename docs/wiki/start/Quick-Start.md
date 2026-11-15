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

Open "NodeWise Studio" from the menu. It speaks your system's language; the button in the top corner of the welcome
card switches between Русский and English. The tour of the window runs once; Skip the tour if you like. The welcome
card offers three ways to start (Take a lesson, Open an example, Ask the assistant) and, under them, what they need:
Connect ComfyUI and Choose the assistant. No ComfyUI yet? Choose **I have no ComfyUI yet**. See
[The welcome card](../interface/Welcome.md).

## 4. Connect ComfyUI and read it

Choose **Connect…** on the welcome card. In Settings ▸ Connection choose **Find on this computer**, or enter the
address you open ComfyUI at in the browser (for example `http://127.0.0.1:8188`), choose **Check ComfyUI**, then
**Save settings**. Back on the card choose **Read ComfyUI**. When it is done, the card says how many node types and
model files it read, and the library on the left shows them. The whole chapter: [Connecting to ComfyUI](../connect/Connecting.md).

## 5. Take a first lesson

Choose **Take a lesson** on the welcome card (or choose **Learn** in the right panel). Pick the lesson **A first
picture from text** and follow its steps. You add the nodes and links yourself; the lesson checks each step on the graph and says
in words what is missing. **Show me where** points at the place on the canvas; **Do this for me** does a step where
the choice is not yours to make. No assistant model is needed. See
[A first picture from text](../lessons/Image.md).

## 6. Check and save for ComfyUI

1. **Graph ▸ Check graph** (`Ctrl+Shift+C`). Fix what it finds, or read why a finding is fine.
2. **File ▸ Save workflow for ComfyUI…** (`Ctrl+E`) and choose where to put the `.json` file.

## 7. Run it in ComfyUI

After saving, the card **Run it in ComfyUI** opens. Choose **Open ComfyUI**, drag the `.json` file onto the ComfyUI
page in the browser (or **Copy workflow** and press `Ctrl+V` on the ComfyUI canvas), and press Run there. The picture appears in the Save
Image node and is written to `ComfyUI/output`. Details: [Running the result in ComfyUI](../graph/Running-In-ComfyUI.md).

## 8. Optional: an assistant

To ask questions about any node or let the assistant build, choose who answers: a cloud model with your key, or a
model on your own computer (Ollama, LM Studio, vLLM, the llama.cpp server). Choose the assistant on the welcome card
or in Settings ▸ Assistant. See [Choosing who answers](../assistant/Choosing-Who-Answers.md). Cloud answers cost money per question.

## See also

- [Start](README.md)
- [The first hour](First-Hour.md)
- [Questions and answers](FAQ.md)
- [Troubleshooting](../reference/Troubleshooting.md)
