[Русский](Welcome.ru.md)
[Home](../Home.md) › [The window](README.md)

# The welcome card

While the canvas is empty, a card titled **Welcome** stands in its middle. It offers three ways to start and, under them, the two things those ways need. It goes away as soon as the graph has a node, and it steps aside while the node search is open.

<!-- picture: the welcome card with the three ways and the two setup rows -->

## The language button

In the top corner of the card is a button with the name of the other language: **Русский** or **English**. A press switches the whole window at once, and the app remembers the choice. On the first start the app speaks the language of your system: Russian on a Russian system, otherwise English. **View ▸ Language** changes it too.

## Three ways to start

| Way | What it says | Button |
|---|---|---|
| **Take a lesson** | Build your first graph yourself: the app leads you step by step and checks each step. No assistant needed. | **Choose a lesson** opens the lessons. See [Learn](../assistant/Learn.md). |
| **Open an example** | A finished lesson graph made of your nodes and models: open it and see how it works. | **Open an example** opens the example of the first lesson your ComfyUI can build. Until ComfyUI is read, there is no button: "Examples appear once the app has read your ComfyUI: they are built from your nodes." |
| **Ask the assistant** | Write what you want, for example "I want a picture from text". The assistant explains every step on the canvas. | **Ask the assistant** puts the cursor in the message field. While no assistant is chosen, the button is **Choose an assistant…** and opens Settings ▸ Assistant. |

Only one button is the main (bright) one at a time.

## What the ways need

Under the three ways are two rows. Each says where it stands and has the one button that moves it on. A done row shows a tick.

| Row | What it asks | Button | When it is done |
|---|---|---|---|
| **Connect ComfyUI** | "Tell the app where your ComfyUI is: the address you open it at in the browser. The app can also find it on this computer." | **Connect…** opens Settings ▸ Connection. After that: **Read ComfyUI**. | The row says, for example, "Read: 75 node types and 331 model files." |
| **Choose the assistant** | "The model that explains and builds: a cloud one (needs a key) or your own on this computer." | **Choose…** opens Settings ▸ Assistant. A cloud assistant without a key shows **Add the key**. | The row says "Assistant: OpenAI." or the provider and model you chose. |

When both are done, the card says: "Your ComfyUI is read and the assistant is chosen. Ask for a graph, learn to build it yourself, or open a workflow."

## Below the rows

- **Open a ComfyUI workflow** opens a workflow file, or a picture or video saved by ComfyUI. See [Opening a workflow](../graph/Opening-Workflows.md).
- Up to two recent files, by name. Hover to see the full path.
- **I have no ComfyUI yet**, while ComfyUI is not read. It opens the card **No ComfyUI yet**: what ComfyUI is, that this app runs nothing itself, three steps to get ComfyUI, and a note that pictures usually need a graphics card with 6 to 8 GB of memory. Its buttons: **Open the ComfyUI download page**, **Find ComfyUI on this computer**, **Open the Ollama download page** (for an assistant without a cloud key) and **Glossary**. A download page opens in your browser only when you press its button.

## The tour of the window

On the very first start, a short tour of the window starts by itself once. See [The tour of the window](Window.md#the-tour-of-the-window).

## What can go wrong

- While reading, the first row says "Reading your nodes and models…".
- "The address answered but named no node and no model. Check that ComfyUI has finished starting, then read again." Wait for ComfyUI and press **Read again**.
- If reading fails, the row shows the reason and **Open connection settings**. If ComfyUI only answered too slowly, the button is **Read again**.

## See also

- [The window at a glance](Window.md)
- [Connecting](../connect/Connecting.md)
- [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- [Opening a workflow](../graph/Opening-Workflows.md)
- [The first hour](../start/First-Hour.md)
