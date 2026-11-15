[Русский](Menu-Bar.ru.md)
[Home](../Home.md) › [The window](README.md)

# Menu bar

The menu bar is the top line of the window. It holds every command of the app in seven menus: **File**, **Edit**, **View**, **Graph**, **Assistant**, **Sync**, **Help**. At its right end is the [sync indicator](Sync-Indicator.md). The [toolbar](Toolbar.md), the canvas menus and the keyboard shortcuts run the same commands, so a command does the same thing wherever you start it.

<!-- picture: the menu bar with the File menu open -->

## The menus

| Menu | What is in it | Page |
|---|---|---|
| File | new, open and save a project; open a workflow, a picture or a recent file; examples; save a workflow; lessons; Settings; Quit | [File menu](File-Menu.md) |
| Edit | undo, redo, cut, copy, paste, duplicate, select all, delete | [Edit menu](Edit-Menu.md) |
| View | zoom, interface size, which panels are shown, descriptions, minimap, pinned nodes, language, motion | [View menu](View-Menu.md) |
| Graph | add a node, arrange, subgraphs, groups, bypass, mute, colour, a node on a link, replace, notes, the check, a ComfyUI error, the grey drafts, the tour, history | [Graph menu](Graph-Menu.md) |
| Assistant | write to the assistant, lessons, pause and stop a build, choose the assistant | [Assistant menu](Assistant-Menu.md) |
| Sync | read your ComfyUI now, read it on a timer | [Sync menu](Sync-Menu.md) |
| Help | the guide, the tour of the window, the glossary, troubleshooting, content rules, the project links, running in ComfyUI, a ComfyUI error, shortcuts, the conversation log, diagnostics, About | [Help menu](Help-Menu.md) |

## How to use the menu bar

1. Click a menu name. The menu opens.
2. Click an item. A grey item cannot run right now; for most of them the reason is the state of the graph (nothing selected, a history replay is showing, no build is running).
3. A shortcut is written on the right of an item. It works without opening the menu.

With the keyboard:

1. Press `Alt` alone, or `F10`. The first menu, **File**, gets the focus.
2. `Left` and `Right` move between menus, `Down` opens a menu, `Up` and `Down` move between items, `Enter` runs the item.
3. `Escape` closes the menu. Focus goes back to where it was.

## Items with a mark or an arrow

- A tick in front of an item (for example **View ▸ Minimap**) means it is on. Choosing it again turns it off.
- An arrow at the right end (for example **View ▸ Language**) opens a short list; a dot marks the current choice.

## Limits

- On a Latin keyboard (QWERTY, AZERTY, QWERTZ, Dvorak) press the key marked with the letter. On a Russian or another non-Latin layout press the key in the same place as on a US keyboard: `Ctrl+Z` is the «я» key.
- Most shortcuts do nothing while the cursor is in a text field or a menu is open. `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+O`, `Ctrl+N` and `Ctrl+Shift+C` work everywhere. `F1` works while you type too, but not over another dialog.
- `F6` and `Shift+F6` move between the menu bar and the other parts of the window. See [The window](Window.md#moving-around-with-the-keyboard).

## See also

- [Toolbar](Toolbar.md)
- [Keyboard shortcuts window](Shortcuts-Window.md)
- [Settings ▸ Shortcuts](Settings-Shortcuts.md)
- [Canvas menus](Canvas-Menus.md)
- [All keyboard shortcuts](../reference/Shortcuts.md)
