[Русский](Settings-Assistant.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Assistant

"Which model the assistant talks to, and how it behaves in a turn." The upper half chooses who answers; the lower half, **Behaviour**, sets how the assistant works. Step by step for each kind of model: [Choosing who answers](../assistant/Choosing-Who-Answers.md).

<!-- picture: the Assistant section with Own server chosen and the model list open -->

## Provider

Six cards (five in an installed app): **Not chosen** ("The assistant is off."), **OpenAI**, **Anthropic**, **Google Gemini** ("Cloud. Needs a key."), **Own server** ("Ollama, LM Studio, vLLM on this or another computer") and, in a developer build only, **TEST mode**. A badge on each card tells its state: **No key**, **Key for this session**, **Ready**, **Needs an address**, **In app**.

## For a cloud provider

- **OpenAI key** (or Anthropic, Google Gemini): paste the key. The app checks it at once: "Key accepted: 12 models are available. It is kept while the app is open." or "The provider did not accept this key. Check it and paste it again."
- **Remember on this computer** keeps the key in the system password store. Where that is not available: **Remember in the app folder**, unencrypted, readable only by your user. **Forget key** removes it.
- **Server address (optional)**: leave empty for the official address. Only for your own proxy, and only https.
- See [Keys and where they are kept](../assistant/Keys.md).

## For your own server

- **Base URL**: the address with its port, for example `http://127.0.0.1:11434/v1` for Ollama. **Find local servers** looks on this computer (and asks the MCP server); found servers are in the list of the field.
- The app reads the server's model list as soon as there is an address.

## Model

Pick from the list ("Pick from 12 models on the server") or type the name. **Refresh list** reads it again. Marks next to a model: **tools**, **no tool calls**, **vision**, **thinking**. A model without tool calls gets the warning "This model cannot call tools; the assistant needs them to read the catalog and build." When there is no list, **Suggestions (you choose; any model name works):** offers a few names.

## Check connection

Sends one short request with the fields above. "The model answered in 840 ms." For your own server it also says the context window, for example "Context window on the server: 4096 tokens. That is too small…". See [The context window](../assistant/Context-Window.md).

## Behaviour

| Field | Default | What it does |
|---|---|---|
| **When I ask for a change** | **Suggest first (grey drafts)** | With **Build directly**, a request for a change in Ask mode is built at once instead of offered as drafts. |
| **Steps per answer** | 60 (from 4 to 200) | After this many actions the assistant pauses and asks whether to go on. A text-to-image build takes about 16. |
| **Context window (tokens)** | 0 = auto | The size of the model's memory. Auto takes it from the model name, from the server, or 32 000. |
| **Allow web search**, **Allow reading web pages** | on | "Used only when your catalog cannot answer. Answers from the web carry their link." |
| **Answer language** | **Same as the interface** | or **English**, **Russian** |
| **Answer length** | **Short** | or **Fuller** |

## See also

- [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- [Keys and where they are kept](../assistant/Keys.md)
- [Web search and pages](../assistant/Web-Search.md)
- [Settings](Settings.md)
