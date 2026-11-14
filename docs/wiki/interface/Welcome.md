[Русский](Welcome.ru.md)
[Home](../Home.md) › [The window](README.md)

# The welcome card

While the canvas is empty, a card titled **Welcome** stands in its middle. It shows the three first steps and marks the ones already done with a tick. It goes away as soon as the graph has a node, and it steps aside while the node search is open.

<!-- picture: the welcome card with step 1 done and step 2 waiting -->

## The steps

| Step | What it asks | Button | When it is done |
|---|---|---|---|
| 1 **Connect ComfyUI** | Tell the app where your ComfyUI is. | **Connect…** opens Settings ▸ Connection. After that: **Read ComfyUI**. | The card says, for example, "Read: 75 node types and 331 model files." |
| 2 **Choose who answers** | Pick the model that explains and builds: a cloud one (needs a key) or your own. | **Choose…** opens Settings ▸ Assistant. A cloud assistant without a key shows **Add the key**. | The card says "Assistant: OpenAI." or the name you chose. |
| 3 **Ask or build** | Write what you want, for example "I want a picture from text". | **Ask the assistant** puts the cursor in the message field. | |

Under the steps are two more ways to start:

- **Learn to build it yourself** opens the lessons. See [Learn](../assistant/Learn.md).
- **Open a ComfyUI workflow** opens a workflow file. See [Opening a workflow](../graph/Opening-Workflows.md).

## What can go wrong

- While reading, step 1 says "Reading your nodes and models…".
- "The server answered but named no node and no model. Check that ComfyUI is running next to it, then read again." Start ComfyUI and press **Read again**.
- If reading fails, step 1 shows the reason and **Open connection settings**.

<!-- verify: the connection branch changes step 1 so a plain running ComfyUI is the main way; the texts of step 1 will change -->

## See also

- [The window at a glance](Window.md)
- [Connecting](../connect/Connecting.md)
- [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- [The first hour](../start/First-Hour.md)
