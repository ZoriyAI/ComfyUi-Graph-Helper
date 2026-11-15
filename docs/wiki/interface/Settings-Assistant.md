[Русский](Settings-Assistant.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Assistant

"Which model the assistant talks to, and how it behaves in a turn." The upper half chooses who answers; **Network** sets a proxy; **Behavior** sets how the assistant works. Step by step for each kind of model: [Choosing who answers](../assistant/Choosing-Who-Answers.md).

<!-- picture: the Assistant section with Your own server chosen and the model list open -->

## Provider

Six cards in an installed app: **Not chosen** ("The assistant is off."), **OpenAI**, **Anthropic**, **Google Gemini** ("Cloud. Needs a key."), **OpenAI-compatible** ("Another cloud service at its own address. Needs its key.") and **Your own server** ("Ollama, LM Studio, vLLM on this or another computer"). A developer run of the app also shows **TEST mode**. A badge on each card tells its state: **No key**, **Key for this session**, **Ready**, **Needs an address**, **Built-in**.

## For OpenAI, Anthropic and Google Gemini

- **OpenAI key** (or Anthropic, Google Gemini): paste the key. It applies at once, and the app checks it by reading the model list: "Key accepted: 12 models are available. It is kept while the app is open." or "The provider did not accept this key. Check it and paste it again."
- **Remember on this computer** keeps the key encrypted in the system keychain. Where that is not available: **Remember in the app folder**, unencrypted, readable only by your user. **Forget key** removes it. See [Keys and where they are kept](../assistant/Keys.md).
- **Server address (optional)**: leave empty for the official address. Only for your own proxy, and only https. A key works only with the address it was pasted for.
- For OpenAI also **Organization (optional)** and **Project (optional)**: only if your key belongs to several organizations or projects.
- **Which model to take**: **To start** (the cheaper model) and **For long builds** (the stronger one), each with its price per million tokens sent and received and the date of the prices. "Cloud requests cost money and the provider bills you." **Get a key** and **What the provider does with your data** are shown as addresses with **Copy the address**; the app opens no browser itself.
- A sentence lists what goes out with each question: your message, the graph with its field values (unless you turned them off under Privacy), what is selected and on screen, your recent actions, and a summary of your nodes and model files. Keys and the files themselves are never sent.
- The provider's own web search is billed separately: "about $10 per 1000 searches" for OpenAI and Anthropic, $14 for Google. See [Web search and pages](../assistant/Web-Search.md).

## For an OpenAI-compatible service

Any cloud service that speaks the OpenAI chat interface: a gateway or a regional provider, for example where the big three are not available.

1. **Service address**: its address in full, with https, usually ending in /v1.
2. The key field waits for the address ("Type the service address above first: the key belongs to that address."). Then paste the service's own key; it goes only to that address.
3. Pick the model from the service's list or type its name.

See [OpenAI-compatible services](../assistant/OpenAI-Compatible.md).

## For your own server

- **Server address**: the address with its port, for example `http://127.0.0.1:11434/v1` for Ollama.
- **Find local servers** looks on this computer at the ports of Ollama (11434), LM Studio (1234), vLLM (8000) and the llama.cpp server (8080), and asks the MCP server when there is one. Found servers are in the list of the field. When nothing answers: "No local server answered. To have a model on this computer, install Ollama (ollama.com/download) and run “ollama pull qwen3.5:9b” (about 7 GB). Or start LM Studio, vLLM or llama.cpp’s server, or type its address."
- **Key for this server (optional)**: only if your server asks for one (vLLM started with --api-key, LiteLLM, LM Studio with authentication on).
- The app reads the server's model list as soon as there is an address. Advice shows which models do the job and how much video memory they need: qwen3.5:9b about 8 GB, gpt-oss:20b about 16 GB, qwen3.6:27b about 24 GB, with a window of at least 16 384 tokens (estimates; more models by hardware in [Which model to take](../assistant/Which-Model.md)). "A model on your own computer costs nothing per question, and nothing leaves the computer."

## Model

Pick from the list ("Pick from 12 models on the server") or type the name. **Refresh list** reads it again. Only chat models are listed. Marks next to a model: **tools**, **no tool calls**, **vision**, **thinking**, **window up to N**. A model without tool calls gets the warning "This model cannot call tools; the assistant needs them to read the catalog and build." When there is no list, **Suggestions (you choose; any model name works):** offers a few names.

## Test connection

**Test connection** sends one short request with the fields above. "The model answered in 840 ms." For your own server it also says the context window, for example "Context window on the server: 4096 tokens. That is too small…".

When the window is small and the server is Ollama, **Make a copy with a 16,384-token window** makes a copy of the model that loads with a larger window. The copy uses the same files: nothing is downloaded. It needs more memory than the original. **How to set the window by hand** covers Ollama as a Linux service, Ollama in a container, Ollama on another computer, LM Studio ("Context Length") and the llama.cpp server (`-c 16384 --jinja`). See [The context window](../assistant/Context-Window.md).

## Network

**Proxy (optional)**: empty means the proxy of your system. Requests to cloud models and the web search go through it. Accepted forms: http://, https://, socks4:// and socks5://, a host and a port, without a user name or password ("This is not a proxy address…" otherwise). Your own server is always reached directly.

## Behavior

| Field | Default | What it does |
|---|---|---|
| **When I ask for a change** | **Suggest first (grey drafts)** | The mode the assistant's box opens in. Ask answers and offers grey drafts that go in only when you accept them. **Build directly** opens in Build. |
| **Steps per answer** | 60 (from 4 to 200) | After this many actions the assistant pauses and asks whether to go on. A text-to-image build takes about 16. |
| **Context window (tokens)** | 0 = auto | The size of the model's memory. Auto takes it from the model name, from the server, or a default. |
| **Allow web search**, **Allow reading web pages** | on | "Used only when your catalog cannot answer. Answers from the web carry their link." |
| **Answer language** | **Same as the interface** | or **English**, **Russian** |
| **Answer length** | **Short** | or **Detailed** |

## See also

- [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- [Which model to take](../assistant/Which-Model.md)
- [Keys and where they are kept](../assistant/Keys.md)
- [Web search and pages](../assistant/Web-Search.md)
- [Settings](Settings.md)
