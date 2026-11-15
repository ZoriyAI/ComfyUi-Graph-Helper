[Русский](Partner-Cost.ru.md)
[Home](../Home.md) › [Lessons](README.md)

# Partner nodes: data, licenses and the cost of a run

<!-- lesson: partner-cost -->
Lesson "partner-cost", in the group **Diagnostics, performance and safety** of the lesson list. Level 2, core; track
Base. It follows the new standard of lessons (standard 2).

## What you will be able to do
See where a graph sends data to an outside service, what that costs and under which terms, and decide each outside
call on purpose.

## What you need
- [A first picture from text](Image.md), or the same graph built by hand.
- A ComfyUI you can run. A Comfy account with credits is not needed: the paid run is optional and costs money.
- Written against ComfyUI's core nodes and the official pages on partner nodes (overview, pricing, model providers) as
  they stood on 2026-11-15. Prices and terms change often: read them on the day you run.

## The steps
1. **Where a graph leaves your computer** (reading): partner nodes run on the provider's hardware, need a signed-in
   Comfy account and prepaid credits, send their inputs to the provider, and are not loaded with
   `--disable-partner-nodes`.
2. **Find the paid nodes** (checklist, your own word): the **Paid** mark in the app's node search; the price badge on a
   partner node of a ComfyUI template, without running it; optionally `--disable-partner-nodes` and `--offline`.
3. **What goes out, and under which terms** (reading): the inputs; the provider and its data residency; commercial
   licensing for Cloud and Local from the table of model providers ("Request", "Pending").
4. **Map the data** (checklist, your own word): every input sent, nothing private, the license, the region.
5. **Price a series** (checklist, your own word): the price of one run in credits, a series with repeats, where the
   balance is (Settings ▸ Credits in ComfyUI).
6. **The local alternative**: the picture graph on your own card.
7. **Nothing leaves the computer** (a check the app makes): no partner node on the canvas, every node installed.
8. **Run the local graph** (checklist, your own word): the run and its time; the paid run is optional.
9. **Is every outside call decided?** (rubric): the map, the cost, a decision for each partner node (needed to go on),
   a comparison.
10. **Check yourself** (three questions).
11. **On your own: another workflow** (your own task): map, price and decide another workflow with partner nodes.

## What the lesson checks
- On the canvas, by the app: the nodes, links and fields of the local graph.
- From what it already reads: that the graph on the canvas has no partner node, and that every node is installed.
  The app knows a partner node by the flag ComfyUI gives it, and marks it **Paid** in the node search and on the
  canvas.
- Not checked: prices, your balance, the providers' terms and your pictures. The app runs nothing, so it never spends
  credits. The map, the cost and the decision are your own word.

## Mistakes people make
- A shared workflow run before seeing it had paid nodes: look for the **Paid** mark first.
- A private photo sent "just to try": the inputs go to the provider.
- One run priced, fifty planned: multiply, and add repeats.
- Commercial use assumed because you paid: check the provider's row; "Pending" means unknown.

The notes on licenses are general teaching, not legal advice.

## See also
- [Paid API nodes](../concepts/Paid-API-Nodes.md)
- [Adding nodes](../graph/Adding-Nodes.md)
- [Privacy](../trust/Privacy.md)
- [A quality rubric and a blind comparison](Blind-Compare.md)
- [How lessons work](How-Lessons-Work.md)
