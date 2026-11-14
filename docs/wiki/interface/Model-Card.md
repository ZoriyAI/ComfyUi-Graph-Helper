[Русский](Model-Card.ru.md)
[Home](../Home.md) › [The window](README.md)

# The model card

The model card opens next to the library when you click a file in the **Models** tab. It says what the file is, which models it fits, how its author meant it to be used, and puts it on the canvas for you.

<!-- picture: the card of a LoRA with a picture, trigger words and How to use it -->

## What the card shows

| Part | What it says |
|---|---|
| **Preview** | an example picture or clip that lies next to the file |
| **Family** | the model family, and where that is known from: "from the file metadata", "from the description next to the file", "from the file name", "from the internet" |
| **Kind**, **Size**, **Folder** | what sort of file it is, how big, in which ComfyUI folder |
| **Name from its author**, **Made for**, **Version**, **Author**, tags | what the author wrote in the description next to the file |
| **Trigger words** | words that switch a LoRA on. Click a word to copy it, **Copy all** copies all. "The file names no trigger words: the LoRA works without them." when there are none. |
| **How to use it** | "Strength the author suggests: 0.9", "It works from 0.6 to 1.2", "Clip skip: 2" |
| **Descriptions the author used** | the prompts of the author's sample pictures, each with **Copy** |
| **Fits** | for a LoRA: "Your base models it fits:" and the checkpoints you have of its family. For a checkpoint: "3 of your LoRAs fit this model" and **Show them in the list** |
| **From the internet** | what Civitai or Hugging Face say about the file, after **Find on the internet** |
| **Your notes** | the notes you wrote about this file in your model manager, read from the description next to the file |

## Buttons

- **Add to canvas** puts the loader node that fits the file, with the file chosen, and selects it: "Added “Load LoRA” with … The node is selected."
- **Put into the selected node** appears when a node that loads this kind of file is selected: the node then loads this file.
- **Ask the assistant** and **How do I connect it?** send a question about the file.
- **Find on the internet** sends the file fingerprint to civitai.com and, if Civitai does not know the file, its name to huggingface.co. "The server reads the whole file. A large one takes a few minutes."

## Adult content

When the author marked a file as adult content: "The author marked this as adult content. The preview and the examples made with it are hidden." **Show for this file** shows them for this file; **Hide again** hides them. To show them always: Settings ▸ Privacy.

## What can go wrong

- "This file is no longer in the catalog. Sync again to refresh the list."
- "There is no standard loader node for files in “…”. Ask the assistant which node loads them."
- "The preview could not be read. The computer with ComfyUI may be off."
- "The lookup did not work: the site did not answer. Check the internet connection."
- "Civitai does not know this file; nothing was found on Hugging Face by its name."

## See also

- [Models in the library](Model-Library.md)
- [Choosing a model file](../graph/Model-Files.md)
- [LoRA](../concepts/LoRA.md)
- [Settings: Privacy](Settings-Privacy.md)
