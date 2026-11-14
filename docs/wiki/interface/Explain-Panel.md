[Русский](Explain-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The explanations tab

The **Explain** tab collects the explanations of one object: a node, an input or output, a link, a subgraph, a group, a model, a data type or the whole graph. Each explanation answers one question (what it is, why it is here, how to connect it, what next, watch out) and carries a badge for where it comes from.

<!-- picture: the Explain tab for KSampler with two explanations and the note form -->

## How to fill it

- Right-click a node, a port or a link and pick a question (**What is this?**, **What flows here?** …). The answer is saved to that object and shows here.
- Or select something and press **Explain the selection**.
- For a question that has no answer yet, the tab shows "Not explained yet" and buttons such as **Explain: What it is**.

With nothing to show: "Nothing to explain yet. Right-click a node, port, or connection and pick a question. Or select an object on the canvas and explain it here."

## What an explanation shows

- The topic, the text and the badge: **Fact**, **Guess**, **Web** or **You**.
- **Source** with **Copy link** for an explanation from the web.
- "Written for revision 12": the version of the graph it was written for. "Written for an earlier version of the graph" when the graph has changed since.
- "General knowledge, not tied to this graph" for what the app knows about a node type ("About the node type KSampler") or a data type ("About the data type LATENT").

## How to add your own note

1. Under **Add your own note**, choose the **Topic**.
2. Write in **Your note**.
3. Press **Save note**: "Your note is saved to this object."

A note cannot hold a key or a password: "An explanation cannot hold a key or a password. Remove it from the text."

## Recent explanations

**Recent explanations** at the bottom lists the latest explanations in this project. "No explanations in this project yet." when there are none.

<!-- verify: the assistant branch makes this tab follow the selection and adds deleting one's own note -->

## See also

- [Description cards](Description-Cards.md)
- [Notes and descriptions](../graph/Notes-And-Descriptions.md)
- [Ask](../assistant/Ask.md)
- [The right panel](Dock.md)
