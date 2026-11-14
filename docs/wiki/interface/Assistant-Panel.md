[Русский](Assistant-Panel.ru.md)
[Home](../Home.md) › [The window](README.md)

# The assistant tab

The **Assistant** tab is where you talk to the assistant. It shows the conversation, the switch between **Ask**, **Build** and **Learn**, and the message field. What the assistant does in each mode is on [The assistant](../assistant/Assistant.md).

<!-- picture: the assistant tab during a build: step list, summary and the composer -->

## The parts

- **The header**: while the assistant answers, "Answering" with **Pause** and **Stop** ("Stops the run. Changes already applied stay in the graph."). While paused: "Paused" with **Resume**.
- **The conversation**: your messages and the answers. Answers can hold lists, tables, code and links. Under an answer:
  - **What the assistant looked at**: a quiet line of what it read ("read the graph", "searched the node catalog for “sampler”", "searched the web for “…”"), folded by default.
  - **Build · 8 steps**: the steps of a build, each with **Show on the canvas: …**, and **Why each step** to read the reasons.
  - **Build result**: "Done: 7 nodes, 9 links, 5 fields set." and **What next:** **Tour the graph**, **Check the graph**, **Save workflow…**.
  - Grey-draft cards with **Accept** and **Reject**. See [Grey drafts](../assistant/Drafts.md).
  - A link to the log of the answer: "The log of this answer: what was sent to the model and what it answered".
- **The mode switch**: **Ask**, **Build**, **Learn**, with one line under it on what the mode does.
- **The message field**: "Ask about the graph" in Ask, "Ask for a graph change" in Build. `Enter` sends, `Shift+Enter` adds a line. The round button on the right is **Send**; while the assistant answers it is off ("The assistant is answering; wait or press Stop.").

## An empty conversation

"No messages yet" with a hint, and **Start with a question**: **What can I build with my models?**, **Explain this graph**, **What is next?**.

## When a build pauses

After the number of steps set in **Steps per answer**, a **Checkpoint** card says "The assistant used 60 steps and paused", with **Continue** and **Stop**. After several failed attempts in a row: "The assistant paused after 3 failed attempts in a row". See [Pausing and stopping](../assistant/Pause-And-Stop.md).

## When an answer fails

A block says what happened, for example "The model server does not answer. Check that it is running and the address in the assistant settings.", with **Ask again**, **Open the assistant settings** and **What the server said**. See [Failed answers](../assistant/Failed-Answers.md).

<!-- verify: the dock look branch changes the look of answers, the error block and the composer; the assistant branch adds loading earlier messages and ↑ for earlier messages -->

## See also

- [Ask](../assistant/Ask.md)
- [Build](../assistant/Build.md)
- [Learn](../assistant/Learn.md)
- [The lessons tab](Lessons-Panel.md)
- [The conversation log](Conversation-Log.md)
