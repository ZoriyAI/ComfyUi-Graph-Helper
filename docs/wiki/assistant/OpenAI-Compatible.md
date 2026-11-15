[Русский](OpenAI-Compatible.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# OpenAI-compatible services

**OpenAI-compatible** is any cloud service that speaks the OpenAI chat interface: a gateway in front of several models, or a regional provider, for example where OpenAI, Anthropic and Google are not available. You need the service's own address and its own key, and the service bills you. A server on your own computers is set up as **Your own server** instead: see [vLLM and other compatible servers](vLLM.md).

## How to set it up

1. Settings ▸ Assistant ▸ **OpenAI-compatible** ("Another cloud service at its own address. Needs its key.").
2. **Service address**: its OpenAI-compatible address in full, with https, usually ending in `/v1`. The service names it in its documentation.
3. Paste the service's own key. The key field waits for the address: "Type the service address above first: the key belongs to that address." The key goes only to that address.
4. **Model**: pick it from the service's list, or type its name. Choose a model that can call tools.
5. **Test connection**, then **Save settings**.

**Remember on this computer** keeps the key in the system keychain, as for the other cloud providers. See [Keys and where they are kept](Keys.md).

## Rules

- The address must start with https: "The service address is needed in full, with https, for example https://api.example.com/v1." A cloud key is never sent to an http address.
- A key belongs to its address. For another address, paste its own key.
- The app shows no prices for such a service. See the service's own page.
- If your network needs a proxy, set it under Settings ▸ Assistant ▸ **Network** ▸ **Proxy (optional)**.

## What can go wrong

- "A compatible service needs its https address. Type it under Settings ▸ Assistant."
- "The server did not accept the key. Check the key in the assistant settings."
- "The server does not have this model, or it was retired. Choose another model in the assistant settings."
- "The server answered, but not as a model. Check the address in the assistant settings."

See [Failed answers](Failed-Answers.md).

## See also

- [Choosing who answers](Choosing-Who-Answers.md)
- [Settings: Assistant](../interface/Settings-Assistant.md)
- [What is sent to the model](What-Is-Sent.md)
- [OpenAI](OpenAI.md)
