[Русский](ComfyUI-Errors.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# An error in ComfyUI

When ComfyUI cannot run a workflow, it shows a red message and outlines the node that failed. This page says how to read it and how to bring it back here to fix the graph.

## How to bring an error back

1. In ComfyUI, read the message and note the node it names (its title, and the number ComfyUI shows).
2. Copy the text of the message (select it and `Ctrl+C`).
3. In this app, open the same graph. Press **Check graph**: many errors are found here too, with a **Show** button that takes you to the node.
4. Ask the assistant in **Ask** mode: paste the message and write, for example, "ComfyUI says this when I run the graph. What is wrong and how do I fix it?" Select the node first, so the question is about it.
5. Fix, save the workflow again, and open the new file in ComfyUI.

## Common messages and what they usually mean

| ComfyUI says (in words like these) | Usually | Here |
|---|---|---|
| a node type is missing, or the node is drawn red | a node pack is not installed | the check: **Nodes that are not installed**. Install the pack in ComfyUI yourself, restart it, then **Sync ▸ Sync now**. |
| a value is not in the list (for example a model name) | a model file is missing, or named differently on this computer | the check: **Models that are not on disk**. Choose a file you have. See [Choosing a model file](Model-Files.md). |
| a required input is missing | an input has no link | the check: **Required inputs left empty**. |
| the shapes or sizes of tensors do not match | models of different families are mixed | the check: **Models from different families**. |
| out of memory | the graphics card has too little memory for this size or model | lower the width and height, the batch size or the length of a video; or a smaller model. See [Graphics card memory](../concepts/Graphics-Card-Memory.md). |

The check cannot see the last kind, and some others that appear only while ComfyUI runs.

<!-- verify: the files and start branch adds a way to bring a ComfyUI error back into the app; rewrite step 2 to 4 then -->

## See also

- [Running the result in ComfyUI](Running-In-ComfyUI.md)
- [Checking a graph](Checking-A-Graph.md)
- [Ask](../assistant/Ask.md)
- [Troubleshooting](../reference/Troubleshooting.md)
