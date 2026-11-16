[Русский](Settings-Privacy.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Privacy

"What leaves this computer when you talk to the assistant, and what is kept." The switches decide what is sent and stored; the boxes below say it plainly; the last part manages keys. Why the app is built this way: [Privacy](../trust/Privacy.md).

## Switches

| Switch | Default | What it does |
|---|---|---|
| **Send field values to the model** | on | "Prompts, seeds, model names in the nodes. Values that look like keys are always hidden." Off: the model sees the graph without the values. |
| **Keep chat history in the project** | on | "Off: new messages stay in this window only and are not written." |
| **Keep a log of the conversation with the model** | on | Every question is recorded with what was sent and what came back. It stays on this computer, holds no keys or tokens, and old records go by themselves. See [The conversation log](Conversation-Log.md). |
| **Adult content (18+)** | off | See [Adult content](#adult-content) below. |
| **Look up models on the internet during sync** | off | For files Civitai's description does not cover: the fingerprint goes to civitai.com, then the name to huggingface.co. At most one request a second and 200 files per sync. While off, only **Find on the internet** in a card does it. |
| **Check for new versions** | off | Once a day the app asks the project's releases page on github.com whether a newer version exists. The question carries only the app's name and version. The app downloads nothing by itself. |

## Adult content

The switch **Adult content (18+)** is off in a new profile. "On: the previews and example descriptions an author marked as adult content are shown, and the lessons for adults are open. Off: they stay closed, and a model card still shows them for one file when you ask."

Turning it on asks first: "Turn on adult content?", with the rules, **Read the content rules**, **I am 18 or older** and **Leave it off**. See [Content rules](../trust/Content-Rules.md); **Help ▸ Content rules** opens them too.

## What is sent to the model

A box lists it: your message, the graph (nodes, inputs and outputs, links, positions), what is selected and on screen, your recent actions on the graph, a summary of your catalog; when the assistant looks at a model, the description saved next to it and what Civitai or Hugging Face said about it. Then a line that says where a question goes now: to your own server, to the cloud provider you chose, or, for a model of Ollama's cloud on your own server, "Now the model “gemma4:cloud” runs in Ollama's cloud: your question and the graph leave this computer through Ollama, although the address is your own server." Then "Field values: sent." or "Field values: not sent." and "Never sent: model keys, the server access token, the model files themselves and the folders they lie in." See [What is sent to the model](../assistant/What-Is-Sent.md).

A second box says where else the app connects, and when: the assistant's web search (DuckDuckGo from this computer, or the cloud provider's own search), the sign-in page of your MCP server (the app asks first when it is on another site), a check of a few known ports on this computer, and **Find on the internet** in a model card (civitai.com, huggingface.co and their picture servers).

## Where keys are kept

A table, **Key** and **Where it is now**, with a row per key: "OpenAI key", "Server access token". The place is "In memory until the app closes", "Encrypted in the system keychain", "In the app folder, unencrypted (your choice)" or "Not held".

- **Forget all keys and tokens** removes every model key, every server access token and every browser sign-in, from memory, the system keychain and the app folder. The app asks first and lists what goes.
- **System keychain**, **Which keychain the app uses**: **Detect automatically**, GNOME “Passwords and Keys”, KWallet 6, 5 or 4. "Now: GNOME “Passwords and Keys”. Keys are saved encrypted." A change applies after the app restarts.

## The picture cache

The app keeps preview pictures and clips of your models so that cards open at once. The line says how many files and how much room they take; **Clear the picture cache** removes them. They are also cleared when the server address changes.

## Chat history

**Clear chat history** removes the stored messages of this project after a question ("Messages of this project to remove: 24. Explanations saved on nodes stay."). "There is no chat history to clear." when there is none.

## See also

- [Privacy](../trust/Privacy.md)
- [Keys and where they are kept](../assistant/Keys.md)
- [What is sent to the model](../assistant/What-Is-Sent.md)
- [Settings](Settings.md)

## Recovery copies

New migration copies omit stored credentials and preserve graph/history recovery data. Forgetting credentials also clears the known older copies. Clearing chat waits for accepted writes and removes this project’s messages from the current database and known copies; graph descriptions and other projects stay. If a damaged or unreadable copy cannot be verified, the app reports incomplete cleanup and retains it for recovery. Open the data folder through Help → About to inspect that copy; do not discard recoverable graphs blindly.
