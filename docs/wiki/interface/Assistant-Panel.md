[Русский](Assistant-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The assistant tab

The **Assistant** tab is where you talk to the assistant. It shows the conversation, the switch between **Explain**, **Build** and **Learn**, and the message field. What the assistant does in each mode is on [The assistant](../assistant/Assistant.md).

<!-- picture: the assistant tab during a build: step list, summary and the composer -->

## The parts

- **The header**: while the assistant answers, "Answering" with **Pause**. While paused: "Paused" with **Resume**.
- **The conversation**: your messages are bubbles; the assistant's answers are flat blocks. A time sits under each answer and at the end of your bubble. Answers can hold lists, tables, code and links. A link shows its words; a click copies the address ("Click to copy the address: …"). The app opens no web page from the chat. Under an answer:
  - **What the assistant looked at**: a quiet line of what it read ("read the graph", "searched the node catalog for “sampler”", "searched the web for “…”"), folded by default.
  - **Build · 8 steps**: the steps of a build, each with **Show on the canvas: …**, and **Why each step** to read the reasons.
  - **Build result**: "Done: 7 nodes, 9 links, 5 fields set." and **What next:** **Tour the graph**, **Check the graph**, **Save workflow…**.
  - Grey-draft cards with **Accept** and **Reject**. See [Grey drafts](../assistant/Drafts.md).
  - A link to the log of the answer: "The log of this answer: what was sent to the model and what it answered".
- **The mode switch**: **Explain**, **Build**, **Learn**, with one line under it on what the mode does:
  - Explain: "Answers and grey suggestions; only what you accept goes in."
  - Build: "Builds on the canvas step by step and explains each step. Requested changes can edit existing nodes and subgraphs, with undo history."
  - Learn: "You build; the app leads you step by step and checks."
- **The message field**: "Ask about the graph" in Ask, "Ask for a graph change" in Build. It grows with its text. `Enter` sends, `Shift+Enter` adds a line. In an empty field, `Up` and `Down` bring back your earlier questions. The round button on the right is **Send**; while the assistant answers, **Stop** takes its place ("Stops the run. Changes already applied stay in the graph.").

## Long conversations

The chat opens at its newest message and loads in pages of 200 messages. Scroll up and the older ones come in at the top; nothing is deleted. The model is named by its display name, not by its internal id.

When a small or unknown context window is set for a local model, the assistant sends a shorter plan of the graph from the first question. See [The context window](../assistant/Context-Window.md).

## An empty conversation

"No messages yet" with a hint, and **Start with a question**: **What can I build with my models?**, **Explain this graph**, **What's next?**.

## When a build pauses

After the number of steps set in **Steps per answer**, an amber **Pause point** card says "The assistant used 60 steps and paused", with **Continue** (the main button) and **Stop**. A run ended from the status bar or the menu marks the card "Stopped. Changes already applied stay." and offers Continue no more. After several failed attempts in a row: "The assistant paused after 3 failed attempts in a row". See [Pausing and stopping](../assistant/Pause-And-Stop.md).

## When an answer fails

A block says what happened in one sentence, for example "The model server does not answer. Check that it is running and the address in the assistant settings.", with **Ask again** and **Open the assistant settings**. The server's own words are behind **What the server said**. See [Failed answers](../assistant/Failed-Answers.md).

An answer you stopped says "Stopped by you: the answer may be unfinished."; its build card says Stopped.

## Opening another graph during a build

**New project**, **Open project** or **Open workflow…** while the assistant builds asks "The assistant is still building. Stop it?" ("The build stops and what it has added stays in this graph. Then what you chose opens.") with **Stop and go on**.

## See also

- [Ask](../assistant/Ask.md)
- [Build](../assistant/Build.md)
- [Learn](../assistant/Learn.md)
- [The lessons tab](Lessons-Panel.md)
- [The conversation log](Conversation-Log.md)

The default **Assistant** mode answers questions and carries out requested graph changes directly. Choose Explain to keep a turn read-only.
