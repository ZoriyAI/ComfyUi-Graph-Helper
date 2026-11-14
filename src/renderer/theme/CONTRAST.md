# Contrast table

Measured WCAG 2.x contrast for the token pairs the interface paints. Generated from `tokens.css` with
`theme/contrast.ts`; `tests/unit/contrast.test.ts` fails when a pair drops below its floor or this table goes stale.
Text needs 4.5:1; focus rings, control borders and port colours are non-text and need 3:1.
`--text-faint` is never painted on `--surface-active` (selected rows use `--text-dim` for secondary text).

| Foreground | Background | Ratio | Floor | Used for |
|---|---|---|---|---|
| `--text` | `--surface-canvas` | 16.57 | 4.5 | body text |
| `--text-dim` | `--surface-canvas` | 8.89 | 4.5 | secondary text, hints |
| `--text-faint` | `--surface-canvas` | 6.82 | 4.5 | disabled and tertiary text |
| `--text` | `--surface-panel` | 15.26 | 4.5 | body text |
| `--text-dim` | `--surface-panel` | 8.19 | 4.5 | secondary text, hints |
| `--text-faint` | `--surface-panel` | 6.28 | 4.5 | disabled and tertiary text |
| `--text` | `--surface-raised` | 13.84 | 4.5 | body text |
| `--text-dim` | `--surface-raised` | 7.43 | 4.5 | secondary text, hints |
| `--text-faint` | `--surface-raised` | 5.70 | 4.5 | disabled and tertiary text |
| `--text` | `--surface-overlay` | 12.36 | 4.5 | body text |
| `--text-dim` | `--surface-overlay` | 6.63 | 4.5 | secondary text, hints |
| `--text-faint` | `--surface-overlay` | 5.09 | 4.5 | disabled and tertiary text |
| `--text` | `--surface-sunken` | 16.22 | 4.5 | body text |
| `--text-dim` | `--surface-sunken` | 8.71 | 4.5 | secondary text, hints |
| `--text-faint` | `--surface-sunken` | 6.68 | 4.5 | disabled and tertiary text |
| `--text` | `--surface-hover` | 11.10 | 4.5 | body text |
| `--text-dim` | `--surface-hover` | 5.96 | 4.5 | secondary text, hints |
| `--text-faint` | `--surface-hover` | 4.57 | 4.5 | disabled and tertiary text |
| `--accent` | `--surface-panel` | 10.76 | 4.5 | accent text and links |
| `--ai` | `--surface-panel` | 8.34 | 4.5 | AI text |
| `--warn` | `--surface-panel` | 11.90 | 4.5 | warning text |
| `--danger` | `--surface-panel` | 9.10 | 4.5 | error text |
| `--ok` | `--surface-panel` | 10.97 | 4.5 | success text |
| `--text-mono` | `--surface-panel` | 11.64 | 4.5 | class types and ids |
| `--accent` | `--surface-raised` | 9.76 | 4.5 | accent text and links |
| `--ai` | `--surface-raised` | 7.56 | 4.5 | AI and focus text |
| `--warn` | `--surface-raised` | 10.79 | 4.5 | warning text |
| `--danger` | `--surface-raised` | 8.25 | 4.5 | error text |
| `--ok` | `--surface-raised` | 9.95 | 4.5 | success text |
| `--text-mono` | `--surface-raised` | 10.55 | 4.5 | class types and ids |
| `--accent` | `--surface-overlay` | 8.72 | 4.5 | accent text and links |
| `--ai` | `--surface-overlay` | 6.75 | 4.5 | AI and focus text |
| `--warn` | `--surface-overlay` | 9.64 | 4.5 | warning text |
| `--danger` | `--surface-overlay` | 7.37 | 4.5 | error text |
| `--ok` | `--surface-overlay` | 8.88 | 4.5 | success text |
| `--text-mono` | `--surface-overlay` | 9.42 | 4.5 | class types and ids |
| `--text` | `--surface-active` | 9.68 | 4.5 | selected row text |
| `--text-dim` | `--surface-active` | 5.20 | 4.5 | selected row secondary text |
| `--on-accent` | `--accent` | 11.46 | 4.5 | primary button label |
| `--on-warn` | `--warn` | 12.23 | 4.5 | warning button label |
| `--on-danger` | `--danger-strong` | 7.29 | 4.5 | danger button label |
| `--accent` | `--accent-soft over --surface-raised` | 7.06 | 4.5 | accent badge |
| `--ai` | `--ai-soft over --surface-raised` | 5.53 | 4.5 | AI / inference badge |
| `--warn` | `--warn-soft over --surface-raised` | 7.74 | 4.5 | warning badge |
| `--danger` | `--danger-soft over --surface-raised` | 6.71 | 4.5 | error badge |
| `--ok` | `--ok-soft over --surface-raised` | 7.22 | 4.5 | fact / success badge |
| `--focus` | `--surface-panel` | 14.29 | 3 | focus ring (non-text, 3:1) |
| `--border-strong` | `--surface-panel` | 3.69 | 3 | control border (non-text, 3:1) |
| `--type-model` | `--surface-canvas` | 9.06 | 3 | port and edge colour (non-text, 3:1) |
| `--type-clip` | `--surface-canvas` | 13.39 | 3 | port and edge colour (non-text, 3:1) |
| `--type-vae` | `--surface-canvas` | 7.65 | 3 | port and edge colour (non-text, 3:1) |
| `--type-conditioning` | `--surface-canvas` | 10.48 | 3 | port and edge colour (non-text, 3:1) |
| `--type-latent` | `--surface-canvas` | 9.80 | 3 | port and edge colour (non-text, 3:1) |
| `--type-image` | `--surface-canvas` | 9.66 | 3 | port and edge colour (non-text, 3:1) |
| `--type-mask` | `--surface-canvas` | 11.13 | 3 | port and edge colour (non-text, 3:1) |
| `--type-controlnet` | `--surface-canvas` | 10.66 | 3 | port and edge colour (non-text, 3:1) |
| `--type-string` | `--surface-canvas` | 9.22 | 3 | port and edge colour (non-text, 3:1) |
| `--type-int` | `--surface-canvas` | 7.84 | 3 | port and edge colour (non-text, 3:1) |
| `--type-float` | `--surface-canvas` | 6.77 | 3 | port and edge colour (non-text, 3:1) |
