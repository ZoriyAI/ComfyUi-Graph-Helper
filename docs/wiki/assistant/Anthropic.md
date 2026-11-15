[Русский](Anthropic.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Anthropic

Anthropic is a cloud provider of language models. The assistant sends your question and the graph to Anthropic over a secure connection and gets the answer back. You need a key from Anthropic, and Anthropic bills you for what you use; the price depends on the model and on how long the questions and answers are. Settings ▸ Assistant shows what the two suggested models cost, with the date of the prices; the provider's bill is the truth. See [Which model to take](Which-Model.md).

## How to set it up

1. Create a key in your account on Anthropic's site (console.anthropic.com). Copy it.
2. In the app: Settings ▸ Assistant ▸ **Anthropic**.
3. Paste the key into **Anthropic key**. The app checks it at once: "Checking the key with the provider…", then "Key accepted: 24 models are available. It is kept while the app is open."
4. To keep it after a restart, tick **Remember on this computer** (the system keychain). See [Keys and where they are kept](Keys.md).
5. **Model**: pick from the list the key opened. **Which model to take** under the field suggests two: **To start** `claude-haiku-5-5` ($0.10 per million tokens sent, $0.50 per million received) and **For long builds** `claude-sonnet-5-5` ($2 and $10). Prices as of 14 November 2026. Choose a model that can call tools.
6. **Test connection**: "The model answered in 900 ms."
7. **Save settings**.

The card **Anthropic** then shows **Ready** (or **Key for this session** when the key is not remembered).

## Server address

Leave **Server address (optional)** empty: the app uses Anthropic's official address. Fill it only for your own proxy, and only with `https`. A key works only with the address it was pasted for: "This key was pasted for … and is never sent to another address. For the address above, paste its own key."

## Web search

Its own web search, on the official address. It is billed separately: about $10 per 1000 searches. You can turn it off: Settings ▸ Assistant ▸ **Allow web search**. See [Web search and pages](Web-Search.md).

## Where to get a key

**Get a key** and **What the provider does with your data** under **Which model to take** show the addresses of Anthropic's pages, with **Copy the address**. The app opens no browser itself.

## What can go wrong

- "Anthropic is chosen, but there is no key. The assistant will not answer until you add a key in Settings."
- "The provider did not accept this key. Check it and paste it again."
- "The server did not accept the key. Check the key in the assistant settings."
- "The server asks to wait. Ask again in a minute." Your account has hit a limit, or has no money left.
- "No model is chosen for the cloud assistant. Choose one in Settings ▸ Assistant."
- "A cloud key is never sent to an http address. Use an address that starts with https."

## See also

- [Keys and where they are kept](Keys.md)
- [What is sent to the model](What-Is-Sent.md)
- [Which model to take](Which-Model.md)
- [Choosing who answers](Choosing-Who-Answers.md)
- [Failed answers](Failed-Answers.md)
