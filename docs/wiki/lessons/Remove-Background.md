[Русский](Remove-Background.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Removing a background

<!-- lesson: remove-background -->
Lesson "remove-background", in the group **Pictures: techniques** of the lesson list. Steps: 9.

## What you will be able to do
A picture whose background is made transparent, saved as PNG.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: Load Image, Load Background Removal Model, Remove Background, Invert Mask, Join Image with Alpha, Save Image.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **How a background is removed** (reading)

   A background removal model looks at a picture and says which pixels belong to the subject. ComfyUI turns that into transparency: what is not the subject disappears.

   The nodes for this are part of new versions of ComfyUI. The lesson builds the graph from an empty canvas: "File ▸ New project".

2. **Load the picture**

   Add a **Load Image** node and choose the picture in its `image` field.

   A clear subject against a background works best: a person, a product, an animal.

3. **Load the model**

   Add a **Load Background Removal Model** node and choose the model in its `bg_removal_name` field, for example BiRefNet. ComfyUI looks for these files in the `models/background_removal` folder.

   If the file you need is not in the list, your ComfyUI does not have it. The app downloads nothing. The easiest way is to open, in ComfyUI itself, the official template "Remove Background (BiRefNet)": it shows which files are missing and where to put them. Then choose "Sync ▸ Sync now" in this app's menu, and the files appear in the lists.

4. **Find the subject**

   Add a **Remove Background** node. The output of **Load Background Removal Model** goes into its `bg_removal_model` input, the picture into `image`.

   Its `mask` output is the subject: white where it is, black where the background is.

5. **Turn the mask inside out**

   Add an **Invert Mask** node and connect the `mask` output of **Remove Background** to its `mask` input.

   The next node reads a mask as "what to hide". The subject must stay, so the mask is turned inside out first, as ComfyUI's own template does.

6. **Make the background transparent**

   Add a **Join Image with Alpha** node. The picture goes into its `image` input, the output of **Invert Mask** into `alpha`.

   The node adds the mask to the picture as transparency.

7. **Save it**

   Add a **Save Image** node and connect the output of **Join Image with Alpha** to its `images` input.

   It writes PNG, and PNG keeps transparency. JPEG has none: the transparent part would turn into a colour.

8. **Other ways** (reading)

   - To put the subject on another background, take an Image Composite Masked node: the new background, the subject and the mask go into it.
   - The ComfyUI-RMBG pack holds many removal models, also for hair and clothes. A node pack runs other people's code on your computer. Install it yourself through ComfyUI's manager, from its official page, and only if you trust its authors. The app installs nothing.
   - To take not the whole subject but one named object, see "A mask by words".

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   What to try: a picture with hair or fur against a busy background, the hardest case for any model.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **Load the picture**:
  - a **Load Image** node.
  - `image` of **Load Image**: a value is chosen.
- Step 3, **Load the model**:
  - a **Load Background Removal Model** node.
  - `bg_removal_name` of **Load Background Removal Model**: a value is chosen.
- Step 4, **Find the subject**:
  - a **Remove Background** node.
  - `bg_model` of **Load Background Removal Model** into `bg_removal_model` of **Remove Background**.
  - `IMAGE` of **Load Image** into `image` of **Remove Background** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
- Step 5, **Turn the mask inside out**:
  - a **Invert Mask** node.
  - `mask` of **Remove Background** into `mask` of **Invert Mask**.
- Step 6, **Make the background transparent**:
  - a **Join Image with Alpha** node.
  - `IMAGE` of **Load Image** into `image` of **Join Image with Alpha** (a Upscale Image or Upscale Image By or Scale Image to Total Pixels or FluxKontextImageScale or Resize Image or ImageResizeKJv2 or Pad Image for Outpainting in between is accepted).
  - `MASK` of **Invert Mask** into `alpha` of **Join Image with Alpha**.
- Step 7, **Save it**:
  - a **Save Image** node.
  - `IMAGE` of **Join Image with Alpha** into `images` of **Save Image**.

## See also
- [Data types](../concepts/Data-Types.md)
- [How lessons work](How-Lessons-Work.md)
