[Русский](Choosing-Who-Answers.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Choosing who answers

"Who answers" is the language model behind the assistant. It can be a cloud model (OpenAI, Anthropic, Google Gemini: you need a key, and the provider bills you) or a model on your own computer or another one in your home (Ollama, LM Studio, a llama.cpp server, vLLM, or any server that speaks the OpenAI-compatible API: free, private, but needs a good graphics card). Lessons need none of them.

## How to choose

1. Open Settings ▸ Assistant: the gear ▸ **Assistant**, **Assistant ▸ Assistant settings…**, or **Choose…** on the welcome card.
2. Pick a card under **Provider**.
3. Fill in what that kind needs (below), pick the **Model**, press **Check connection**.
4. **Save settings**.

Later you can switch between the ones you set up with the chooser on the toolbar or **Assistant ▸ Who answers**; the choice is saved at once.

## What each kind needs

| Kind | Needs | Page |
|---|---|---|
| **OpenAI** | a key, a model name | [OpenAI](OpenAI.md) |
| **Anthropic** | a key, a model name | [Anthropic](Anthropic.md) |
| **Google Gemini** | a key, a model name | [Google Gemini](Google.md) |
| **Own server**: Ollama | the address (`http://127.0.0.1:11434/v1`), a model | [Ollama](Ollama.md) |
| **Own server**: LM Studio | the address (`http://127.0.0.1:1234/v1`), a model | [LM Studio](LM-Studio.md) |
| **Own server**: llama.cpp | the address of `llama-server` (often `http://127.0.0.1:8080/v1`), a model | [llama.cpp server](Llama-Cpp.md) |
| **Own server**: vLLM or another compatible server | its address with `/v1`, a model | [vLLM and other compatible servers](vLLM.md) |

## How to pick a model

- **It must call tools.** The assistant reads your catalog and builds through tools. The model list marks each model **tools** or **no tool calls**; a model without tools gets "This model cannot call tools; the assistant needs them to read the catalog and build."
- **Bigger is better at building.** A small local model (a few billion parameters) answers simple questions but often loses its way in a build.
- **The context window matters** for a local model: 16 384 tokens or more. See [The context window](Context-Window.md).

## Cloud or local?

| | Cloud | Own server |
|---|---|---|
| Cost | the provider bills per use | free, your electricity |
| Privacy | your messages and graph go to the provider | stay on your computers |
| Quality for building | high | depends on the model and your hardware |
| Setup | paste a key | install and start a server |

What goes where: [What is sent to the model](What-Is-Sent.md).

## See also

- [Settings: Assistant](../interface/Settings-Assistant.md)
- [Keys and where they are kept](Keys.md)
- [Working without a model](Without-A-Model.md)
- [Privacy](../trust/Privacy.md)
