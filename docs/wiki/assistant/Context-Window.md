[Русский](Context-Window.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Conversation capacity and model context

The context window holds the instructions, graph, tool descriptions, conversation and answer together. Tokens are pieces of text. When this capacity is too small, a server may drop the beginning of a request. The app shows the actual reported window and warns about truncation or little remaining room.

## Configure from the app

1. Open **Settings → Assistant** and select the server and installed model.
2. Leave **Conversation capacity → Automatic** unless you need a specific task mode. Automatic considers the recent request, room for tools and the answer, and the model's reported maximum. The other choices are conversation/small graphs, complex graphs, and long sessions.
3. Leave **Response style → Keep the model’s settings** to retain its own parameters, template and stop tokens. Focused reduces variation; Ideas increases it. Each choice explains its effect and its limits.
4. For local Ollama, press **Apply dialogue mode to Ollama**. The app creates a configuration using the existing weights, loads it, checks the real window, and verifies explicitly selected generation parameters. It does not download weights or edit a system service. **Save settings** selects the verified configuration for the assistant.
5. From a warning in chat, **Configure automatically** performs the same verification and saves the result immediately. Ask again after success.

More context uses more memory. Automatic sizing does not guarantee enough free RAM/VRAM; it checks the model limit and verifies loading. If loading fails, use a smaller mode/model or free memory in the model monitor. A failed or unconfirmed operation does not switch the assistant to the new configuration.

## Monitoring and stopping

**Models on this server** refreshes while Assistant settings is open. It shows the actual loaded models, model allocation, video-memory allocation and reported context. These values belong to the selected server, which may be another computer. Unknown values are labelled as not reported.

**Stop assistant response** cancels the app's active answer. **Unload and free memory** unloads a model without deleting its files; another request may load it again. **Load selected model** loads it with an empty request. Load/unload success is checked against the server's list, and is unavailable during the app's answer. Other apps sharing this server may be affected by unloading.

## Other providers and small windows

The app can read window information exposed by Ollama, LM Studio, llama.cpp and vLLM. Configuration and load/unload in this version require Ollama's native API. A generic OpenAI chat endpoint cannot change the server's loaded context. The interface explains unavailable management instead of claiming success. Ollama cloud models manage their window at the provider.

For other providers, the capacity choice budgets conversation sent by the app. A smaller actual server window takes precedence. At small or unknown windows the assistant offers a compact tool set, retaining resource assessment and tools relevant to a requested blueprint or subgraph. Ask still cannot directly edit the graph. Short questions, a fresh conversation or a model with more context reduce pressure.

## See also

- [Settings: Assistant](../interface/Settings-Assistant.md)
- [Ollama](Ollama.md)
- [Failed answers](Failed-Answers.md)
