[Русский](Settings-Privacy.ru.md)
[Home](../Home.md) › [The window](README.md)

# Settings: Privacy

"What leaves this computer when you talk to the assistant, and what is kept." The switches decide what is sent and stored; the boxes below say it plainly; the last part manages keys. Why the app is built this way: [Privacy](../trust/Privacy.md).

## Switches

| Switch | Default | What it does |
|---|---|---|
| **Send field values to the model** | on | "Descriptions, seeds, model names in the nodes. Values that look like keys are always hidden." Off: the model sees the graph without the values. |
| **Keep chat history in the project** | on | "Off: new messages stay in this window only and are not written." |
| **Keep a log of the conversation with the model** | on | Every question is recorded with what was sent and what came back. It stays on this computer, holds no keys or tokens, and old records go by themselves. See [The conversation log](Conversation-Log.md). |
| **Show previews and examples marked as adult content** | off | Pictures and example prompts next to your models that their author marked as adult. While off, a model card shows them only when you ask for that file. |
| **Look up models on the internet during sync** | off | For files Civitai's description does not cover: the fingerprint goes to civitai.com, then the name to huggingface.co. At most one request a second and 200 files per sync. While off, only **Find on the internet** in a card does it. |

## What is sent to the model

A box lists it: your message, the graph (nodes, inputs and outputs, links, positions), what is selected and on screen, your recent actions on the graph, a summary of your catalog; when the assistant looks at a model, its description. Then "Field values: sent." or "Field values: not sent." and "Never sent: model keys, the server access token, the model files themselves and the folders they lie in." See [What is sent to the model](../assistant/What-Is-Sent.md).

## Where keys are kept

A table, **Key** and **Where it is now**, with a row per key: "OpenAI key", "Server access token". The place is "In memory until the app closes", "Encrypted in the OS password manager", "In the app folder, unencrypted (your choice)" or "Not held".

- **Forget all keys and tokens** removes every model key, every server access token and every browser sign-in, from memory, the password store and the app folder. The app asks first and lists what goes.
- **Password store**, **Which store the app uses**: **Detect automatically**, GNOME “Passwords and Keys”, KWallet 6, 5 or 4. "Now: GNOME “Passwords and Keys”. Keys are saved encrypted." A change applies after the app restarts.

## Chat history

**Clear chat history** removes the stored messages of this project after a question ("Messages of this project to remove: 24. Explanations saved on nodes stay."). "There is no chat history to clear." when there is none.

## See also

- [Privacy](../trust/Privacy.md)
- [Keys and where they are kept](../assistant/Keys.md)
- [What is sent to the model](../assistant/What-Is-Sent.md)
- [Settings](Settings.md)
