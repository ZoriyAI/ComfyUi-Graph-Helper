[Русский](Privacy.ru.md)
[Home](../Home.md) › [Trust](README.md)

# Privacy

This page lists every place NodeWise Studio can contact, when it does so, on whose action, and what goes there. Nothing
else leaves your computer.

## What the app never does

- **No telemetry.** It does not count, measure or report how you use it.
- **No crash reporting.** Errors go to a log file on your computer only.
- **No update check unless you ask for it.** Settings ▸ Privacy ▸ Check for new versions is off by default (see
  below).
- **No account.** It needs no sign-up with the project.
- **No spell checker downloads.** The spell checker of the window is switched off, so Chromium does not fetch
  dictionaries.
- **No fonts or scripts from the internet.** Everything the window shows is inside the app.

## Every place the app can contact

### Your ComfyUI

- **When:** when you check or read ComfyUI (Check ComfyUI, Read now, Sync ▸ Sync now), on the sync timer if you
  switched it on in Settings ▸ Sync, and when a model card shows a picture ComfyUI has for a model.
- **Where:** only the ComfyUI address you saved in Settings ▸ Connection. Find on this computer asks only this
  computer (`127.0.0.1`, ports 8188 and 8000).
- **What goes there:** read-only `GET` requests, through one gate that refuses every other route: the list of
  nodes (`/object_info`), the versions (`/system_stats`), the model folders and files, the metadata inside a
  `.safetensors` header (`/view_metadata`), a model's preview picture, and, when ComfyUI-Manager is installed, its
  list of installed packs. Never a prompt, a queue, an upload, an install or a setting. No password is sent: ComfyUI
  has none.

### Your MCP server (optional)

- **When:** as for ComfyUI, if you set an MCP server address in Settings ▸ Connection; and when you choose Find on
  the internet in a model card (the server computes the file's fingerprint).
- **Where:** only the MCP server address you gave, and a ComfyUI address it names if that is on this computer too,
  or is the address you saved.
- **What goes there:** calls of the few read tools the app knows, with fixed arguments: the node, pack and model
  lists, the files next to a model (description, example picture), a pack's `pyproject.toml` and README, a model
  file's fingerprint. The access token or the sign-in, if the server needs one. A server whose tools the app does not
  know is not called at all.
- **Sign-in through the browser:** your system browser opens the server's sign-in page; the app waits for the answer
  on a local address of this computer (`127.0.0.1`).

### The model that answers (the assistant)

- **When:** only when you send a message to the assistant, use Ask about…, or choose Check connection in Settings ▸
  Assistant.
- **Where:** the one model you chose:
  - a cloud provider: OpenAI (`api.openai.com`), Anthropic (`api.anthropic.com`), Google (`generativelanguage.googleapis.com`),
    or the address you set for that provider;
  - your own server (Ollama, LM Studio, vLLM or another OpenAI-compatible server) at the address you gave;
  - Ollama's cloud, when the model on your own server is one of Ollama's cloud models (its name ends in `:cloud` or
    `-cloud`, for example `gemma4:cloud`): the request goes to your Ollama, and Ollama sends it on to its servers.
    The app then never calls the model local: Settings ▸ Assistant, the assistant chip, Settings ▸ Privacy and the
    conversation log say that your question and the graph leave this computer through Ollama.
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

### Model controls and selected-file repair

An open assistant model monitor reads the selected server's status every 10 seconds. Context/style application, loading and unloading run only on the person's click through Ollama's native API. Creating a configuration reuses existing weights; loading uses server memory. Unloading keeps the file but can affect other apps on that server. System services are not changed.

For sync repair, the file is selected on the interface device. Only its prefix and header, up to 64 MiB, are read. Only name, size and bounded metadata go to the main computer; weights are not transferred. Names and descriptions may contain personal data.

### Web search and web pages (the assistant)

- **When:** while the assistant answers, if your catalog cannot answer and the assistant decides to search or to read
  a page. Settings ▸ Assistant ▸ Allow web search and Allow reading web pages: both are **on** by default; switch them
  off to keep the assistant away from the internet.
- **Where:** with a cloud model that has its own search (OpenAI, Anthropic, Google), the provider searches on its
  side. Otherwise the app asks DuckDuckGo (`html.duckduckgo.com`, `lite.duckduckgo.com`) from this computer. Pages are
  opened from this computer, only public `http`/`https` addresses on the usual ports, and only addresses named in the
  conversation. Your ComfyUI, your MCP server and addresses inside your network are never opened this way.
- **What goes there:** the search words the assistant chose; a normal request for the page. DuckDuckGo and the site
  see your IP address, as with any browser. With the provider's own search, the provider sees the search words; the
  sources it cites are not added to the pages the assistant may open, so an address that carries your words in it is
  never fetched by the app.

### Model descriptions from Civitai and Hugging Face

- **When:** when you choose **Find on the internet** in a model card. During sync only if you switched on Settings ▸
  Privacy ▸ Look up models on the internet during sync (off by default).
- **Where:** `civitai.com` and `huggingface.co`, and their picture hosts (`image.civitai.com` and the Hugging Face file
  hosts) for an example picture.
- **What goes there:** for Civitai, the fingerprint (SHA-256) of the model file; for Hugging Face, the name of the
  file. Nothing else. A picture marked as adult content is not downloaded unless you choose to see it.

### New versions (only if you switch it on)

- **When:** only while Settings ▸ Privacy ▸ Check for new versions is on (off by default); at most once a day, and
  an hour later after a failed try.
- **Where:** GitHub (`api.github.com`), the project's latest release.
- **What goes there:** a request that names the app and its version; GitHub sees your computer's address, as any
  site does. The answer is kept in `update-check.json` in the data folder. The app downloads nothing: a line in the
  status bar offers the release page and the download, and you choose.

### Finding servers on this computer

- **When:** when you choose **Find local servers** in Settings ▸ Assistant.
- **Where:** this computer only (`127.0.0.1` on the usual ports of Ollama, LM Studio, vLLM and the llama.cpp
  server: 11434, 1234, 8000, 8080), and your MCP server, if it lists model servers. Find on this computer in
  Settings ▸ Connection asks ports 8188 and 8000 the same way. Nothing leaves this computer.

### A proxy (only if you need one)

- Requests to cloud models and the web search follow your system's proxy settings. Settings ▸ Assistant ▸ Network ▸
  Proxy (optional) takes a proxy the system does not know: `http://`, `https://`, `socks4://` or `socks5://`, a host
  and a port, never a user name or password.
- Your own server on this computer or your home network, your ComfyUI and your MCP server on this computer are
  always reached directly, not through the proxy.

### Your browser

The app opens your system browser, never a window of its own, for: signing in to an MCP server, Help ▸ Project
website, Help ▸ New versions, Help ▸ Report a problem…, and Open ComfyUI on the card "Run it in ComfyUI" (your own
ComfyUI address). Report a problem… first shows you what the new issue will contain (the versions of the app and the
system, nothing else).

Signing in to an MCP server opens the sign-in page that server names. When that page is on another site than the
server, the app asks first and shows both names.

Two download pages are opened there only when you click their buttons in the **No ComfyUI yet** window:
**Open the ComfyUI download page** (`https://www.comfy.org/download`) and **Open the Ollama download page**
(`https://ollama.com/download`). The app itself sends nothing to either site.

## What stays on your computer

- The database with settings, the catalog, the history of the graph and the chats (Settings ▸ Privacy ▸ Keep chat
  history in the project can switch the chats off).
- The log and the conversation log (Settings ▸ Privacy ▸ Keep a log of the conversation with the model). Neither
  holds keys or tokens.
- Saved keys: in the system keychain, or, only if you choose it where there is no keychain, in a file in the app
  folder readable by your user only.
- Your own lessons: one file per lesson in the `lessons` folder.
- Pending assistant lessons and extension sources: in the profile database, separately from accepted lessons.
  Keeping chat history also keeps the newest 20 lesson drafts and 12 extension drafts per project across restarts.
  With history storage off, new drafts remain temporary. Clearing a project's chat removes its pending drafts
  from the database and the app's recovery copies. Accepted lessons and separately downloaded ZIP files remain.
- `recent-files.json`: the last 10 files you opened or saved, and the file each graph came from. Paths only, never
  the contents.
- `graph-start.json`: a mark for the safe start ("drawing", "drawn"), so a graph that hung the window is not drawn
  again without asking.
- The picture cache of model cards (`model-previews`). Settings ▸ Privacy shows its size and has Clear the picture
  cache; it is also emptied when the server address changes.

Copy diagnostics and a saved conversation log keep no address of your own servers: only the scheme, where the
server is (`[this computer]`, `[local network]`, `[internet]`) and the port. Public services (the providers' APIs,
Civitai, Hugging Face, DuckDuckGo) stay named.

Where each file lies: [The data folder](../reference/Data-Folder.md). How to remove everything:
[Removing](../start/Removing.md).

## See also

- [Trust](README.md)
- [Security](Security.md)
- [Catalog reads and selected-file uploads](Read-Only.md)
- [What is sent to the model](../assistant/What-Is-Sent.md)
- [Settings: Privacy](../interface/Settings-Privacy.md)
