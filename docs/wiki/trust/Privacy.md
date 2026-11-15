[Русский](Privacy.ru.md)
[Home](../Home.md) › [Trust](README.md)

# Privacy

This page lists every place CozyGraph can contact, when it does so, on whose action, and what goes there. Nothing
else leaves your computer.

## What the app never does

- **No telemetry.** It does not count, measure or report how you use it.
- **No crash reporting.** Errors go to a log file on your computer only.
- **No update check.** It never asks anyone whether a new version exists.
- **No account.** It needs no sign-up with the project.
- **No spell checker downloads.** The spell checker of the window is switched off, so Chromium does not fetch
  dictionaries.
- **No fonts or scripts from the internet.** Everything the window shows is inside the app.

## Every place the app can contact

### Your ComfyUI and its MCP server

<!-- verify: connection chapter. The connection is being rebuilt; this section is checked against the connection
notes. -->

- **When:** when you read ComfyUI (Read ComfyUI, Sync ▸ Sync now), on the sync timer if you switched it on in
  Settings ▸ Sync, when you check the connection in Settings ▸ Connection, and when a model card opens a picture that lies next
  to a model file.
- **Where:** only the addresses you gave in Settings ▸ Connection, and the ComfyUI address the MCP server names when
  it is on this computer or you saved it.
- **What goes there:** read-only requests: the list of nodes (`/object_info`, `/system_stats`), the model folders, the
  files next to a model (its description, its example picture), the fingerprint of a model file. The access token or
  the sign-in, if the server needs one. Never a write, an install, a download or a queued run.
- **Sign-in through the browser:** your system browser opens the server's sign-in page; the app waits for the answer
  on a local address of this computer (`127.0.0.1`).

### The model that answers (the assistant)

- **When:** only when you send a message to the assistant, use Ask about…, or choose Check connection in Settings ▸
  Assistant.
- **Where:** the one model you chose:
  - a cloud provider: OpenAI (`api.openai.com`), Anthropic (`api.anthropic.com`), Google (`generativelanguage.googleapis.com`),
    or the address you set for that provider;
  - your own server (Ollama, LM Studio, vLLM or another OpenAI-compatible server) at the address you gave.
- **What goes there:** your message; the graph (nodes, their inputs and outputs, links, positions); what is selected
  and on screen; your recent actions on the graph; a summary of your catalog; when the assistant looks at a model, the
  description saved next to it and what Civitai or Hugging Face said about it. Field values (descriptions, seeds,
  model names in the nodes) go only while Settings ▸ Privacy ▸ Send field values to the model is on (it is on by
  default); values that look like keys are always hidden.
- **Never:** model keys (except the provider's own key in its own request header), the server access token, the
  model files and the folders they lie in.
- **A key goes only to the address it was pasted for.** If you change the address, the key is not sent there until
  you paste it again.
- **A server on your computer**: while a request runs, the app also asks an Ollama server which context window it
  loaded the model with (`/api/ps`), so a request that does not fit can be noticed.

### Web search and web pages (the assistant)

- **When:** while the assistant answers, if your catalog cannot answer and the assistant decides to search or to read
  a page. Settings ▸ Assistant ▸ Allow web search and Allow reading web pages: both are **on** by default; switch them
  off to keep the assistant away from the internet.
- **Where:** with a cloud model that has its own search (OpenAI, Anthropic, Google), the provider searches on its
  side. Otherwise the app asks DuckDuckGo (`html.duckduckgo.com`, `lite.duckduckgo.com`) from this computer. Pages are
  opened from this computer, only public `http`/`https` addresses on the usual ports, and only addresses named in the
  conversation. Your ComfyUI, your MCP server and addresses inside your network are never opened this way.
- **What goes there:** the search words the assistant chose; a normal request for the page. DuckDuckGo and the site
  see your IP address, as with any browser.

### Model descriptions from Civitai and Hugging Face

- **When:** when you choose **Find on the internet** in a model card. During sync only if you switched on Settings ▸
  Privacy ▸ Look up models on the internet during sync (off by default).
- **Where:** `civitai.com` and `huggingface.co`, and their picture hosts (`image.civitai.com` and the Hugging Face file
  hosts) for an example picture.
- **What goes there:** for Civitai, the fingerprint (SHA-256) of the model file; for Hugging Face, the name of the
  file. Nothing else. A picture marked as adult content is not downloaded unless you choose to see it.

### Finding servers on this computer

- **When:** when you choose **Find local servers** in Settings ▸ Assistant.
- **Where:** this computer only (`127.0.0.1` on the usual ports of Ollama, LM Studio and vLLM: 11434, 1234, 8000),
  and your MCP server, if it lists model servers.

### Your browser

The app opens your system browser, never a window of its own, for: signing in to an MCP server, Help ▸ Project
website, Help ▸ New versions and Help ▸ Report a problem. Report a problem first shows you what the new issue will
contain (the versions of the app and the system, nothing else).

## What stays on your computer

- The database with settings, the catalog, the history of the graph and the chats (Settings ▸ Privacy ▸ Keep chat
  history in the project can switch the chats off).
- The log and the conversation log (Settings ▸ Privacy ▸ Keep a log of the conversation with the model). Neither
  holds keys or tokens.
- Saved keys: in the system password store, or, only if you choose it where there is no password store, in a file in
  the app folder readable by your user only.

Where each file lies: [The data folder](../reference/Data-Folder.md). How to remove everything:
[Removing](../start/Removing.md).

## See also

- [Trust](README.md)
- [Security](Security.md)
- [ComfyUI is only read](Read-Only.md)
- [What is sent to the model](../assistant/What-Is-Sent.md)
- [Settings: Privacy](../interface/Settings-Privacy.md)
