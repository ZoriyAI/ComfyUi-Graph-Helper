[Русский](LM-Studio.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# LM Studio

LM Studio is a desktop program that downloads and runs language models, with a local server that speaks the OpenAI-compatible API. Nothing leaves your computer, and no key is needed unless you switched on authentication in LM Studio: then paste its key in **Key for this server (optional)**.

## How to set it up

1. In LM Studio, download a model that can call tools (LM Studio marks such models), and load it with a context length of at least 16 384.
2. Start its local server (in LM Studio's developer or server view). By default it answers at `http://127.0.0.1:1234`.
3. In the app: Settings ▸ Assistant ▸ **Your own server**. The app finds LM Studio by itself at `http://127.0.0.1:1234/v1` ("found on this computer"); or type the address.
4. **Model**: pick the loaded model from the list.
5. **Test connection**. The app reads the context length LM Studio loaded the model with and says whether it is enough.
6. **Save settings**.

## The context window

LM Studio sets it when it loads the model. If the app says "That is too small", load the model again in LM Studio with a larger context length. See [The context window](Context-Window.md).

## What can go wrong

- "The model server does not answer." The server in LM Studio is not started, or runs on another port.
- "The server answered, but not as a model. Check the address in the assistant settings." The address misses `/v1`, or points to something else.
- "This model cannot call tools." Choose another model.

## See also

- [Choosing who answers](Choosing-Who-Answers.md)
- [Ollama](Ollama.md)
- [The context window](Context-Window.md)
- [Failed answers](Failed-Answers.md)
