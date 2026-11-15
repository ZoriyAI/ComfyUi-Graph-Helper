[Русский](Which-Model.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Which model to take

The assistant works with many models, but not all of them build well. This page helps you choose one for what you have: a graphics card, a computer without one, a key for a cloud provider, or Ollama's own cloud. It says what a model must be able to do, which models fit which hardware, what the cloud ones cost, what is sent where, and how to check a model in two minutes. The short version of this advice is in Settings ▸ Assistant under **Which model to take**.

Checked on 15 November 2026 against Ollama's library and documentation, the providers' model and pricing pages and the models' cards on Hugging Face. Names, tags and prices change; the page of the model or the provider is the truth.

**Not tried on real hardware.** The project tests the assistant against a scripted model, not against these models on real graphics cards. The advice comes from what the app needs and from what the models' own pages say. Memory figures are estimates. If a model worked or failed for you, please tell others in the project's Discussions.

## What a model must be able to do

- **Call tools.** The assistant reads your graph and your catalog, looks things up and builds through tools, one call at a time; a text-to-image build takes about 16 calls, and the assistant pauses after **Steps per answer** (60 by default, Settings ▸ Assistant). The model list marks each model **tools** or **no tool calls**. A model without tools is asked again without them: it then answers only from the graph it was sent, and the chat says **Answered without tools**. It cannot build, offer drafts or draft lessons.
- **Read enough at once.** A model on your own computer needs a context window of at least 16 384 tokens: the assistant's request alone takes 3 to 6 thousand. Under 16 000 the app offers fewer tools; a build has little room. Ollama's own documentation suggests 64 000 for agents, when memory allows. See [The context window](Context-Window.md).
- **Write clean tool calls.** Every build step and every lesson draft is a call with exact fields. A lesson draft is a whole lesson file in one call; the app checks it strictly and sends the problems back, so a weak model may try several times.
- **Answer in your language.** The app asks for answers in Russian or English, as you wrote or as set in Settings. Descriptions for ComfyUI (prompts) are written in English either way.
- **Not needed:** pictures (vision). The app never sends images to the model. A "vision" mark in the list is only information. Thinking ("thinking" mark) is not needed either; on your own computer its text takes room in the window.

## Choose by what you have

1. **A graphics card with 8 GB or more of video memory**, and you want everything to stay on your computer: a model through Ollama. See the table below.
2. **No graphics card**, 16 to 32 GB of ordinary memory: a small model through Ollama works, slowly. For long builds a cloud model is more pleasant.
3. **No hardware, but you are fine with the cloud**: a key from OpenAI, Anthropic or Google, an OpenAI-compatible service, or Ollama's cloud. You pay per use, and your messages and graph go to that company.
4. **Adult (18+) work**: see [Adult work](#adult-18-work) below.

## A model on your own computer (Ollama)

A model on your own computer costs nothing per question, and with a local model nothing leaves the computer. How to set it up: [Ollama](Ollama.md). Other servers (LM Studio, the llama.cpp server, vLLM) can run the same models under their own names.

**Memory, roughly:** the download size plus 1 to 3 GB at 16 384 tokens. Ollama publishes only download sizes, so the figures below are our estimates. A model that does not fit runs partly in ordinary memory and gets much slower; `ollama ps` shows how much runs on the graphics card.

| What you have | Model (Ollama tag) | Download | Memory at 16 384 tokens (estimate) | Good for |
|---|---|---|---|---|
| 8 GB of video memory | `qwen3.5:9b` | 6.6 GB | about 8 GB, tight | questions, short builds |
| 8 GB of video memory | `qwen3.5:4b` | 3.3 GB | about 5 GB | questions |
| 12 GB | `qwen3.5:9b` | 6.6 GB | about 8 GB | questions, builds of a few steps |
| 12 GB | `gemma4:12b` | 8.0 GB | about 10 GB | the same, another family to compare |
| 16 GB | `gpt-oss:20b` | 14 GB | about 16 GB (its page: "as little as 16GB") | builds |
| 16 GB | `qwen3.5:9b-q8_0` | 10 GB | about 12 GB | a more exact copy of the 9B |
| 24 GB | `qwen3.6:27b` | 17 GB | about 20 GB | long builds, lesson drafts |
| 24 GB | `gemma4:26b` | 18 GB | about 20 GB | builds; quicker, only 4B parameters work per word |
| No graphics card, 16 GB of memory | `qwen3.5:4b` | 3.3 GB | about 5 GB | questions, slowly |
| No graphics card, 32 GB of memory | `gpt-oss:20b` or `qwen3.6:35b` | 14 GB or 23 GB | about 16 or 26 GB | builds, slowly; only a few billion parameters work per word, so they are quicker than their size suggests |

What the models' pages say about them:

| Model | Licence | Languages | Worth knowing |
|---|---|---|---|
| `qwen3.5` (4b, 9b) | Apache 2.0 | 201 languages and dialects | thinks before answering by default; its card advises a large window for thinking, so a 16 384 window fills sooner |
| `qwen3.6` (27b, 35b) | Apache 2.0 | not listed on the card | made for agent work and tool calling; 35b is a mixture of experts with 3B active |
| `gemma4` (12b, 26b) | Apache 2.0 | 35+ out of the box, 140+ in training | native function calling; 26b is a mixture of experts with about 4B active |
| `gpt-oss:20b` | Apache 2.0 | not stated on the card | text only; 21B parameters, 3.6B active |

**What the app suggests.** Settings ▸ Assistant suggests `qwen3.5:9b` (about 8 GB), `gpt-oss:20b` (about 16 GB) and `qwen3.6:27b` (about 24 GB). Until November 2026 it suggested `qwen3:8b`, `qwen3:14b` and `qwen3:30b`: they still call tools and still work, but their family is a year older, and the window that Ollama lists for `qwen3:8b` and `qwen3:14b` is 40 960 tokens against 256 000 for the newer ones.

**Weak spots.** Small models (4 to 9 billion parameters) answer simple questions but often lose their way in a long build: they pick a node you do not have, repeat a step, or stop making sense. Use a current version of Ollama: tool calling of new families is often fixed in later versions.

## Ollama's cloud

Ollama also runs larger models in its own cloud, reached through the same Ollama. **Such a model is not local:** your messages, your graph and the catalog summary go to Ollama's servers (mainly in the United States, sometimes Europe). Ollama says it does not log or store them and does not train on them. You need an Ollama account and pay per use; Ollama's pricing page lists plans from pay-as-you-go to monthly ones with included usage.

Some cloud models that call tools, with Ollama's prices per million tokens sent and received:

| Model (name through your Ollama) | Sent / received | Window | Use |
|---|---|---|---|
| `gemma4:cloud` | $0.14 / $0.40 | 256K | to start |
| `glm-5.3-flash:cloud` | $0.15 / $0.50 | 1M | to start; MIT licence |
| `gpt-oss:120b-cloud` | $0.15 / $0.60 | 128K | to start |
| `deepseek-v4.1-flash:cloud` | $0.30 / $1.20 (half outside 12:00 to 18:00 UTC on weekdays) | 1M | builds |
| `glm-5.3:cloud` | $1.40 / $4.40 | 1M | long builds |
| `kimi-k3.1-pro:cloud` | $2.00 / $10.00 | 1M | long builds |

Two ways to use one in the app, **neither tried by the project yet**:

- **Through your Ollama.** Sign in to Ollama (in its app, or `ollama signin` in a terminal), then use **Your own server** as for a local model and type the name with `:cloud`, for example `gemma4:cloud`. Ollama's documentation says its local interface accepts such names after you sign in. The app knows such a name and never calls the model local: the model list marks it **Ollama's cloud**, and Settings ▸ Assistant, the assistant chip in the top bar, Settings ▸ Privacy and the conversation log say that your question and the graph leave this computer through Ollama. If the app cannot read the window of such a model, it saves room and offers the model fewer tools. **Make a copy with a 16,384-token window** is not for cloud models; Ollama gives them their full window.
- **As an OpenAI-compatible service.** Settings ▸ Assistant ▸ **OpenAI-compatible**, address `https://ollama.com/v1`, a key from your Ollama account, and the model's name without `:cloud` as Ollama's cloud list gives it. The app then treats it as the cloud service it is. See [OpenAI-compatible services](OpenAI-Compatible.md).

To keep your Ollama strictly local, start it with `OLLAMA_NO_CLOUD=1`: its cloud models and web search are then off.

## Cloud providers

For each cloud provider the app suggests two models: one **To start** (cheaper) and one **For long builds** (stronger). Prices are in US dollars per million tokens, as of 15 November 2026. The provider's own page has the current prices, and the provider's bill is the truth.

| Provider | To start | For long builds | Its web search |
|---|---|---|---|
| OpenAI | `gpt-6-luna`: $0.10 sent, $0.50 received | `gpt-6.1-sol`: $2 sent, $10 received | about $10 per 1000 searches |
| Anthropic | `claude-haiku-5-5`: $0.10 sent, $0.50 received | `claude-sonnet-5-5`: $2 sent, $10 received | about $10 per 1000 searches |
| Google Gemini | `gemini-3.5-flash-lite`: $0.30 sent, $2.50 received | `gemini-4-hydrogen`: $1.50 sent, $7.50 received | about $14 per 1000 searches after 5000 free a month |

Worth knowing:

- Claude Haiku 5.5 costs $0.50 and $2.50 when a single request is longer than 100 000 tokens. The assistant's requests are far shorter.
- Google has announced higher prices: `gemini-4-carbon` and `gemini-4-argon` from 1 December 2026, `gemini-3.8-flash` and `gemini-3.6-flash` from 1 January 2027. The two models the app suggests are not on that list.
- The strongest models (for example `claude-opus-5-5`, `gpt-6-astra`) cost several times more and are rarely needed for a graph.

What a request costs: "A short question is a fraction of a cent; a build of a dozen steps sends tens of thousands of tokens." The live model list of your key always wins: you can pick any model it offers.

## OpenAI-compatible services

Many services run open models behind the OpenAI chat interface. The app shows no prices for them; see the service's own page. These are widely used and offer open models that call tools; they are named as examples, not endorsed, and not tried with the app:

| Service | Address | Models that call tools |
|---|---|---|
| OpenRouter | `https://openrouter.ai/api/v1` | many; its model list can be filtered by tool support |
| Groq | `https://api.groq.com/openai/v1` | Groq says all its models call tools, for example `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` |
| Together AI | `https://api.together.ai/v1` | function calling through chat completions |
| Ollama's cloud | `https://ollama.com/v1` | see [Ollama's cloud](#ollamas-cloud) |

A gateway may pass your request to another company that hosts the model; its own page says which. Setup: [OpenAI-compatible services](OpenAI-Compatible.md).

## What size is enough

| What you do | Enough | Better |
|---|---|---|
| Quick questions (**Ask**) | a 4 to 9B model on your computer, or a provider's **To start** model | |
| Building graphs (**Build**) | a 9B model for a few steps | 20 to 30B on your computer, or a **For long builds** model |
| Drafting lessons ("Draft a lesson") | a 20B model or a **To start** cloud model | 27B or larger, or a **For long builds** model |

**Learn** itself needs no model at all; only **Ask the assistant about this step** does. See [Learn](Learn.md).

## Try a model in two minutes

1. Settings ▸ Assistant: choose the model and press **Test connection**. Look for "The model answered in …" and, on your own server, "The assistant's requests fit." The model list should mark it **tools**.
2. **Ask** a question about your graph, for example "What does the KSampler do here?". The answer should come in your language, and **What the assistant looked at** should show that it read something: then it called a tool.
3. Open a new project (**New project**), switch to **Build** and ask for a small one: "a picture from text with my checkpoint". You should see the nodes appear one by one and **Build · N steps**, then "Done: 7 nodes, …". Press **Check the graph**.
4. If the model cannot call tools, the chat says **Answered without tools** or, in the model list, "This model cannot call tools; the assistant needs them to read the catalog and build.", and nothing appears on the canvas. If it says "The model read only part of the request", the window is too small. "The assistant asked for a tool that is not available here" usually means the model is too small for the job.

One `Ctrl+Z` takes back the test build. More on the messages: [Failed answers](Failed-Answers.md).

## Adult (18+) work

NodeWise Studio has lessons for adults. They teach technique for lawful adult work made with the consent of everyone involved, and they stay closed until **Adult content (18+)** is on in Settings ▸ Privacy; see [Content rules](../trust/Content-Rules.md). The app adds no subject rules of its own to the assistant, but providers have their own: cloud assistants often decline questions about adult workflows, even about technique. A model on your own computer is not bound by a provider's policy. For open models the community also publishes builds with the refusals removed, often called "abliterated" or "uncensored", for example builds of the Qwen family on Ollama and Hugging Face. One that existed on 15 November 2026 and carries Ollama's **tools** mark is `huihui_ai/qwen3.5-abliterated`, with the tags `:9b` (6.6 GB) and `:27b` (17 GB); its Hugging Face pages state the Apache 2.0 licence, and its publisher warns that its safety filtering is reduced. Such builds are made by the community and not checked by this project; their quality and tool calling vary, so run the two-minute test. Read the licence and the source before you download, and keep to the usual model formats: some formats can run code when loaded (see [Unsafe model formats](../concepts/Unsafe-Model-Formats.md) and [Security](../trust/Security.md)). The boundaries stay the same whatever the model: never minors or anyone who looks like a minor, real people only with their consent, and nothing that is illegal where you live. The app's own rules hold whatever a model answers.

## What is sent where

| Your choice | Where your message, the graph and the catalog summary go |
|---|---|
| Ollama with a local model | only to your computer, or to the computer in your home that runs Ollama |
| Ollama with a `:cloud` model | through your Ollama to Ollama's cloud |
| OpenAI, Anthropic, Google | to that provider, under its data rules |
| An OpenAI-compatible service | to that service, and possibly to the company that hosts the model |

The list of what a question carries, and how to send less: [What is sent to the model](What-Is-Sent.md). Web search goes to the provider's own search or, for every other choice, from this computer to DuckDuckGo: [Web search and pages](Web-Search.md).

## See also

- [Choosing who answers](Choosing-Who-Answers.md)
- [Ollama](Ollama.md)
- [The context window](Context-Window.md)
- [What is sent to the model](What-Is-Sent.md)
- [Content rules](../trust/Content-Rules.md)
- [Settings: Assistant](../interface/Settings-Assistant.md)
