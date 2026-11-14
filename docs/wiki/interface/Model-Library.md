[Русский](Model-Library.ru.md)
[Home](../Home.md) › [The window](README.md)

# Models in the library

The **Models** tab lists the model files in your ComfyUI folders: checkpoints, LoRAs, VAE, ControlNet models and others. For each file it shows its kind, the model family it is made for, its size and how many trigger words it has. The app reads the header of each file to learn the family; it never changes or moves a file.

<!-- picture: the Models tab with the kind chips, Family and Order -->

## How to find a model

1. Type in **Search models**. It looks in the file name, the title, the family and the trigger words.
2. The chips under the field filter by kind: **All**, **Checkpoints**, **LoRA**, **VAE**, **ControlNet**, **Other**. Each chip shows how many files it holds.
3. **Family** keeps only one family, for example SDXL or Wan 2.2. **All** shows every family.
4. **Order**: **By name** or **Largest first**.

When the filters hide everything: "The filters hide every file" and **Reset filters**.

## A row

- A picture on the left, when an example picture or clip lies next to the file.
- Badges: the kind ("LoRA"), the family ("SDXL"), the size and "3 trigger words". "family not known" when neither the file nor its name says it.
- The question mark on the right asks the assistant "What is the model …, and what does it work with?".
- A right-click opens a small menu: **Ask about this model** and **What works with it**.

## How to use a model from here

- Click a row (or `Enter`): the [model card](Model-Card.md) opens with **Add to canvas**.
- Drag a row onto the canvas: the app puts the loader node that fits the file, with the file already chosen.

## Reading model files

The family of a file is known only after its header is read. Sync reads headers in batches, after the node list; the sync indicator shows "Reading models: 120 / 331" meanwhile. Until then the family is a guess from the file name.

## See also

- [The model card](Model-Card.md)
- [Choosing a model file](../graph/Model-Files.md)
- [Model families](../concepts/Model-Families.md)
- [Settings: Sync](Settings-Sync.md)
