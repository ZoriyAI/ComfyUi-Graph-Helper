[Русский](What-Is-Sent.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# What is sent to the model

Every question you ask goes to the model you chose, together with what the model needs to answer about your graph. For a cloud provider that means it leaves your computer; for your own server it goes only there. The same list stands in Settings ▸ Privacy ▸ **What is sent to the model**.

## Sent with every question

- your message, and the earlier messages of the conversation that fit the context window;
- the graph: nodes, their inputs and outputs, links, positions (a very large graph in pages);
- what is selected and what is on screen;
- your recent actions on the graph;
- a summary of your catalog: which nodes and models you have;
- the app's instructions to the model and the descriptions of its tools;
- the values of the fields (prompts, seeds, model names), unless you turned **Send field values to the model** off in Settings ▸ Privacy. Values that look like keys are always hidden.

## Sent when the assistant looks something up

- When it looks at a model: the description saved next to the model file, and what Civitai or Hugging Face said about it.
- What it read on the web. Pages are opened from this computer.

## Never sent

"Never sent: model keys, the server access token, the model files themselves and the folders they lie in." Your settings file, your other projects and the conversation log are not sent either.

## How to send less

- Turn off **Send field values to the model**.
- Turn off **Allow web search** and **Allow reading web pages** (Settings ▸ Assistant).
- Use your own server: nothing then leaves your computers.
- Choose no assistant: nothing is sent at all, and a question about an object is answered from the built-in knowledge in the Explain tab. See [Working without a model](Without-A-Model.md).
- When the cloud provider's own web search is used, the provider sees the search words.
- Turn off **Keep chat history in the project** if you do not want the conversation stored.

## See also

- [Settings: Privacy](../interface/Settings-Privacy.md)
- [Privacy](../trust/Privacy.md)
- [Keys and where they are kept](Keys.md)
- [The conversation log](Conversation-Log.md)
