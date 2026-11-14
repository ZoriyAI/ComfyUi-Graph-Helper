[Русский](Google.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Google Gemini

Google Gemini is a cloud provider of language models. The assistant sends your question and the graph to Google Gemini over a secure connection and gets the answer back. You need a key from Google Gemini, and Google Gemini bills you for what you use; the price depends on the model and on how long the questions and answers are. The app shows no prices: see your account on Google Gemini's site.

## How to set it up

1. Create a key in your account on Google Gemini's site (aistudio.google.com). Copy it.
2. In the app: Settings ▸ Assistant ▸ **Google Gemini**.
3. Paste the key into **Google Gemini key**. The app checks it at once: "Checking the key with the provider…", then "Key accepted: 24 models are available. It is kept while the app is open."
4. To keep it after a restart, tick **Remember on this computer** (the system password store). See [Keys and where they are kept](Keys.md).
5. **Model**: pick from the list the key opened, or one of the suggestions: `gemini-2.5-pro`, `gemini-2.5-flash`. Choose a model that can call tools.
6. **Check connection**: "The model answered in 900 ms."
7. **Save settings**.

The card **Google Gemini** then shows **Ready** (or **Key for this session** when the key is not remembered).

## Server address

Leave **Server address (optional)** empty: the app uses Google Gemini's official address. Fill it only for your own proxy, and only with `https`. A key works only with the address it was pasted for: "This key was pasted for … and is never sent to another address. For the address above, paste its own key."

## Web search

Its own search for Gemini 3 models on the official address; for earlier models the app searches the web itself. You can turn it off: Settings ▸ Assistant ▸ **Allow web search**. See [Web search and pages](Web-Search.md).

## What can go wrong

- "Google Gemini is chosen, but there is no key. The assistant will not answer until you add a key in Settings."
- "The provider did not accept this key. Check it and paste it again."
- "The server did not accept the key. Check the key in the assistant settings."
- "The server asks to wait. Ask again in a minute." Your account has hit a limit, or has no money left.
- "No model is chosen for the cloud assistant. Choose one in Settings ▸ Assistant."
- "A cloud key is never sent to an http address. Use an address that starts with https."

## See also

- [Keys and where they are kept](Keys.md)
- [What is sent to the model](What-Is-Sent.md)
- [Choosing who answers](Choosing-Who-Answers.md)
- [Failed answers](Failed-Answers.md)
