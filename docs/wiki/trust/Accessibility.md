[Русский](Accessibility.ru.md)
[Home](../Home.md) › [Trust](README.md)

# Accessibility

What works today with a keyboard, a screen reader, reduced motion and contrast, and what does not work well yet.

## Keyboard

- Every menu is reachable from the keyboard: `Alt` or `F10` opens the menu bar, `Shift+F10` the context menu.
- The main commands have shortcuts, and they work in the Russian keyboard layout too.
  [Keyboard shortcuts](../reference/Shortcuts.md)
- On the canvas a node can be selected, moved and connected with the keyboard: `Enter` or `Space` selects a node,
  the arrow keys move it, `Delete` removes it, `Esc` cancels.
- Dialogs keep the focus inside them and close with `Esc`.

**Not well yet:** after many actions in a row the focus can fall back to the start of the window, and moving with
`Tab` through the nodes of a large graph follows the order they were added, not their place on the canvas.

## Screen readers

- Menus, dialogs, settings, the library and the chat have names and roles a screen reader announces.
- Short notices (copied, saved, checking) are announced as they appear.

**Not well yet:**

- Nodes and links on the canvas are announced with little more than their number; a link is announced as "Edge from
  1 to 2", in English whatever the interface language.
- While the assistant writes, its answer is announced piece by piece as it grows, which can flood the reader.
  Pausing the reader until the answer ends helps.

<!-- verify: screen reader behaviour on the current build -->

## Motion

Settings ▸ Appearance & Motion ▸ Motion: System (follows your system's "reduce motion" setting), On, Reduced or Off. With Off,
the canvas does not glide when it moves to a node and the assistant's build appears without its step-by-step
animation. <!-- verify: what Reduced and Off switch off -->

## Contrast and size

- Text and controls are checked against the WCAG contrast levels: 4.5:1 for text and 3:1 for focus rings, borders
  and port colours. A test fails the build when a colour pair drops below its level.
- The canvas zooms (`Ctrl+=`, `Ctrl+-`, `Ctrl+0`). The rest of the window has no zoom of its own yet; use your
  system's text scaling.

## Reporting a problem

An accessibility problem is a bug: please open an Issue and say which reader or tool you use.

## See also

- [Trust](README.md)
- [Keyboard shortcuts](../reference/Shortcuts.md)
- [Known limitations](../reference/Known-Limits.md)
