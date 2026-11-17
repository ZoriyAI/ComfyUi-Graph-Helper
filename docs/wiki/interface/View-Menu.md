[Русский](View-Menu.ru.md)
[Home](../Home.md) › [The window](README.md)

# View menu

The **View** menu changes what you see, not the graph: the zoom of the canvas, the size of the interface, which panels are open, the description cards, the minimap, pinned nodes, the language and the motion.

## Items

| Item | Shortcut | What it does |
|---|---|---|
| **Fit to view** | `Shift+1` | Moves and zooms the canvas so the whole graph is in view. |
| **Zoom in** | `Ctrl+=` | Zooms in. `Ctrl++` works too. |
| **Zoom out** | `Ctrl+-` | Zooms out. |
| **Actual size** | `Ctrl+0` | Sets the zoom to 100 %. |
| **Larger interface** | `Ctrl+Alt+=` | Makes every text, button and panel larger. The canvas zoom stays its own. |
| **Smaller interface** | `Ctrl+Alt+-` | Makes them smaller. |
| **Normal interface size** | `Ctrl+Alt+0` | Back to 100 %. The setting **Interface size** in [Settings ▸ Appearance & Motion](Settings-Appearance.md) does the same, from 80 to 200 %. |
| **Library** | `Ctrl+B` | Opens or folds the [library](Library.md). A tick means open. |
| **Tools panel** | `Ctrl+J` | Shows or hides the [right panel](Dock.md). A tick means shown. |
| **Show both** | none | Puts Properties and Assistant side by side in the right panel. Grey when the window is too narrow (it needs 1280 pixels, and 560 pixels for the canvas beside both). |
| **Node descriptions** ▸ **Own notes only** / **All nodes** / **Off (dots only)** | none | Which description cards stand under the nodes. See [Description cards](Description-Cards.md). |
| **Minimap** | none | Shows or hides the small overview in the bottom right corner of the canvas. |
| **Follow the assistant** | none | While the assistant builds, the view moves to each new node. Any pan or zoom of yours turns it off for now. |
| **Pin nodes** | none | Nodes stay where they are: they cannot be dragged. Fields, links and the view still work. A tick means on, and a chip **Nodes pinned** with **Unpin** shows on the canvas. |
| **Language** ▸ **Русский** / **English** | none | Switches the window language at once and remembers it. |
| **Motion** ▸ **System** / **On** / **Reduced** / **Off** | none | How much the window moves. **System** follows the setting of your computer. See [Settings ▸ Appearance & Motion](Settings-Appearance.md#motion). |

**Language** and **Motion** are saved at once, without opening Settings.

## A command that is not in the menu

**Stop the tour or replay** (`Escape`) ends a [tour of the graph](../graph/Tour.md) or a [history replay](../graph/History-And-Undo.md) while the cursor is on the canvas.

## See also

- [Canvas](Canvas.md)
- [Zoom and the canvas](Canvas.md)
- [Settings ▸ Canvas](Settings-Canvas.md)
- [Settings ▸ Appearance & Motion](Settings-Appearance.md)
