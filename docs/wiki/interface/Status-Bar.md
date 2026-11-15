[Русский](Status-Bar.ru.md)
[Home](../Home.md) › [The window](README.md)

# The status bar

The status bar is the bottom line of the window. On the left it counts what is on the canvas; then it shows a running build of the assistant and, when there is one, the notice of a new version.

## What it shows

| Item | Example | Meaning |
|---|---|---|
| nodes | "7 nodes" | nodes in the whole graph |
| links | "9 links" | links in the whole graph |
| selection | "No selection", "2 selected" | selected nodes |
| zoom | "Zoom 60%" | the zoom of the canvas |
| version | "Version 79" | the number of the current version of the graph; every change makes a new one. See [History and undo](../graph/History-And-Undo.md). |
| a build | "The assistant is changing the graph" with **Pause** and **Stop**; "The assistant is paused" with **Resume** and **Stop** | only while the assistant builds |
| a new version | "Version … is available" with **What is new**, **Download** and **Hide until the next version** | only when **Check for new versions** is on in [Settings ▸ Privacy](Settings-Privacy.md) and a newer version exists |

The language and the motion are no longer shown here; they are in the View menu and in [Settings ▸ Appearance & Motion](Settings-Appearance.md). `F6` reaches the status bar from the keyboard.

When a build needs the room, the zoom and the version give way first.

## See also

- [The window at a glance](Window.md)
- [Pausing and stopping](../assistant/Pause-And-Stop.md)
- [View menu](View-Menu.md)
