# Workspace shell ownership

This is the file map for the dark workspace and motion checkpoint. It is not a new design.

- `src/renderer/theme/tokens.css` is the only color and motion-duration source.
- `src/renderer/theme.css` applies those tokens to the toolbar, canvas, React Flow controls, node cards, chat, and the settings dialog. It does not own graph commands.
- `src/renderer/components/settings/SettingsPanel.tsx` reads and writes the existing SQLite settings row, including motion `system | on | reduced | off` and the non-secret provider, model, and base URL. `document.documentElement.dataset.motion` changes only from a successful read or save. Closing the dialog restores the saved form. The dialog enter and exit are CSS transitions on that policy. The API key field stays a blocked save and is not part of that row.
- `src/renderer/components/graph/Inspector.tsx` displays the node React Flow already marked selected. It does not commit.
- `src/renderer/App.tsx` keeps import, export, chat, and projection where they are. The catalog snapshot button uses the same toolbar button. Disabled toolbar controls state why they do nothing.
- `src/main/catalog/repository.ts` owns `SEEDED_NODE_TYPES` and the SQLite catalog. `src/shared/catalog/objectInfo.ts` parses an offline `object_info` snapshot. The codec does not own catalog rows.
- `src/renderer/components/graph/GraphCanvas.tsx` and `src/main/commands/commit.ts` stay the command and projection path.

Tests that must stay green: settings migration, command lifecycle, workflow import/export, strict chat-to-graph, and key clear. `tests/e2e/workspace-motion.test.ts` checks computed durations, Escape, repeated dialog open/close, and writes real Electron captures under `/opt/cursor/artifacts/`.
