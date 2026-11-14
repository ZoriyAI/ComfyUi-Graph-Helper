[Русский](History-And-Undo.ru.md)
[Home](../Home.md) › [Working with a graph](README.md)

# History and undo

Every change of the graph, yours or the assistant's, makes a new version of the graph. The status bar shows its number ("Revision 79"). From this history come undo, redo and the replay of how the graph grew. The history is kept in the app's data and survives a restart.

## Undo and redo

- **Edit ▸ Undo** (`Ctrl+Z`) or the back arrow on the toolbar takes back the last change. Its tooltip names it: "Undo: add KSampler", "Undo: set KSampler.steps", "Undo: arrange the graph".
- **Edit ▸ Redo** (`Ctrl+Shift+Z`) puts it back.
- A whole build of the assistant is one step: "Undo: the assistant's build (steps: 16)".
- Opening a workflow, a new project and arranging are one step each.

## What undo cannot do

- "The assistant is still building. Stop it to undo."
- "This build is too old to undo in one step: the version of the graph before it is no longer kept."
- Settings, keys, the chat and the conversation log are not part of the graph history.

## Replay the history

1. Press the clock button on the canvas toolbar, or **Graph ▸ Replay history**.
2. The canvas shows the newest version, read-only: "Revision 40 of 40: add Save Image. Read-only."
3. Drag the **Revision** slider, or press **Play** to watch the graph grow.
4. **Exit replay**, `Escape` or the same menu item go back to the current graph. Nothing changed.

While the replay shows, nothing can be edited.

## How much is kept

Up to 2000 versions per project; for very large graphs fewer, never fewer than 200. Older versions are removed by themselves.

## Limits

- On a graph of many hundreds of nodes an undo can take a second or more.
- Moving or deleting several nodes is one step per node.

<!-- verify: the canvas and files branch makes a multi-move and a multi-delete one step each -->

## See also

- [Edit menu](../interface/Edit-Menu.md)
- [The status bar](../interface/Status-Bar.md)
- [Pausing and stopping](../assistant/Pause-And-Stop.md)
- [Known limits](../reference/Known-Limits.md)
