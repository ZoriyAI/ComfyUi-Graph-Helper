[Русский](Window.ru.md)
[Home](../Home.md) › [The window](README.md)

# The window

Graph Helper for ComfyUI is one window. Every part of it has one job: the menu bar and the toolbar at the top hold the commands, the library on the left holds what your ComfyUI has, the canvas in the middle holds the graph, the right panel explains and checks it, and the status bar at the bottom counts what is on the canvas.

<!-- picture: the whole window at 1400x860 with the six parts numbered -->

## The parts, from top to bottom

| Part | Where | What it is for | Page |
|---|---|---|---|
| Menu bar | the top line: File, Edit, View, Graph, Assistant, Sync, Help | every command of the app; the sync state at the right end | [Menu bar](Menu-Bar.md) |
| Toolbar | under the menu bar | the commands you need most, who answers, the project name, Settings | [Toolbar](Toolbar.md) |
| Library | the left side | your nodes, your model files, the subgraphs of this project | [Library](Library.md) |
| Canvas | the middle | the graph itself, with its own toolbar on top | [Canvas](Canvas.md) |
| Right panel | the right side | the tabs Assistant, Explain, Inspector and Check | [Right panel](Dock.md) |
| Status bar | the bottom line | how many nodes and links, the zoom, the version of the graph, a running build | [Status bar](Status-Bar.md) |

On an empty canvas the window also shows the **Welcome** card with three steps: **Connect ComfyUI**, **Choose who answers**, **Ask or build**. See [The Welcome card](Welcome.md).

## How to make room for the canvas

1. Fold the library: the button **Collapse library** at the top right of the library, or **View ▸ Library** (`Ctrl+B`). The library becomes a thin strip of icons; a click on an icon opens it again.
2. Hide the right panel: the button **Hide tools** at the top right of the panel, or **View ▸ Tools panel** (`Ctrl+J`). A strip of icons stays on the right edge; **Show tools** brings the panel back.
3. Make the right panel narrower or wider: drag its left edge (**Resize tools**). It can be from 320 to 720 pixels wide, and the canvas always keeps at least 560 pixels.

## How the window behaves at different sizes

- The smallest window is 800 by 560 pixels.
- The window opens at the size and place it had when you closed it.
- When the window is narrower than 1440 pixels, the library starts folded, and it folds by itself when you make the window narrower than that.
- **View ▸ Show both** puts Inspector and Assistant side by side. It needs a window at least 1280 pixels wide; the canvas keeps at least 560 pixels beside both. When there is no room, the button says why: "Side by side needs room: the canvas keeps at least 560 px beside both panes. Fold the library or widen the window."
- When the four tab names of the right panel do not fit, the tabs show only their icons; the name appears when you hover over one.

## The look

The app has one dark theme. You can change the accent colour, the density and the glow in [Settings ▸ Appearance & Motion](Settings-Appearance.md). The language of the window (English or Русский) changes at once in **View ▸ Language**.

## What can go wrong

- **The window stopped**: "The app window stopped working. Reload it to continue; your graph is saved." Press **Reload**. See [Messages and dialogs](Messages-And-Dialogs.md).
- **The window is not responding**: "The app window has stopped responding. You can wait or reload it; your graph is saved." Choose **Wait** or **Reload**.
- **Something went wrong** in one part of the window: "This part of the window hit an error. Reload the window to continue; your graph is saved."

## Limits

- One window per app. If you start the app a second time, the window that is already open comes to the front.
- No light theme.

## See also

- [Menu bar](Menu-Bar.md)
- [Toolbar](Toolbar.md)
- [Canvas](Canvas.md)
- [Keyboard shortcuts window](Shortcuts-Window.md)
- [First start](../start/First-Hour.md)
