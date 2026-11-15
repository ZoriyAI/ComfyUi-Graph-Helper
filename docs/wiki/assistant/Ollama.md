[Русский](Ollama.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Ollama

Ollama runs language models on your own computer. The app talks to it through its OpenAI-compatible address. Nothing leaves your computer, and there is no key. Ollama itself is installed from its own site (ollama.com/download); this page starts when it is installed. The **No ComfyUI yet** card of the welcome screen has **Open the Ollama download page**.

## How to set it up

1. Start Ollama and download a model that can call tools, in a terminal. The app suggests `ollama pull qwen3:8b` (about 5 GB to download, about 8 GB of video memory). `qwen3:14b` needs about 12 GB, `qwen3:30b` about 24 GB. Bigger models build better. See [Which model to take](Which-Model.md).
2. Raise the context window to at least 16 384 tokens (see below). Ollama's own default is small.
3. In the app: Settings ▸ Assistant ▸ **Your own server**.
4. The app looks for local servers by itself (**Find local servers** does it again). Ollama is found at `http://127.0.0.1:11434/v1` and shows in the list of **Server address** as "found on this computer". Pick it, or type the address.
5. **Model**: pick from the list ("Pick from 3 models on the server"). Only chat models are listed. The list marks **tools** or **no tool calls**, **vision**, **thinking** and **window up to N**.
6. **Test connection**: "The model answered in 900 ms." and the context window: "Context window on the server: 16384 tokens. The assistant's requests fit."
7. **Save settings**.

## The context window

Ollama loads a model with a fixed window and silently drops what does not fit. The app reads the real window from Ollama while the model is loaded and warns you when it is too small.

The easiest way: after **Test connection**, when the window is small, press **Make a copy with a 16,384-token window**. Ollama makes a copy of the model that loads with the larger window; the copy uses the same files, so nothing is downloaded, and it is chosen as the model at once. Press **Test connection** again to see the new window, then save the settings. The copy needs more memory than the original.

To raise the window for every model by hand on Linux, when Ollama runs as a service:

```
sudo systemctl edit ollama.service
```

Add these two lines in the editor, save and close:

```
[Service]
Environment="OLLAMA_CONTEXT_LENGTH=16384"
```

Then restart it:

```
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

When you start Ollama by hand instead: `OLLAMA_CONTEXT_LENGTH=16384 ollama serve`. In a container: add `-e OLLAMA_CONTEXT_LENGTH=16384` to the command that starts it. On another computer, set the same variable the way that computer starts Ollama; on Windows and macOS it is an environment variable for the Ollama app. **How to set the window by hand** in Settings ▸ Assistant says the same. A larger window needs more memory; if the model gets slow or does not load, choose a smaller size or a smaller model. The app shows these same commands, with a **Copy** button, when an answer was cut. More: [The context window](Context-Window.md).

## Ollama on another computer

Type its address, for example `http://192.168.1.50:11434/v1`. Ollama must listen on the network (`OLLAMA_HOST=0.0.0.0`). Your messages and the graph then travel over the network, and over `http` they are not encrypted.

## What can go wrong

- "No local server answered. To have a model on this computer, install Ollama (ollama.com/download) and run “ollama pull qwen3:8b” (about 5 GB). Or start LM Studio, vLLM or llama.cpp’s server, or type its address."
- "Ollama did not make the copy. Set the window by hand as described below." Set it by hand.
- "The model server does not answer. Check that it is running and the address in the assistant settings."
- "Choose the model on your own server: pick it from the list under the field in Assistant."
- "The model read only part of the request": the window is too small.

## See also

- [The context window](Context-Window.md)
- [Choosing who answers](Choosing-Who-Answers.md)
- [Failed answers](Failed-Answers.md)
- [Another computer](../connect/Another-Computer.md)
