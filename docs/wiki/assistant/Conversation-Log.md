[Русский](Conversation-Log.ru.md)
[Home](../Home.md) › [The assistant](README.md)

# The conversation log

The conversation log records, for every question, what the app sent to the model and what the model answered, step by step. Use it when an answer is odd or fails: you can see what happened, and you can send it to someone who will look into it. Keys and tokens never go into it, and it stays on this computer. The window itself is described on [The conversation log](../interface/Conversation-Log.md) in the interface pages.

## How to have a failed answer looked into

1. Make sure the log is on: Settings ▸ Privacy ▸ **Keep a log of the conversation with the model** (on by default). If it was off, switch it on and ask the question again.
2. Open it: **Help ▸ Conversation log…**, or the link "The log of this answer" under the answer.
3. Select the question: **the last one**, **with an error**, or its own box.
4. Either **Copy report** for a short text to paste into a message, or **Save to a file (1)…** for the full detail. Send the file whole, as it is.

## What a record holds

The question and its time, the mode (question, build, chat), the kind of assistant and the model, how it ended (**Answered**, **Error**, **Paused at the step limit**, **Stopped by you**, **Not finished**), every step and tool call, the time it took, and the tokens in and out. Inside the saved file: what was sent and what came back.

## Privacy

The log holds your questions, the graph and the answers, as they were sent. It holds no keys or tokens, and the saved file keeps only the kind of address of your own servers ([this computer], [local network], [internet]) and the port. Old records go by themselves; **Clear the log** removes them all. Turn the log off if you do not want it.

## See also

- [The conversation log window](../interface/Conversation-Log.md)
- [Failed answers](Failed-Answers.md)
- [What is sent to the model](What-Is-Sent.md)
