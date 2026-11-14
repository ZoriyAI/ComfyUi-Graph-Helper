[Русский](Reading-A-Workflow.ru.md)
[Home](../Home.md) › [ComfyUI concepts](README.md)

# Reading someone else's workflow

A method for understanding a workflow you downloaded, before you run it.

## The method
1. **Read the notes.** Template and workflow authors put the list of model files, folders and settings in Note or Markdown Note nodes.
2. **Find the outputs.** Look for Save Image, Save Video, Preview Image. Everything that matters leads to them; branches that lead nowhere do not run.
3. **Walk back from each output** to the sampler that feeds it. The sampler is the heart: look at its `model`, `positive`, `negative` and `latent_image` inputs.
4. **Find the loaders.** Which checkpoint or diffusion model, which text encoders, which VAE, which LoRAs. That tells you the family, and the family tells you what files you need. See [Model families](Model-Families.md).
5. **Find the start.** An empty latent (text to image), a Load Image and VAE Encode (image to image), a mask (inpainting), a video start node.
6. **Read the prompts** and the sampler settings: steps, cfg, sampler, scheduler, denoise, seed.
7. **Look for the unusual**: several samplers (two passes, refining, upscaling), ControlNet, reference images, subgraphs, Set/Get nodes that hide links, bypassed or muted parts.
8. **Check what is missing**: nodes from packs you do not have, model files you do not have.
9. **Check for paid or risky parts**: Partner (API) nodes that cost credits and send data out; packs you do not know.

## Typical mistakes
- Running a big workflow before checking its memory needs: start with a smaller size or length.
- Installing every missing pack without looking at what it is: see [Node packs](Node-Packs.md).
- Replacing a missing model with one of another family: the graph runs but the result is noise.

## How the app helps
- **File ▸ Open workflow…** shows after import what was found and what your ComfyUI lacks.
- **Guided tour** (**Graph ▸ Guided tour**) walks through the graph node by node with explanations.
- The **Explain** tab describes whatever you select; **Check** lists missing nodes, missing models and families that do not match.
- **Ask** mode lets the assistant answer questions about the graph on the canvas.
## See also
- [Workflow formats](Workflow-Formats.md)
- [Notes, reroutes and primitives](Notes-Reroutes-Primitives.md)
- [Bypass and mute](Bypass-And-Mute.md)
- [Subgraphs](Subgraphs.md)
- [Paid API nodes](Paid-API-Nodes.md)
- [Opening workflows](../graph/Opening-Workflows.md)
