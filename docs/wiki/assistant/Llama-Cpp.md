[Русский](Llama-Cpp.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# llama.cpp server

llama.cpp is a program that runs models in the GGUF format; its `llama-server` speaks the OpenAI-compatible API. Nothing leaves your computer, and there is no key.

## How to set it up

1. Start the server with a model that can call tools, a context of at least 16 384 tokens, and tool calling on, for example:
   `llama-server -m model.gguf -c 16384 --jinja`
   It answers at `http://127.0.0.1:8080` by default.
2. In the app: Settings ▸ Assistant ▸ **Own server**. Type `http://127.0.0.1:8080/v1` into **Base URL** (the app does not look on port 8080 by itself).
3. **Model**: the server lists the model it runs; pick it.
4. **Check connection**. The app reads the context size the server was started with (`-c`) and says whether it is enough.
5. **Save settings**.

## The context window

It is the `-c` (or `--ctx-size`) of `llama-server`. If the app says "That is too small", restart the server with a larger number. See [The context window](Context-Window.md).

## What can go wrong

- "The model server does not answer." The server is not running or uses another port.
- Tool calls fail or come back as text: the server was started without tool calling, or the model's chat template does not support tools.

<!-- verify: the providers branch may add llama.cpp to the servers the app looks for by itself -->

## See also

- [vLLM and other compatible servers](vLLM.md)
- [The context window](Context-Window.md)
- [Choosing who answers](Choosing-Who-Answers.md)
