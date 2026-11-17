[Русский](History-And-Undo.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# History and undo

Every change of the graph, yours or the assistant's, makes a new version of the graph. The status bar shows its number ("Version 79"). From this history come undo, redo and the replay of how the graph grew. The history is kept in the app's data and survives a restart.

## Undo and redo

- **Edit ▸ Undo** (`Ctrl+Z`) or the back arrow on the toolbar takes back the last change. Its tooltip names it: "Undo: add KSampler", "Undo: set KSampler.steps", "Undo: arrange the graph".
- **Edit ▸ Redo** (`Ctrl+Shift+Z`) puts it back.
- The steps the assistant made one after another are one step: "Undo: the assistant's consecutive steps (16)".
- These are one step each too: opening a workflow, a new project, arranging, deleting several nodes ("removing 3 items"), a paste, a cut or a duplicate, a burst of arrow presses or a drag of several nodes, a group moved by its title, a node added from a dropped link together with that link ("adding a node with its link"), bypass, mute, a colour, replacing a node.
- If you press Undo while an edit is still landing, the app waits for it and undoes that edit.

## What undo cannot do

- "The assistant is still building. Stop it to undo."
- "This build is too old to undo in one step: the version of the graph before it is no longer kept."
- Settings, keys, the chat and the conversation log are not part of the graph history.

## Replay the history

1. Press the clock button on the canvas toolbar, or **Graph ▸ Replay history**.
2. The canvas shows the newest version, read-only: "Version 40 of 40: add Save Image. Read-only."
3. Drag the **Version** slider, or press **Play** to watch the graph grow. Each version shows what it changed: new nodes and links draw in, removed ones fade, changed ones flash, moved ones glide.
4. **Exit replay**, `Escape` or the same menu item go back to the current graph. Nothing changed.
5. **Return to this version** makes the graph this version again, as a new step: "The graph is back at version 12. Later versions stay in the history."

While the replay shows, the graph does not change: an edit says "History replay is open". **Node**, **Arrange** and **Tour** are hidden on the canvas toolbar. When the assistant starts a build, the replay closes: "History replay closed: the helper is building on the current graph."

## How much is kept

Automatic cleanup aims for up to 2000 recent versions per project and a soft 256 MiB budget based on the current graph size. It keeps at least the latest 200 versions, plus older versions needed by the current graph, open assistant runs, paused tasks or suggestions. Protected versions can put the total above the target. A new project with fewer versions keeps all of them.

**Settings → Privacy → Graph history storage** shows measured graph and command data, the available date range and the current retention target. **Review old-version cleanup** previews how many older versions can be removed and how much data they occupy. Confirming keeps the newest 200 and every protected version. If the graph or protected work changes, cleanup stops and the figures update.

Removed versions cannot be restored with Undo. Save a project copy first if you need the older history. Cleanup keeps the current graph, other projects, chat and saved files. The database file may retain its size on disk: later saves reuse the space. The displayed data size is not the size of the whole profile.

## Limits

- On a graph of many hundreds of nodes an undo can take a second or more.

## See also

- [Edit menu](../interface/Edit-Menu.md)
- [The status bar](../interface/Status-Bar.md)
- [Pausing and stopping](../assistant/Pause-And-Stop.md)
- [Known limits](../reference/Known-Limits.md)
