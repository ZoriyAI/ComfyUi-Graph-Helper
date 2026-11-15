[Русский](Context-Window.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# The context window

The context window is how much text a model can read at once: the instructions, your graph, the descriptions of the assistant's tools, the conversation and its own answer, all counted in tokens (a token is a piece of a word). The assistant's request alone takes 3 to 6 thousand tokens. A cloud model has room for far more. A model on your own server is loaded with a fixed window, often small, and the server silently drops what does not fit: the model then answers without having read the question.

## What the app does about it

- It reads the real window from your server (Ollama, LM Studio, a llama.cpp server, vLLM) when you press **Test connection** and while it answers.
- It keeps the newest messages within 70 % of the window and tells the model how many earlier messages it left out.
- Under 16 000 tokens it saves room: it offers the model fewer tools. "From the next question the assistant saves room: it offers the model fewer tools."
- When the window is small or not known, it sends a shorter plan of the graph from the first question, and keeps the data it sends within about a third of the window.
- It says so when the window is too small.

## What the app says

| Where | Text | What it means |
|---|---|---|
| Test connection | "Context window on the server: 32768 tokens. The assistant's requests fit." | fine |
| Test connection | "… The assistant will save room by offering the model fewer tools. For long builds and web search, 16384 or more is better" | works, but long builds may not |
| Test connection | "… That is too small: a request from the assistant with its tools takes 3 to 6 thousand, so no room is left for the answer and for build steps." | raise it before you ask |
| Above an answer | "The model's context window is almost full" | little room is left for a long build |
| Above an answer | "The model read only part of the request … so this answer may be random." | the answer cannot be trusted; raise the window and ask again |

## What to do when it is small

1. Raise the window on the server to at least 16 384 tokens:
   - **Ollama**: the variable `OLLAMA_CONTEXT_LENGTH` when the server starts, or `num_ctx` on the model. The steps with commands: [Ollama](Ollama.md). The app shows them too, under "How to do it (Ollama on Linux)", with **Copy**. Simpler: after **Test connection**, **Make a copy with a 16,384-token window** in Settings ▸ Assistant makes a copy of the model with the larger window, without downloading anything.
   - **LM Studio**: load the model again with a larger "Context Length", or set it in the model's default settings.
   - **llama.cpp**: start `llama-server` with a larger `-c`, and with `--jinja`, which tool calling needs.
   - **vLLM**: a larger `--max-model-len`.
2. A larger window needs more memory. If the model gets slow or does not load, choose a smaller window or a smaller model.
3. Ask again.

If you cannot raise it: ask short questions, prefer **Ask** to long builds, start a new conversation (Settings ▸ Privacy ▸ **Clear chat history**), or use a cloud model.

## The setting

Settings ▸ Assistant ▸ **Context window (tokens)**: 0 means auto ("as your server loaded the model", "known model", or 32 000 for an unknown model). A number you set wins, except that a smaller window reported by the server is believed.

## See also

- [Ollama](Ollama.md)
- [Settings: Assistant](../interface/Settings-Assistant.md)
- [Failed answers](Failed-Answers.md)
- [Limits of the assistant](Limits.md)
