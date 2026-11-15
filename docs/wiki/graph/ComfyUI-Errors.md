[Русский](ComfyUI-Errors.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# An error in ComfyUI

When ComfyUI cannot run a workflow, it shows a red message and outlines the node that failed. This page says how to read it and how to bring it back here to fix the graph.

## How to bring an error back

1. In ComfyUI, copy the red text (select it and `Ctrl+C`), or the error from the terminal of ComfyUI.
2. In this app, open the same graph, then **Help ▸ Explain a ComfyUI error…** or **Graph ▸ Explain a ComfyUI error…**. The save card has the same button.
3. Paste the text into **Text of the ComfyUI error** and press **Explain**.
4. Under **Nodes it names** the card lists the nodes the error names, by number and by class. **Show on the canvas** selects the node and brings it into view. A node that is not in this graph says "not on this canvas". Node numbers of a workflow you opened here are the same as in ComfyUI.
5. Under **What it means** the card explains a known message, with **Meaning** and **What to do**.
6. For an error it does not know, it says "The app does not know this error. Ask the assistant: it reads the text and your graph." **Ask the assistant** sends the text to the chat. Nothing is sent before you press it.
7. Fix, save the workflow again, and open the new file in ComfyUI.

Many errors are found by **Check graph** here too, before you run anything.

## Messages the card knows

The card recognises these messages of ComfyUI: out of memory, "Prompt outputs failed validation", "Value not in list", "Required input is missing", "Return type mismatch between linked nodes", a node that is not found, "Prompt has no outputs", a value smaller than min or bigger than max, "Could not detect model type", a damaged or incomplete safetensors file, "mat1 and mat2 shapes cannot be multiplied", "size mismatch", tensors on different devices, "Dependency cycle detected", and "lora key not loaded".

## Common messages and what they usually mean

| ComfyUI says (in words like these) | Usually | Here |
|---|---|---|
| a node type is missing, or the node is drawn red | a node pack is not installed | the check: **Nodes that are not installed**. Install the pack in ComfyUI yourself, restart it, then **Sync ▸ Sync now**. |
| a value is not in the list (for example a model name) | a model file is missing, or named differently on this computer | the check: **Models that are not on disk**. Choose a file you have. See [Choosing a model file](Model-Files.md). |
| a required input is missing | an input has no link | the check: **Required inputs left empty**. |
| the shapes or sizes of tensors do not match | models of different families are mixed | the check: **Models from different families**. |
| out of memory | the graphics card has too little memory for this size or model | lower the width and height, the batch size or the length of a video; or a smaller model. See [Graphics card memory](../concepts/Graphics-Card-Memory.md). |

The check cannot see the last kind, and some others that appear only while ComfyUI runs.

## See also

- [Running the result in ComfyUI](Running-In-ComfyUI.md)
- [Checking a graph](Checking-A-Graph.md)
- [Ask](../assistant/Ask.md)
- [Troubleshooting](../reference/Troubleshooting.md)
