[Русский](Task-Wizards.ru.md)
[Home](../Home.md) › Graph

# Task wizards, agent and custom extensions

Open **Task wizards** from the canvas toolbar or **Library → Subgraphs**. Choose a result before learning every node name.

1. Choose image, video, audio, 3D or text and search the blueprints. All115 official blueprints at the pinned source revision are bundled, including photo extraction from video, image editing, masks, processing, generation and combined stages. This is a release snapshot; newer upstream entries require an app update.
2. Describe the result. Review the ready interface: `IMAGE` image, `MASK` mask, `VIDEO` video, `AUDIO` sound, `STRING` text, `LATENT` internal generation data. Original ComfyUI types are retained.
3. Review required nodes, models and packs against the synchronized catalog. Presence does not establish execution. You can create a study copy with missing dependencies.
4. **Create editable subgraph**, open it and configure its inner nodes. Native settings, links and promoted controls are kept. Copies are independent.

On phones the wizard has a scrollable body and bottom step actions. Close it with X. Tap the active library/assistant panel again or use back-to-canvas to clear the workspace.

## Agent and teaching

Configure the assistant once in **Settings → Assistant**. Every wizard uses that connection. **Create step by step with agent** passes your goal and selected blueprint. The agent inspects the actual inner graph and installed classes/models, explains stages, creates an independent variation and edits its inner nodes. Change one parameter at a time and compare outputs after running in ComfyUI.

Teachers can **Draft a lesson for students**. Review the draft card with actions, checks and independent practice, keep it in **My lessons**, then export a lesson file for students to import. Export the ComfyUI workflow JSON separately. Scores and execution ticks reflect the person's statement; the app does not judge images in place of the teacher.

## Ollama image-to-prompt, chat and embeddings

**Ollama and local AI** asks the agent to inspect actual installed node schemas. If missing, **Review Ollama node package** offers source review and ZIP download. Read the files, extract the package folder into `ComfyUI/custom_nodes`, restart ComfyUI and synchronize NodeWise yourself.

- `LoadImage.IMAGE → NodeWiseOllamaVisionPrompt.image → prompt STRING → CLIPTextEncode.text`: photo captioning to generation prompt. Choose a vision-capable Ollama model and compatible ComfyUI generation models separately.
- Text → `NodeWiseOllamaChat` → text.
- Two `NodeWiseOllamaEmbeddings` nodes using the same model → `NodeWiseEmbeddingCosine`: vector similarity.

`NODEWISE_EMBEDDINGS` vectors cannot replace CLIP `CONDITIONING`. Enter exact installed model tags; the package never downloads models. `localhost` means the ComfyUI host even when editing on a phone. Default `keep_alive=0` releases Ollama model memory after a request. Longer retention trades memory for repeated-request speed.

## New algorithms and extension ZIPs

Use **Custom extension** for a new algorithm, with its purpose, typed inputs/outputs and processing stages. The configured agent uses `draftExtension` to create source files, README and dependencies. Review each file and download the ZIP.

Drafts are temporary and expire on restart. Format validation does not prove Python correctness or algorithm quality. NodeWise never runs or installs generated code. After source review, installation, ComfyUI restart and synchronization, the real registered classes become available in the library. Grouping existing nodes uses the ordinary subgraph constructor.

## Resources and Russian model text

**Check → Hardware and combined models** shows unique model files, processing stages and missing dependencies. Refresh to read RAM/VRAM from `system_stats`. File totals do not measure peak VRAM: resolution, frames, VAE, activations, quantization, CPU offloading and other applications matter. Ask the agent to discuss smaller resolution, sequential stages and model responsibilities. A real run remains necessary.

With Russian UI, the configured assistant translates readable descriptions, notes and metadata across all model folders in the background. The original-text toggle retains source prose. Filenames, triggers and technical values stay intact. Without a configured assistant, the original remains visible.

Sources: [official blueprints](https://github.com/Comfy-Org/workflow_templates/tree/ff15d86b5a143d546ed632826d72501298563ddb/blueprints), [native subgraphs](https://docs.comfy.org/interface/features/subgraph), [custom nodes](https://docs.comfy.org/custom-nodes/backend/server_overview), [Ollama chat](https://docs.ollama.com/api/chat), [embeddings](https://docs.ollama.com/api/embed), [vision](https://docs.ollama.com/capabilities/vision). The blueprints' MIT license is included in the app.
