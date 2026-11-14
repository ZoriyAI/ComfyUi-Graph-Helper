[Русский](Ask.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Ask

In **Ask** mode the assistant answers your questions and, when a change would help, proposes it as a grey draft you can accept or reject. It does not change the graph by itself. "Answers and grey suggestions; only what you accept goes in."

## How to ask

1. Open the **Assistant** tab and choose **Ask** under the conversation.
2. Write in **Ask about the graph** and press `Enter` (`Shift+Enter` for a new line).
3. Or start from the empty conversation: **What can I build with my models?**, **Explain this graph**, **What is next?**.

## How to ask about one thing

The fastest way: right-click it on the canvas and pick a question. The question goes to the assistant with the object attached, and the answer is saved to that object.

| Right-click on | Questions |
|---|---|
| a node | **What is this?**, **Why is it here?**, **What comes next?**, **Explain the ports** |
| an input or output | **What connects here?**, **Where does this go?**, **What type is this?** |
| a link | **What flows here?**, **Why is it connected like this?** |
| a group | **What is this group for?** |

Also: **Assistant ▸ Ask about the selection**; **Explain this** in Properties; the question mark next to a field; **Ask the assistant** in a node or model card; **Ask why** on a finding of the check; **Ask the assistant about this step** in a lesson.

A question asked while the assistant is still answering waits its turn.

## What comes back

- The answer, with lists, tables and links where useful. Facts from the web carry their link.
- **What the assistant looked at**: what it read to answer ("read what KSampler does", "searched your models for “sdxl”").
- Grey drafts, when it suggests a change. See [Grey drafts](Drafts.md).
- The answer saved to the object, with a badge: **Fact**, **Guess** or **Web**.

## Ask and "Build directly"

With Settings ▸ Assistant ▸ **When I ask for a change** set to **Build directly**, a request for a change written in Ask mode is built at once, as in Build mode. Questions stay questions.

## See also

- [Build](Build.md)
- [Grey drafts](Drafts.md)
- [Canvas menus](../interface/Canvas-Menus.md)
- [The explanations tab](../interface/Explain-Panel.md)
