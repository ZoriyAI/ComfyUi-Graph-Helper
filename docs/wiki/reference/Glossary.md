[Русский](Glossary.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Glossary

The words of the app and of ComfyUI, in short. Each word links to the page that explains it.

## Words of the app

- **Ask, Build, Learn**: the three modes of the assistant panel. Ask answers and suggests; Build changes the graph;
  Learn opens the lessons. [Ask](../assistant/Ask.md), [Build](../assistant/Build.md), [Learn](../assistant/Learn.md)
- **Assistant**: the part of the app that talks to a language model of your choice to explain and build graphs.
  [The assistant](../assistant/Assistant.md)
- **Catalog**: what the app read from your ComfyUI: node types, node packs and model files.
  [Reading ComfyUI](../dev/Reading-ComfyUI.md)
- **Check**: Graph ▸ Check graph; finds missing nodes and models, wrong links and empty fields before you save.
  [Checking a graph](../graph/Checking-A-Graph.md)
- **Checkpoint pause**: the assistant stops after the number of steps set in Settings ▸ Assistant and asks whether to
  go on. Not to be confused with a checkpoint model file. [Pause and stop](../assistant/Pause-And-Stop.md)
- **Context window**: how much text a model can read at once, counted in tokens.
  [The context window](../assistant/Context-Window.md)
- **Conversation log**: the record of what was sent to the model and what came back.
  [The conversation log](../assistant/Conversation-Log.md)
- **Description card**: the short card under a node that says what it is and why it is there.
  [Description cards](../interface/Description-Cards.md)
- **Draft**: a grey node or link the assistant suggests; it becomes part of the graph only when you accept it.
  [Drafts](../assistant/Drafts.md)
- **Explanation**: the text that tells what a node, a link or the graph does, with its source (built in, from the
  model, from the web, yours). [The explanations tab](../interface/Explain-Panel.md)
- **History**: every change of the graph is a version; Undo and Redo move through them.
  [History and undo](../graph/History-And-Undo.md)
- **Lesson**: a task you do by hand on the real canvas, step by step, checked by the app.
  [How lessons work](../lessons/How-Lessons-Work.md)
- **Library**: the left panel with your nodes, models and subgraphs. [The library](../interface/Library.md)
- **MCP server**: a small program next to ComfyUI that tells the app which nodes and model files you have.
  [MCP servers](../connect/MCP-Servers.md)
- **Project file**: a file with the graph and everything the app knows about it (`*.nodewise.json`).
 [Project files](../graph/Project-Files.md)
- **Provider**: who answers for the assistant: a cloud service or your own server.
  [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- **Step**: one action of the assistant: reading the catalog, adding a node, drawing a link.
- **Sync**: reading ComfyUI again, by hand or on a timer. [Sync menu](../interface/Sync-Menu.md)
- **Token**: a piece of a word, the unit models count text in. Also the access token a server asks for: a password
  for programs.
- **Tour**: Graph ▸ Guided tour; the app walks through the graph node by node. [The tour of a graph](../graph/Tour.md)

## Words of ComfyUI

- **CFG**: how strictly the model follows the prompt. [CFG](../concepts/CFG.md)
- **Checkpoint**: the main model file that holds the model, its text encoder and its VAE.
  [Checkpoint](../concepts/Checkpoint.md)
- **CLIP, text encoder**: the part that turns your words into numbers the model follows.
  [Text encoders](../concepts/Text-Encoders.md)
- **Conditioning**: the encoded prompt a sampler follows. [Conditioning](../concepts/Conditioning.md)
- **ControlNet**: guiding a picture with a pose, depth or edges. [ControlNet](../concepts/ControlNet.md)
- **Custom nodes, node pack**: nodes made by other people, installed into ComfyUI. [Node packs](../concepts/Node-Packs.md)
- **Denoise**: how much of the starting picture is redrawn. [Denoise](../concepts/Denoise.md)
- **Family**: models that share a design and fit together (SD 1.5, SDXL, Flux, Wan…).
  [Model families](../concepts/Model-Families.md)
- **Latent**: the compressed picture the model works on. [Latent](../concepts/Latent.md)
- **Link**: a line from an output of one node to an input of another. [Nodes and links](../concepts/Nodes-And-Links.md)
- **LoRA**: a small add-on file that changes style or subject. [LoRA](../concepts/LoRA.md)
- **Negative prompt**: what you do not want in the picture. [The negative prompt](../concepts/Negative-Prompt.md)
- **Node**: one block of the graph that does one thing. [Nodes and links](../concepts/Nodes-And-Links.md)
- **Prompt**: the text that describes what you want. [The prompt](../concepts/Prompt.md)
- **Queue**: where ComfyUI puts a workflow to run. NodeWise Studio never touches it.
  [What ComfyUI is](../concepts/What-Is-ComfyUI.md)
- **Sampler**: the node that makes the picture step by step. [Sampler](../concepts/Sampler.md)
- **Scheduler**: how noise is removed over the steps. [Scheduler](../concepts/Scheduler.md)
- **Seed**: the number that makes a result repeatable. [Seed](../concepts/Seed.md)
- **Steps**: how many times the sampler works on the picture. [Steps](../concepts/Steps.md)
- **Subgraph**: several nodes packed into one. [Subgraphs](../graph/Subgraphs.md)
- **Type**: what a link carries: MODEL, CLIP, VAE, LATENT, IMAGE, CONDITIONING and others.
  [Data types](../concepts/Data-Types.md)
- **VAE**: turns a latent into a picture and back. [VAE](../concepts/VAE.md)
- **Widget, field**: a value set on a node, such as steps or a file name. [Node fields](../graph/Node-Fields.md)
- **Workflow**: a graph saved as a file that ComfyUI opens. [Workflow formats](../concepts/Workflow-Formats.md)

## See also

- [Reference](README.md)
- [Start here](../concepts/Start-Here.md)
- [Code words and screen words](../dev/Code-Words.md)
