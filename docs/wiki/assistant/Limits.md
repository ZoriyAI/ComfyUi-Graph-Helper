[Русский](Limits.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# Limits of the assistant

The assistant is a language model with a few tools. It is good at explaining and at building common graphs from your nodes. It is not a person who has seen your pictures, and it can be wrong. This page lists what it cannot do today.

## What it cannot do

- **Run the graph or see the result.** It never runs anything in ComfyUI and never sees the picture or video your graph makes. Tell it in words what came out.
- **Install or download.** It cannot add a node pack or a model; it can only tell you which one you need.
- **Use what you do not have.** It may only add node classes your ComfyUI has; others are refused.
- **Answer two questions at once.** One answer at a time; a question asked meanwhile waits.
- **Remember other projects.** The conversation belongs to this project; a cleared or switched-off history is gone. There is no button to start a new conversation; **Clear chat history** in Settings ▸ Privacy removes the old one.
- **Act in Explain mode.** This mode offers no graph-changing tools. Normal Assistant and Build apply requested edits to existing as well as new work, with undo history.
- **Open a link.** A link in an answer only copies its address.

## Where it can be wrong

- **Its words are not facts.** What the assistant wrote carries the badge **Assistant**: "It may be wrong: the built-in knowledge and the documentation come first." Facts read from ComfyUI or a file carry **Fact**. When it matters, check.
- **Small models.** A small model on your own server may misread a long graph, pick wrong nodes, or stop making sense in a long build. A larger model or a cloud model helps.
- **A small context window** makes it forget the question. See [The context window](Context-Window.md).
- **The web.** Pages may be out of date. Answers from the web carry their link.

## What helps

Ask about one object (right-click it), say what you want in plain words, check the graph after a build, and use the **Tour** to read what was built.

## See also

- [The assistant](Assistant.md)
- [Failed answers](Failed-Answers.md)
- [Known limits](../reference/Known-Limits.md)
- [Content rules](../trust/Content-Rules.md)
