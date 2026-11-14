[Русский](Menu-Bar.ru.md)
[Home](../Home.md) › [The window](README.md)

# Menu bar

The menu bar is the top line of the window. It holds every command of the app in seven menus: **File**, **Edit**, **View**, **Graph**, **Assistant**, **Sync**, **Help**. At its right end is the [sync indicator](Sync-Indicator.md). The [toolbar](Toolbar.md), the canvas menus and the keyboard shortcuts run the same commands, so a command does the same thing wherever you start it.

<!-- picture: the menu bar with the File menu open -->

## The menus

| Menu | What is in it | Page |
|---|---|---|
| File | new, open and save a project; open and save a workflow; Settings; Exit | [File menu](File-Menu.md) |
| Edit | undo, redo, select all, delete | [Edit menu](Edit-Menu.md) |
| View | zoom, which panels are shown, descriptions, minimap, language, motion | [View menu](View-Menu.md) |
| Graph | add a node, arrange, subgraphs, groups, the check, the tour, history | [Graph menu](Graph-Menu.md) |
| Assistant | write to the assistant, lessons, pause and stop a build, who answers | [Assistant menu](Assistant-Menu.md) |
| Sync | read your ComfyUI now, read it on a timer | [Sync menu](Sync-Menu.md) |
| Help | the guide, troubleshooting, shortcuts, the conversation log, diagnostics, About | [Help menu](Help-Menu.md) |

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

- On a Russian keyboard layout the letter shortcuts still work: `Ctrl+S` is the same physical key whatever letter it types.
- Most shortcuts do nothing while the cursor is in a text field or a menu is open. `Ctrl+S`, `Ctrl+O`, `Ctrl+N` and `Ctrl+Shift+C` work everywhere.

## See also

- [Toolbar](Toolbar.md)
- [Keyboard shortcuts window](Shortcuts-Window.md)
- [Settings ▸ Shortcuts](Settings-Shortcuts.md)
- [Canvas menus](Canvas-Menus.md)
- [All keyboard shortcuts](../reference/Shortcuts.md)
