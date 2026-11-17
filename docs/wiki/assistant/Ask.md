[Русский](Ask.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Explain

In **Explain** mode the assistant answers your questions and, when a change would help, proposes it as a grey draft you can accept or reject. It does not change the graph by itself. "Answers and grey suggestions; only what you accept goes in."

## How to ask

1. Open the **Assistant** tab and choose **Explain** under the conversation.
2. Write in **Ask about the graph** and press `Enter` (`Shift+Enter` for a new line).
3. Or start from the empty conversation: **What can I build with my models?**, **Explain this graph**, **What's next?**.

## How to ask about one thing

Open its menu on the canvas (right-click or the touch menu button) and pick a question. The question goes to the assistant with the object attached, and the answer is saved to that object.

| Right-click on | Questions |
|---|---|
| a node | **What is this?**, **Why is it here?**, **What comes next?**, **Explain the inputs and outputs** |
| an input or output | **What connects here?**, **Where does this go?**, **What type is this?** |
| a link | **What flows here?**, **Why is it connected like this?** |
| a group | **What is this group for?** |

Also: **Assistant ▸ Ask about the selection**; **Explain this** in Properties; the question mark next to a field; **Ask the assistant** in a node or model card; **Ask why** on a finding of the check; **Ask the assistant about this step** in a lesson.

A question asked while the assistant is still answering waits its turn.

## What comes back

- The answer, with lists, tables and links where useful. Facts from the web carry their link.
- **What the assistant looked at**: what it read to answer ("read what KSampler does", "searched your models for “sdxl”").
- Grey drafts, when it suggests a change. See [Grey drafts](Drafts.md).
- The answer saved to the object, with the badge **Assistant**: "The assistant (the model) wrote this. It may be wrong: the built-in knowledge and the documentation come first." Nothing is saved as general knowledge from Ask mode.
- If you stop it, the answer says "Stopped by you: the answer may be unfinished."

## Ask and "Build directly"

The default **Assistant** mode carries out requests directly. Choose **Explain** when you want an answer or a draft without changing the graph. Settings ▸ Assistant lets you choose which mode opens by default.

In the message field, `Up` and `Down` bring back your earlier questions. With no assistant chosen, a question about an object opens the Explain tab with the built-in knowledge instead: see [Working without a model](Without-A-Model.md).

## See also

- [Build](Build.md)
- [Grey drafts](Drafts.md)
- [Canvas menus](../interface/Canvas-Menus.md)
- [The explanations tab](../interface/Explain-Panel.md)
