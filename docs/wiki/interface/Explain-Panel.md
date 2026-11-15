[Русский](Explain-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The explanations tab

The **Explain** tab collects the explanations of one object: a node, an input or output, a link, a subgraph, a group, a model, a data type or the whole graph. Each explanation answers one question (what it is, why it is here, how to connect it, what next, watch out) and carries a badge for where it comes from.

<!-- picture: the Explain tab for KSampler with two explanations and the note form -->

## How to fill it

- The tab follows the selection: select a node, a link or an input, and the tab shows that object. Picking another object changes the tab.
- Right-click a node, a port or a link and pick a question (**What is this?**, **What flows here?** …). The answer is saved to that object and shows here.
- Or select something and press **Explain the selection**.
- While no assistant is chosen, a question about an object opens this tab with the built-in knowledge, and nothing is sent. See [Working without a model](../assistant/Without-A-Model.md).
- For a question that has no answer yet, the tab shows "Not explained yet" and buttons such as **Explain: What it is**.

With nothing to show: "Nothing to explain yet. Right-click a node, an input or output, or a link and pick a question. Or select an object on the canvas and explain it here."

If the object was removed from the canvas, the tab says "This object is no longer on the canvas. What is written below was written about it before."

## What an explanation shows

- The topics as headings, the text and the badge: **Fact**, **Guess**, **Web**, **Written by you**, **From the file**, or **Assistant** for what the assistant wrote ("The assistant (the model) wrote this. It may be wrong: the built-in knowledge and the documentation come first.").
- The order follows trust: the built-in knowledge and the documentation first, then your notes, then the assistant's words.
- Beside each topic, once, where its text applies: "Written for this graph", "Kept in this project only", or "General knowledge, not tied to this graph" for what the app knows about a node type ("About the node type KSampler") or a data type ("About the data type LATENT").
- "Written for an earlier version of the graph" when the graph has changed since.
- **Source** with **Copy link** for an explanation from the web. A long address breaks after a slash.

## Removing text

- Your own note has **Delete note**.
- **Remove what the assistant wrote here** removes everything the assistant wrote about this object, in one action.

## How to add your own note

1. Under **Add your own note**, choose the **Topic**.
2. Write in **Your note**.
3. Press **Save note**: "Your note is saved to this object."

A note cannot hold a key or a password: "An explanation cannot hold a key or a password. Remove it from the text."

## Recent explanations

**Recent explanations** at the bottom lists the latest explanations in this project. "No explanations in this project yet." when there are none.

## See also

- [Description cards](Description-Cards.md)
- [Notes and descriptions](../graph/Notes-And-Descriptions.md)
- [Ask](../assistant/Ask.md)
- [The right panel](Dock.md)
