[Русский](Paid-API-Nodes.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Paid API nodes (Partner Nodes)

Nodes that send your prompt and pictures to a company's cloud model and charge credits.

## In plain words
Most ComfyUI nodes run on your own computer. **Partner Nodes** (also called API nodes) are different: they call closed or hosted models over the internet (for example from OpenAI, Google, Kling, Luma, Runway, Black Forest Labs, Stability AI and others) and bring the result back into your graph. They need a Comfy account with prepaid credits; there is no free use. Each run costs credits, the price depends on the model and settings.

What you send leaves your computer: according to ComfyUI's documentation, Partner Nodes send your inputs (prompts, images and other content) to third-party providers, whose own content rules apply.

## Where you meet it in a graph
They look like ordinary nodes, usually in an "api node" or "partner" category, with fields such as model, size, duration, and a price note. Their outputs (`IMAGE`, `VIDEO`, `AUDIO`) connect to normal nodes, so a graph can mix local and cloud steps.

## Values and what they change
Longer videos, higher resolutions and better model versions cost more credits per run. Re-running a graph re-runs (and re-pays) the API node unless its inputs are unchanged and ComfyUI reuses the cached result.

## Turning them off
Start ComfyUI with `--disable-partner-nodes` to hide them, or with `--offline` to keep the editor from contacting the internet as well.

## Typical mistakes
- Opening a shared workflow and running it without noticing a paid node in it.
- Sending private pictures to a cloud service without meaning to.
- Expecting it to work without logging in or without credits.

## How the app helps
The app runs nothing, so it never spends credits. A paid node carries the mark **Paid** beside its name, on its card on the canvas and in the node search, so you see it before you add it or take a workflow to ComfyUI. Hold the pointer over the mark to read: "Runs on an outside service: ComfyUI asks you to sign in to your Comfy account and charges for each run." The same search marks nodes as **Outdated** or **Experimental** when their pack says so.

The lesson [Editing a picture by words](../lessons/Edit-By-Words.md) builds an editing graph on local nodes and says that the paid API nodes for editing cost money and send your picture and your words to a cloud service.

## See also
- [What ComfyUI is](What-Is-ComfyUI.md)
- [Reading someone else's workflow](Reading-A-Workflow.md)
- [Privacy](../trust/Privacy.md)
- [Read-only](../trust/Read-Only.md)
