[Русский](Assistant-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# Assistant menu

The **Assistant** menu talks to the assistant, opens the lessons, controls a running build and chooses who answers.

## Items

| Item | Shortcut | What it does | Grey when |
|---|---|---|---|
| **Message the assistant** | `Ctrl+/` | Opens the **Assistant** tab and puts the cursor in the message field. | never |
| **Ask about the selection** | none | Asks the assistant what the selected node is for (for a subgraph block: what the subgraph does). | no node is selected, or a replay is showing |
| **Lessons: build it yourself** | none | Opens the **Assistant** tab in its **Learn** mode with the list of lessons. See [Learn](../assistant/Learn.md). | never |
| **Pause the assistant** | none | Pauses the assistant while it answers or builds. | the assistant is not working |
| **Resume the assistant** | none | Lets a paused build go on. | no build is paused |
| **Stop the assistant** | none | Ends the build. What it already added stays on the canvas. | no build is running |
| **Who answers** ▸ **Not chosen** / **OpenAI** / **Anthropic** / **Google Gemini** / **Own server** | none | Chooses the model that answers. The same choice as in the toolbar and in Settings ▸ Assistant; it is saved at once. | never |
| **Assistant settings…** | none | Opens [Settings ▸ Assistant](Settings-Assistant.md). | never |

A build of a developer copy of the app also lists **TEST mode** under **Who answers**: scripted answers for tests, not a live model. An installed app does not offer it.

## See also

- [Pausing and stopping](../assistant/Pause-And-Stop.md)
- [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- [The assistant tab](Assistant-Panel.md)
- [The top toolbar](Toolbar.md)
