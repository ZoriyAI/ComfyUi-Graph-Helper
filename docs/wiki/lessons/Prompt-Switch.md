[Русский](Prompt-Switch.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Two versions of a prompt with one switch

<!-- lesson: switch -->
Lesson "switch", in the group **Packs and tools** of the lesson list. Steps: 9.

## What you will be able to do
You keep two prompts in one graph and choose between them with one yes/no value, the way ComfyUI's templates do.

## What you need
- It goes on from [A first picture from text](Image.md). The card says so; it is a hint, not a lock.
- Nodes: CLIP Text Encode (Prompt), KSampler, Text (Multiline), If/Else Switch, Boolean.
- The app downloads and installs nothing. The step texts below say which files and folders, and which ComfyUI template names them.

## The steps
The words of each step, as the lesson shows them. Node names are in bold.

1. **Compare without rewiring** (reading)

   To compare two prompts you would retype the text or move links each time. ComfyUI's templates do it with a switch: both versions stay in the graph, and one yes/no value chooses which one goes on.

   This lesson builds that on the graph of "A first picture from text". The same switch later chooses between your prompt and one a language model rewrote.

2. **The picture graph is needed**

   The canvas must have the graph of "A first picture from text": the **CLIP Text Encode (Prompt)** node whose output goes into the `positive` input of **KSampler**.

   If it is not there, do that lesson first.

3. **The first version**

   Add a **Text (Multiline)** node and write a prompt into its `value` field. For example: a lighthouse on a cliff at sunset, warm light, calm sea.

   This node holds the text in one visible place. It goes on to the switch, not straight into **CLIP Text Encode (Prompt)**.

4. **The second version**

   Add a second **Text (Multiline)** node and write another version into its `value` field: the same subject in another light, another style or with one more detail.

   Change one thing only. Then you see what that one change did.

5. **The switch**

   Add a **If/Else Switch** node. Connect the output of **Text (Multiline)** to its `on_false` input and the output of **Text (Multiline)** to its `on_true` input.

   The switch passes on one of the two. Only the chosen side is worked out.

6. **Into the prompt**

   Connect the `output` of **If/Else Switch** to the `text` input of **CLIP Text Encode (Prompt)**.

   The `text` field of **CLIP Text Encode (Prompt)** now takes its words from the link, and the text typed in it is no longer used. The rest of the graph stays as it was.

7. **The yes/no value**

   Add a **Boolean** node, connect its output to the `switch` input of **If/Else Switch** and set its `value` to `true`.

   `true` chooses `on_true`, the second version; `false` chooses `on_false`, the first. The choice now sits in one small node you can find at once.

8. **How to compare** (reading)

   In ComfyUI set `control_after_generate` under the `seed` of **KSampler** to `fixed`. Run once with `true` and once with `false`.

   With the same `seed` the two pictures differ only by the prompt. If they also differed by the noise, you could not tell which change did what.

9. **The graph is ready** (reading)

   Save the graph with "File ▸ Save workflow for ComfyUI…", open the file in ComfyUI and run it there. This app runs nothing in ComfyUI itself.

   The same switch works for anything of one type: two models, two LoRA settings, two sizes. Both sides must carry the same type.

   Next: "A language model writes the prompt" puts a language model on the `on_true` side.

## What the lesson checks
A reading step is done when you press **Got it, next**. A doing step ticks itself off when the canvas holds:

- Step 2, **The picture graph is needed**:
  - a **CLIP Text Encode (Prompt)** node.
  - a **KSampler** node.
  - `CONDITIONING` of **CLIP Text Encode (Prompt)** into `positive` of **KSampler**.
- Step 3, **The first version**:
  - a **Text (Multiline)** node.
  - `value` of **Text (Multiline)** (first version) holds at least 10 characters.
- Step 4, **The second version**:
  - a **Text (Multiline)** node.
  - `value` of **Text (Multiline)** (second version) is not the same file as `value` of **Text (Multiline)** (first version).
- Step 5, **The switch**:
  - a **If/Else Switch** node.
  - `STRING` of **Text (Multiline)** (first version) into `on_false` of **If/Else Switch**.
  - `STRING` of **Text (Multiline)** (second version) into `on_true` of **If/Else Switch**.
- Step 6, **Into the prompt**:
  - `output` of **If/Else Switch** into `text` of **CLIP Text Encode (Prompt)**.
- Step 7, **The yes/no value**:
  - a **Boolean** node.
  - `BOOLEAN` of **Boolean** into `switch` of **If/Else Switch**.
  - `value` of **Boolean** is `true`.

## What next
These lessons go on from this one: [A language model writes the prompt](LLM-Prompt.md).

## See also
- [Notes, reroutes and primitives](../concepts/Notes-Reroutes-Primitives.md)
- [The prompt: how models read text](../concepts/Prompt.md)
- [How lessons work](How-Lessons-Work.md)
