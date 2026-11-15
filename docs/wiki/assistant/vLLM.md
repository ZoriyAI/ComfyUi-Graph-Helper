[Русский](vLLM.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# vLLM and other compatible servers

Many servers speak the OpenAI-compatible API: vLLM, and others such as text-generation-webui, LocalAI or a gateway in front of several models. The app works with any of them through **Your own server**, as long as the server lists its models and supports tool calls. No key is sent to your own server, unless it asks for one.

## vLLM

1. Start vLLM with a model that can call tools, with tool calling switched on and a long enough context (`--max-model-len 16384` or more). By default it answers at `http://127.0.0.1:8000`.
2. In the app: Settings ▸ Assistant ▸ **Your own server**. The app finds vLLM by itself at `http://127.0.0.1:8000/v1`; or type the address.
3. Pick the **Model**, **Test connection** (the app reads `max_model_len` and says whether it is enough), **Save settings**.

## Any other compatible server

1. Find the address of its OpenAI-compatible endpoint; it usually ends with `/v1`.
2. Type it into **Server address**. If you leave out `http://`, the app tries it and fills in the address that worked.
3. Pick the **Model** from the list, or type its name if the server gives no list ("No list yet; type the model name").
4. **Test connection**, **Save settings**.

## Limits

- A server that asks for a key (vLLM started with `--api-key`, LiteLLM): paste it in **Key for this server (optional)**. It goes only to this address. Without it the chat says "Your server asks for a key. Paste it in the assistant settings under “Key for this server”."
- A cloud service with the OpenAI interface (not on your own computers) is set up as **OpenAI-compatible** instead: see [OpenAI-compatible services](OpenAI-Compatible.md).
- When the server does not report its context window, the app assumes one from the model name or 32 000 tokens; set the real one in **Context window (tokens)** if you know it.
- A server on another computer gets your messages and the graph; over `http` they travel unencrypted.

## What can go wrong

- "The server answered, but not as a model. Check the address in the assistant settings."
- "The server answered HTTP 404 to the model list request." The address is not the API root.
- "The server sent a reply that could not be read."

## See also

- [llama.cpp server](Llama-Cpp.md)
- [Ollama](Ollama.md)
- [The context window](Context-Window.md)
- [Failed answers](Failed-Answers.md)
