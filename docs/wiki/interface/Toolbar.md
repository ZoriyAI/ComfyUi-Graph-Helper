[Русский](Toolbar.ru.md)
[Home](../Home.md) › [The window](README.md)

# The top toolbar

The toolbar is the line of buttons under the menu bar. It holds the commands people use most, the assistant chooser, the name of the project and the Settings button. Each button runs the same command as its menu item.

<!-- picture: the toolbar at 1400 px with each button labelled -->

## Buttons, from left to right

| Button | Same as | What it does |
|---|---|---|
| **New** | File ▸ New project (`Ctrl+N`) | An empty graph. |
| **Open** | File ▸ Open project (`Ctrl+O`) | Opens a project file. |
| **Save** | File ▸ Save project (`Ctrl+S`) | Saves the project file. |
| **Import** | File ▸ Open workflow… (`Ctrl+I`) | Opens a ComfyUI workflow. |
| **Export** | File ▸ Save workflow for ComfyUI… (`Ctrl+E`) | Saves a workflow for ComfyUI. |
| arrow back | Edit ▸ Undo (`Ctrl+Z`) | The tooltip names the change, for example "Undo: add KSampler". |
| arrow forward | Edit ▸ Redo (`Ctrl+Shift+Z`) | |
| **Check** | Graph ▸ Check graph (`Ctrl+Shift+C`) | Checks the graph. After a check a small number on the button shows how many findings there are (green 0, amber more). A screen reader hears the count as a sentence ("3 findings"). |
| circular arrows | Sync ▸ Sync now | Reads your ComfyUI now. |
| **Assistant: …** | Assistant ▸ Choose the assistant | See below. |
| project name | | The title of the graph. An untitled graph is named after its project file, or after the workflow, picture or video it came from, otherwise "Untitled project". A dot after it means the graph is not in a project file as it stands (see [Project files](../graph/Project-Files.md#the-unsaved-mark)). The window title shows the same name, with "•" in front while the dot is there. |
| gear | File ▸ Settings… (`Ctrl+,`) | Opens [Settings](Settings.md). |

In a narrow window the buttons show only their icons; hover over one to see its name and shortcut.

## The assistant chooser

The button reads "Assistant: not chosen", "Assistant: OpenAI" or "Assistant: Your own server · qwen3:8b" (the provider and the short name of the model: the hub, the uploader, GGUF and the quantisation are left out; Settings shows the full name). A dot on its icon shows where the key stands.

1. Click it. A list opens. Its first line says where the key is, for example "The OpenAI key works until the app closes. It is not written to disk."
2. Choose **Not chosen**, **OpenAI**, **Anthropic**, **Google Gemini**, **OpenAI-compatible** or **Your own server**. The choice is saved at once and is the same as in Settings ▸ Assistant.
3. **Set up…** at the bottom opens [Settings ▸ Assistant](Settings-Assistant.md).

When you choose **Your own server** before its address is set, Settings opens so you can give the address and the model.

## See also

- [The menu bar](Menu-Bar.md)
- [Choosing who answers](../assistant/Choosing-Who-Answers.md)
- [Project files](../graph/Project-Files.md)
- [Checking a graph](../graph/Checking-A-Graph.md)
