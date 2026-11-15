[Русский](Shortcuts.ru.md)
[Home](../Home.md) › [Reference](README.md)

# Keyboard shortcuts

The full table of the default keys. Help ▸ Keyboard shortcuts (`F1`) shows the same list in the app, with your own
changes. Settings ▸ Shortcuts changes or removes any of them: choose Change, press the new keys, then Save settings.

Most shortcuts work when the cursor is not in a text field. Save project, Save project as…, Open project, New project,
Check graph and `F1` work everywhere.

## Keyboards and layouts

- On a Latin layout (QWERTY, AZERTY, QWERTZ, Dvorak) press the key marked with the letter or sign.
- On a Russian or another non-Latin layout press the key in the same place as on a US keyboard: `Ctrl+Z` is the
  key that types «я». Settings ▸ Shortcuts says "On this keyboard: the Я key" or "On this keyboard: type it with
  Shift or AltGr" where it matters.
- On macOS (a build from source, not tried) `Cmd` takes the place of `Ctrl`.

## Moving around the window

| Keys | What it does |
| --- | --- |
| `Alt` or `F10` | Goes to the menu bar (File gets a visible outline); the arrow keys move through it. |
| `F6` and `Shift+F6` | Move between the menu bar, toolbar, library, canvas, right panel and status bar. |
| `F8` | Goes to the notifications. |
| `Shift+F10` or the Menu key | Opens the context menu of the canvas or of the selected node. |
| `F1` | Keyboard shortcuts (also while typing, but not over another dialog). |

## File

| Keys | Command |
| --- | --- |
| `Ctrl+N` | New project |
| `Ctrl+O` | Open project |
| `Ctrl+S` | Save project |
| `Ctrl+Shift+S` | Save project as… |
| `Ctrl+I` | Open workflow… |
| `Ctrl+E` | Save workflow for ComfyUI… |
| `Ctrl+,` | Settings… |
| `Ctrl+Q` | Quit |

## Edit

| Keys | Command |
| --- | --- |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+X` | Cut |
| `Ctrl+V` | Paste |
| `Ctrl+D` | Duplicate |
| `Ctrl+A` | Select all |
| `Delete` or `Backspace` | Delete selection |

## Graph

| Keys | Command |
| --- | --- |
| `Ctrl+K` | Add node… |
| `Ctrl+G` | Make a subgraph from selection |
| `Ctrl+Shift+G` | Make a group from selection |
| `Ctrl+Shift+B` | Bypass: ComfyUI skips the selected nodes. Press again to make them run. |
| `Ctrl+M` | Mute: ComfyUI does not run the selected nodes. Press again to undo. |
| `Alt+C` | Collapse (or expand) the selected nodes |
| `Ctrl+Shift+L` | Arrange the graph |
| `Ctrl+Shift+C` | Check graph |

`Ctrl+B` is not bypass here: it shows or hides the library.

## View

| Keys | Command |
| --- | --- |
| `Shift+1` | Fit to view |
| `Ctrl+=` | Zoom in (the canvas only) |
| `Ctrl+-` | Zoom out (the canvas only) |
| `Ctrl+0` | Actual size |
| `Ctrl+Alt+=` | Larger interface |
| `Ctrl+Alt+-` | Smaller interface |
| `Ctrl+Alt+0` | Normal interface size |
| `Ctrl+B` | Library |
| `Ctrl+J` | Tools panel |
| `Esc` | Stop the tour or replay |

## Assistant and Help

| Keys | What it does |
| --- | --- |
| `Ctrl+/` | Message the assistant |
| `Enter` | Sends the message; `Shift+Enter` starts a new line. |
| `↑` and `↓` in an empty message box | Bring back earlier questions. |
| `F1` | Keyboard shortcuts |

## On the canvas

| Keys | What it does |
| --- | --- |
| `Tab` | Steps through the nodes. A link is reached with `Tab` after one of its nodes is selected. |
| `Enter` or `Space` | Selects the node that has focus. |
| Arrow keys | Move the selected node. They do not move the focus to another node. |
| `Delete` or `Backspace` | Deletes the selected node or link; the focus goes to the nearest node. |
| `Shift+F10` on an input or output | Opens its menu: choose "Suggest a link", then `Enter` links it. |
| `Ctrl`, `Shift` or `Cmd` + click | Adds a node to the selection. |
| `Esc` | Cancels a link being drawn or an edit. |

A note on the canvas: a double click or `Enter` opens it for writing, `Ctrl+Enter` or a click elsewhere saves, `Esc`
keeps the old text.

## In the library

| Keys | What it does |
| --- | --- |
| `↓` in the search | Goes into the list. |
| `Space` | Opens the node's card; `Esc` goes back to the list. |
| `Enter` | Adds the node to the canvas. On Models, opens the model card. |

## In the tours

| Keys | What it does |
| --- | --- |
| `→` and `←` | Next and previous step (Graph ▸ Guided tour; in Help ▸ Tour of the window, while the card has focus). |
| `Space` | Plays or pauses the guided tour of the graph. |
| `Esc` | Ends the tour. |

## See also

- [Reference](README.md)
- [Accessibility](../trust/Accessibility.md)
- [The menu bar](../interface/Menu-Bar.md)
- [Settings: Shortcuts](../interface/Settings-Shortcuts.md)
