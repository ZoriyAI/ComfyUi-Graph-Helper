[Русский](Web-Search.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Web search and pages

When your catalog and the app's own knowledge cannot answer, the assistant may search the web and read a page, for example the page of a node pack or of a model. "Used only when your catalog cannot answer. Answers from the web carry their link." Both are on by default, and both can be turned off.

## How it works

- **Search.** OpenAI and Anthropic, on their official address, search with their own web search. Google Gemini 3 models do too. Every other case (your own server, an older Gemini model, a proxy address) uses a search the app makes itself from this computer, on DuckDuckGo.
- **Reading a page.** The app opens the page from this computer, takes its text and gives it to the model. It reads at most 10 MB of a page and gives the model at most 60 000 characters of its text; a longer page is marked as cut. "These protect against huge or hostile pages and apply to web pages only, never to your graph or chat."
- **Safety.** The app does not open addresses on this computer or in your home network, nor your ComfyUI or MCP server, and only the usual web ports. The text of a page is treated as data, never as instructions.
- **In the conversation** it shows as "searched the web for “…”" and "read civitai.com" under **What the assistant looked at**. An explanation from the web gets the badge **Web** and its link (**Source**, **Copy link**).

## How to turn it off

Settings ▸ Assistant ▸ **Behaviour**: **Allow web search**, **Allow reading web pages**. Then **Save settings**.

## What can go wrong

- The search engine may ask for a human check; then the search fails and the assistant says so instead of pretending nothing was found.
- A model with a small context window has little room for a page; see [The context window](Context-Window.md).

## Other internet use

Separate from the assistant: a model card's **Find on the internet**, and Settings ▸ Privacy ▸ **Look up models on the internet during sync**. See [The model card](../interface/Model-Card.md).

## See also

- [What is sent to the model](What-Is-Sent.md)
- [Settings: Assistant](../interface/Settings-Assistant.md)
- [Privacy](../trust/Privacy.md)
