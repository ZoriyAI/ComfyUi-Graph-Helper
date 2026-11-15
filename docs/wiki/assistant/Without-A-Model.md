[Русский](Without-A-Model.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Working without a model

You can use the app with no assistant chosen (**Not chosen**, "The assistant is off."): nothing is then sent to any model. Much of the app works the same, because its knowledge of nodes and model families is built in and its checks are its own.

## What works without a model

- Reading your ComfyUI, the library, the node and model cards with what the app knows about each node and file.
- Building by hand on the canvas: adding, connecting, fields, subgraphs, groups, arranging, undo and the history.
- The description cards, with the app's own knowledge of each kind of node ("Fact" and "Guess" badges).
- A question about an object: see below.
- The tour of a graph.
- The check, and its advice on prompts.
- **Learn**: all lessons, with **Show me where** and **Do this for me**.
- Opening and saving workflows and projects.

## What needs a model

- **Ask** and **Build**, the questions in the canvas menus, **Explain this**, **Ask why**, **Ask the assistant about this step**.
- A question typed in the chat gets "No assistant is chosen yet. Pick one in the toolbar or in Settings ▸ Assistant. Nothing was sent."

## A question about an object without a model

With no assistant chosen, a question about an object (from a canvas menu, **Explain this** in Properties, a node or model card) is not sent anywhere and no chat message appears. Instead the **Explain** tab opens on that object with what the app knows about it: the built-in knowledge of its node type or data type, the documentation, and your own notes. See [The explanations tab](../interface/Explain-Panel.md).

## See also

- [Learn](Learn.md)
- [Choosing who answers](Choosing-Who-Answers.md)
- [The tour of a graph](../graph/Tour.md)
- [Checking a graph](../graph/Checking-A-Graph.md)
