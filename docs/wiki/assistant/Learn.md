[Русский](Learn.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Learn

In **Learn** mode you build, and the app leads: "You build; the app leads you step by step and checks." A lesson says what to do and why, shows where on the canvas, and sees from the graph when a step is done. No model is needed, so Learn works with no assistant chosen. The lessons one by one: [Lessons](../lessons/README.md). The panel: [The lessons tab](../interface/Lessons-Panel.md).

## How to start

1. **Learn** under the conversation in the **Assistant** tab, **Assistant ▸ Lessons: build it yourself**, or **Take a lesson** ▸ **Choose a lesson** on the welcome card.
2. Pick a lesson and press **Start**. Begin with "A first picture from text".
3. Do each step on the canvas. When it is done, the lesson moves on by itself.

## When you are stuck

- **Still to do** says in words what is missing.
- **Show me where** lights up the place.
- **Do this for me** does the step, where the choice is not yours to make: it sets the number the step names, or picks the first file of the right kind.
- A wrong file, number, swapped prompts or a similar but wrong node are each explained in one line.
- **Ask the assistant about this step** sends the step as a question. This one needs a model; the answer appears in the conversation, which replaces the lesson view until you press **Learn** again.

## Lessons fit your ComfyUI

A lesson uses only nodes your ComfyUI has. One that needs a pack you do not have says so and names the missing nodes; the app never installs them. Before your ComfyUI is read, the lessons ask you to connect and read it first.

## Learn and the other modes

Your progress is read from the graph, so you can leave a lesson, ask or build, and come back with **Continue**. If a lesson was open when the app closed, Learn opens on it at the next start. A finished lesson stays **Done**; **Start over** begins it from step 1.

You can also make your own lessons from a graph, import and export lesson files, and let the assistant draft one ("Draft a lesson"); pending drafts survive a restart when chat history is enabled; accepting adds the lesson to My lessons. See [The lessons tab](../interface/Lessons-Panel.md#my-lessons). Lessons for adults stay closed until the switch **Adult content (18+)** in Settings ▸ Privacy is on; see [Content rules](../trust/Content-Rules.md). Lessons follow the displayed canvas or subgraph copy, with separate progress for each instance.

## See also

- [How lessons work](../lessons/How-Lessons-Work.md)
- [The lessons tab](../interface/Lessons-Panel.md)
- [Working without a model](Without-A-Model.md)
