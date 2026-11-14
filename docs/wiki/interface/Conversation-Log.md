[Русский](Conversation-Log.ru.md)
[Home](../Home.md) › [The window](README.md)

# The conversation log

**Help ▸ Conversation log…** opens a window that lists every question you asked the assistant, with what the app sent to the model and what the model answered. It is there for the day an answer is odd or fails: you save the questions to a file and send the file to whoever will look into it. Keys and tokens are never written to the log, and it stays on this computer. How to use it when an answer fails: [Failed answers](../assistant/Failed-Answers.md).

<!-- picture: the Conversation log window with one record ticked -->

## What the window shows

- **Keep the log** switch, and the size: "1 record, 26.2 KB". While off: "The log is off: new questions are not recorded. Switch it on before you repeat the question you want looked into."
- **Tick:** **the last one**, **today**, **with an error (2)**, **all**, **none**.
- One row per question: when ("Today, 05:48 PM", "Yesterday, …"), how it ended (**Answered**, **Error**, **Paused at a checkpoint**, **Stopped by you**, **Not finished**), the mode (question, build, chat), your question, and a line with the model, the kind of assistant, the number of steps and tool calls, the time and the tokens ("tokens: 170 in, 340 out").
- **Copy report** on a row: "A short text about this question: what was asked, each step, errors. Paste it into a message."

## Buttons at the bottom

- **Open folder** opens the folder with the log files.
- **Clear the log** deletes all records after a question: "Delete all 12 records? It cannot be undone." **Delete** or **Keep**.
- **Close**.
- **Save to a file (1)…** writes the ticked questions into one file. "The log is saved: 1 question. File: … Send it whole, as it is." with **Show the file**.

## When it is empty

"Nothing recorded yet. Ask the assistant something. The record appears here by itself."

## Limits

- Old records are removed by themselves.
- The log is switched on and off here or in Settings ▸ Privacy (**Keep a log of the conversation with the model**).

## See also

- [Failed answers](../assistant/Failed-Answers.md)
- [Help menu](Help-Menu.md)
- [Settings: Privacy](Settings-Privacy.md)
- [The data folder](../reference/Data-Folder.md)
