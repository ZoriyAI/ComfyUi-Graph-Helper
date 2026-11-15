[Русский](Assistant.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# The assistant

The assistant is a language model, in the cloud or on your own computer, that the app lets look at your graph and your ComfyUI so it can explain and build with you. You choose which model it is. It works in three modes: **Ask**, **Build** and **Learn**. Where you talk to it: [The assistant tab](../interface/Assistant-Panel.md).

## What it does

- **Explains.** What a node is, why it is here, what flows along a link, what a field does, what to do next. The answer is saved to the object you asked about, so it shows later in its description card and in the **Explain** tab.
- **Suggests.** In Ask mode it proposes changes as [grey drafts](Drafts.md) on the canvas; only what you accept goes into the graph.
- **Builds.** In Build mode it changes the graph step by step on the canvas, and writes next to each node why it is there. It changes only what it placed itself in this build; a change to your own nodes, values, notes or links comes as a grey draft for you to decide.
- **Reads your ComfyUI.** Before it names a node or a model, it looks in your catalog: which node classes you have, their inputs and outputs, which model files and of which family.
- **Looks things up**, when your catalog cannot answer and you allow it: a web search and reading a page. See [Web search and pages](Web-Search.md).

## What it never does

- It never runs a graph, never installs a node or a pack, never downloads a model, never changes anything in ComfyUI. Nor can it: the app gives it no such tool.
- It never sees your keys or tokens.
- It never changes the graph in Ask mode; only a draft you accept goes in. If it tries, the app refuses: "The assistant tried to change the graph, but the chat is in Ask mode. Switch to Build and ask again; nothing was changed."
- It never edits the inside of a subgraph: it builds on the main canvas.
- In Ask mode it never saves anything as general knowledge, and its words are never marked as a fact: what it wrote carries the badge **Assistant**.
- It never opens a web page or a link from the chat: a link in an answer copies its address when you click it.

## The three modes

| Mode | Who builds | Needs a model | Page |
|---|---|---|---|
| **Ask** | you; the assistant answers and suggests | yes | [Ask](Ask.md) |
| **Build** | the assistant, step by step, while you watch | yes | [Build](Build.md) |
| **Learn** | you, led by a lesson | no | [Learn](Learn.md) |

## Before the first question

Choose who answers: the toolbar chooser, **Assistant ▸ Choose the assistant**, or Settings ▸ Assistant. See [Choosing who answers](Choosing-Who-Answers.md) and [Which model to take](Which-Model.md). Without a model, a question about an object is still answered from the built-in knowledge: [Working without a model](Without-A-Model.md).

## See also

- [Choosing who answers](Choosing-Who-Answers.md)
- [What is sent to the model](What-Is-Sent.md)
- [Limits of the assistant](Limits.md)
- [Read-only](../trust/Read-Only.md)
