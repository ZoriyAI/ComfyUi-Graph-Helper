[Русский](Which-Model.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Which model to take

The assistant works with many models, but not all of them build well. This page says which ones the app suggests, what a cloud model costs and how much memory a model on your own computer needs. The same advice is in Settings ▸ Assistant under **Which model to take** and under the model list of your own server.

## What every model needs

- **It must call tools.** The assistant reads your catalog and changes the graph through tools. The model list marks each model **tools** or **no tool calls**. A model that cannot call tools is asked again without them: it then answers only from the graph it was sent, and the chat says "Answered without tools". It cannot build or offer drafts.
- **A large enough context window**: 16 384 tokens or more for a model on your own computer. See [The context window](Context-Window.md).
- **Bigger builds better.** A small model answers simple questions but often loses its way in a long build.

## Cloud models

For each cloud provider the app suggests two models: one **To start** (cheaper) and one **For long builds** (stronger). Prices are in US dollars per million tokens, as of 14 November 2026. The provider's own page has the current prices, and the provider's bill is the truth.

| Provider | To start | For long builds | Its web search |
|---|---|---|---|
| OpenAI | `gpt-6-luna`: $0.10 sent, $0.50 received | `gpt-6.1-sol`: $2 sent, $10 received | about $10 per 1000 searches |
| Anthropic | `claude-haiku-5-5`: $0.10 sent, $0.50 received | `claude-sonnet-5-5`: $2 sent, $10 received | about $10 per 1000 searches |
| Google Gemini | `gemini-3.5-flash-lite`: $0.30 sent, $2.50 received | `gemini-4-hydrogen`: $1.50 sent, $7.50 received | about $14 per 1000 searches |

What a request costs: "A short question is a fraction of a cent; a build of a dozen steps sends tens of thousands of tokens." The live model list of your key always wins: you can pick any model it offers.

An OpenAI-compatible service has its own prices; the app shows none for it. See [OpenAI-compatible services](OpenAI-Compatible.md).

## A model on your own computer

"A model on your own computer costs nothing per question, and nothing leaves the computer." The app suggests these Ollama models, loaded with a window of 16 384 tokens:

| Model | Video memory (or, slower, system memory) |
|---|---|
| `qwen3:8b` | about 8 GB (about 5 GB to download) |
| `qwen3:14b` | about 12 GB |
| `qwen3:30b` | about 24 GB |

To start: install Ollama (ollama.com/download), then run `ollama pull qwen3:8b`. See [Ollama](Ollama.md). Other servers (LM Studio, the llama.cpp server, vLLM) can run the same models under their own names.

## See also

- [Choosing who answers](Choosing-Who-Answers.md)
- [Settings: Assistant](../interface/Settings-Assistant.md)
- [The context window](Context-Window.md)
- [What is sent to the model](What-Is-Sent.md)
