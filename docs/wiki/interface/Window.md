[Русский](Window.ru.md)
[Home](../Home.md) › [The window](README.md)

# The window

NodeWise Studio is one window. Every part of it has one job: the menu bar and the toolbar at the top hold the commands, the library on the left holds what your ComfyUI has, the canvas in the middle holds the graph, the right panel explains and checks it, and the status bar at the bottom counts what is on the canvas.

<!-- picture: the whole window at 1400x860 with the six parts numbered -->

## The parts, from top to bottom

| Part | Where | What it is for | Page |
|---|---|---|---|
| Menu bar | the top line: File, Edit, View, Graph, Assistant, Sync, Help | every command of the app; the sync state at the right end | [Menu bar](Menu-Bar.md) |
| Toolbar | under the menu bar | the commands you need most, the assistant chooser, the project name, Settings | [Toolbar](Toolbar.md) |
| Library | the left side | your nodes, your model files, the subgraphs of this project | [Library](Library.md) |
| Canvas | the middle | the graph itself, with its own toolbar on top | [Canvas](Canvas.md) |
| Right panel | the right side | the tabs Assistant, Explain, Properties and Check | [Right panel](Dock.md) |
| Status bar | the bottom line | how many nodes and links, the zoom, the version of the graph, a running build | [Status bar](Status-Bar.md) |

On an empty canvas the window also shows the **Welcome** card with three ways to start: **Take a lesson**, **Open an example**, **Ask the assistant**. See [The Welcome card](Welcome.md).

## How to make room for the canvas

1. Fold the library: the button **Collapse library** at the top right of the library, or **View ▸ Library** (`Ctrl+B`). The library becomes a thin strip of icons; a click on an icon opens it again.
2. Hide the right panel: the button **Hide tools** at the top right of the panel, or **View ▸ Tools panel** (`Ctrl+J`). A strip of icons stays on the right edge; **Show tools** brings the panel back.
3. Make the right panel narrower or wider: drag its left edge (**Resize tools**). It can be from 320 to 720 pixels wide, and the canvas always keeps at least 560 pixels.

## How the window behaves at different sizes

- The smallest window is 800 by 560 pixels.
- The window opens at the size and place it had when you closed it.
- When the window is narrower than 1180 pixels, the library starts folded, and it folds by itself when you make the window narrower than that.
- On the first start the right panel opens on the **Assistant** tab.
- **View ▸ Show both** puts Properties and Assistant side by side. It needs a window at least 1280 pixels wide; the canvas keeps at least 560 pixels beside both. When there is no room, the button says why: "Side by side needs room: the canvas keeps at least 560 px beside both panes. Fold the library or widen the window."
- When the four tab names of the right panel do not fit, the tabs show only their icons; the name appears when you hover over one.

## The look and the size

The app has one dark theme. You can change the accent colour, the density, the glow and the motion in [Settings ▸ Appearance & Motion](Settings-Appearance.md). The language of the window (English or Русский) changes at once in **View ▸ Language**; on the first start the app takes the language of your system.

To make every text, button and panel larger or smaller, use **View ▸ Larger interface** (`Ctrl+Alt+=`), **View ▸ Smaller interface** (`Ctrl+Alt+-`) and **View ▸ Normal interface size** (`Ctrl+Alt+0`), or the setting **Interface size** (80 to 200 %). `Ctrl+=` and `Ctrl+-` zoom only the canvas.

## Moving around with the keyboard

- `F6` moves to the next part of the window: the menu bar, the toolbar, the library, the canvas, the right panel and the status bar. `Shift+F6` moves back. Each part takes you to the element you used last there.
- `Alt` or `F10` opens **File** in the menu bar.
- `F8` goes to the notifications.
- `F1` opens **Keyboard shortcuts**, also while you type in a field.

A screen reader hears a node by its title, class, marks and how many inputs are linked, and a link by its two nodes and ports. An empty required input is read as "required, empty". A finished answer, a new lesson step and the start and end of a sync are read out once. See [Accessibility](../trust/Accessibility.md).

## The tour of the window

**Help ▸ Tour of the window** walks through six stops: the menu, the library, the canvas, the toolbar, the right panel and the status bar. Each stop has a short card with **Next**, **Back** and **Skip the tour**; the last one has **Done**. The arrow keys move between stops and `Escape` ends the tour. It does not block the window. The tour starts by itself once, on your first start, and never again unless you ask for it.

In lesson steps and in this tour, the first mention of each glossary word is underlined with dots. Hover over it, or reach it with `Tab`, to see what it means.

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
