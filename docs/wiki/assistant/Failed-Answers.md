[Русский](Failed-Answers.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Failed answers

When the assistant cannot answer, the conversation shows a block that says in one sentence what happened, with **Ask again** and **Open the assistant settings**. The server's own words are behind **What the server said**. Each answer also has a link to its log: what was sent and what came back. This page lists every message and what to do.

## The messages

| The block says | What to do |
|---|---|
| "No assistant is chosen yet. Pick one in the toolbar or in Settings ▸ Assistant. Nothing was sent." | choose who answers: [Choosing who answers](Choosing-Who-Answers.md) |
| "The cloud assistant has no key. Add the key in the assistant settings." | paste the key: [Keys and where they are kept](Keys.md) |
| "The server did not accept the key. Check the key in the assistant settings." | the key is wrong, revoked or of another provider; paste a new one |
| "Your server asks for a key. Paste it in the assistant settings under “Key for this server”." | your own server wants a key: paste it under **Key for this server (optional)** |
| "The server does not have this model, or it was retired. Choose another model in the assistant settings." | pick a model from the server's list |
| "The server asks to wait. Ask again in a minute." / "The server asks to wait 30 s. Then ask again." | a rate limit or an empty account; wait, or check your account with the provider |
| "Something broke on the model server. Try again a little later." | an error on the provider's or your server's side |
| "The model server does not answer. Check that it is running and the address in the assistant settings." | start the server; check **Server address** |
| "The server answered, but not as a model. Check the address in the assistant settings." | the address points to something else; for a local server it usually ends with `/v1` |
| "The server sent a reply that could not be read. Ask again; if that does not help, open the log of this answer." | ask again; then look at the log |
| "A step could not be saved: the disk is full or the app cannot write its data file. The build stopped; what was built so far stays." | free disk space |
| "The assistant could not answer. Ask again; the log of this answer shows what happened." | ask again; then look at the log |
| "The assistant tried to change the graph, but the chat is in Ask mode. Switch to Build and ask again; nothing was changed." | switch to **Build** |
| "The assistant asked for a tool that is not available here. Nothing was changed. Try asking in other words." | rephrase; a small model may need a bigger one |

## Above an answer

- "The model read only part of the request" and "The model's context window is almost full": see [The context window](Context-Window.md).
- **Answered without tools**: "This model cannot call tools, so the assistant answered from the graph it was sent: it could not look anything up, read more or change the graph. To build or to get drafts, choose a model that can call tools (for example qwen3.5 or gpt-oss)."
- If even that does not work: "This model cannot call tools, and without them the assistant cannot read the graph, look up your nodes or suggest changes, so it did not answer. Choose a model marked “tools”…"
- "Stopped by you: the answer may be unfinished." You stopped it; its build card says Stopped.

## Other things the chat says

- If the window was closed during a build, the build is stopped and the chat says so at the next start: "The assistant's work stopped when the app was closed. What it had added stayed on the canvas (nodes: 4); Undo takes back consecutive assistant steps, stopping at your edits."
- "This build is too old to undo in one step: the version of the graph before it is no longer kept." when you try to undo an old build.

## A step that did not work

Inside a build, a single step can fail without stopping the build: "Could not add the node …" with "This node is not in your ComfyUI. Similar ones: …", or "The graph changed first, so this step was not applied." The assistant can try another way. After 3 failures in a row it pauses: see [Pausing and stopping](Pause-And-Stop.md).

## An odd answer

An answer that is wrong, invented or off the point is not shown as an error. Ask again in other words; ask about one object by right-clicking it; check that the model can call tools and has a large enough context window. To have it looked into, save the log: [The conversation log](Conversation-Log.md).

## See also

- [The conversation log](Conversation-Log.md)
- [The context window](Context-Window.md)
- [Messages](../reference/Messages.md)
- [Troubleshooting](../reference/Troubleshooting.md)
