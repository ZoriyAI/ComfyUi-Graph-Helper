# Design system (`src/renderer/ui`)

Owned by the Shell workstream. Every component is `Name.tsx` + `Name.module.css`, typed props, Radix underneath
where there is behaviour, colours only from `theme/tokens.css`. All motion uses the `--motion-*` tokens, so the
motion policy (`html[data-motion]`: system / on / reduced / off) applies without code. Import from `ui/index.ts`
or the file directly.

| Component | Props (beyond native ones) | Notes |
|---|---|---|
| `Button` | `variant: 'primary' \| 'ghost' \| 'subtle' \| 'danger'` (ghost), `size: 'sm' \| 'md'`, `loading`, `icon` | forwardRef. Ghost also carries the legacy `ghost-button` class. Primary: accent gradient and a faint glow. Press shifts 1px only with full motion. |
| `IconButton` | `label` (required, accessible name and tooltip), `size`, `active` | forwardRef. Icon-only. |
| `Badge` / `Chip` | `tone: neutral \| accent \| ai \| warn \| danger \| ok`, `hue` (dot from the port-type palette), `pill`, `mono`, `icon` | `Chip` = pill badge. Helpers: `ProvenanceBadge {provenance}`, `FamilyBadge {family}`, `KindBadge {kind}`, `StatusBadge {status}`. `familyHue` / `kindHue` map values to hues. |
| `Surface` | `elevation: 0..3`, `as`, `rounded`, `flush` | Layered night surface: lighter per level, 1px border, top inner highlight, shadow. |
| `SearchField` | `value`, `onValueChange`, `label`, `clearLabel` | Escape clears a non-empty value. |
| `ContextMenu*` | `ContextMenuRoot/Trigger/Content/Item/Separator/Label/Shortcut/Sub/SubTrigger/Group` | Radix context menu. `ContextMenuItem` takes `icon`, `shortcut`, `danger`. Content is portalled. |
| `Popover*` | `PopoverRoot/Trigger/Anchor/Close/Content` | Radix popover at elevation 3 with an arrow. |
| `ToastProvider`, `useToast()`, `showToast(input)` | `{ id?, title, description?, tone: info \| success \| warn \| error \| ai, duration?, action? }` | Radix toast. Same `id` replaces the shown toast. The toast is the polite live region (no duplicate announcer text). Toasts never take the pointer except on their buttons. Usable outside React via `showToast`. |
| `Splitter` | `value, min, max, onChange, label, controls, grow: 'left' \| 'right', edge?, step?` | role=separator with drag, arrows, Home (min), End (max). `clampSize` exported. |
| `ScrollArea` | `viewportRef`, `onViewportScroll`, `horizontal` | Radix scroll area with thin scrollbars. |
| `Switch` | `label` + Radix switch props | Visible label is the accessible name. |
| `Kbd` | children | Key cap. |
| `Skeleton` | `width`, `height` | Shimmer only with full motion. |
| `ProgressRing` | `value: 0..1 \| null`, `size`, `stroke`, `label` | role=progressbar; `null` = indeterminate (spins only when motion is allowed). |
| `EmptyState` | `icon`, `title`, `children`, `actions` | Says why a region is empty and what to do. |
| `Breadcrumb` | `items: { id, label, onSelect? }[]`, `label` | Last item is current (`aria-current=page`). |
| `Dialog*` | `DialogRoot/Trigger/Portal/Overlay/Content/Title/Description/Close` | `DialogOverlay` and `DialogContent` are styled (elevation 3, enter/exit on motion tokens). |
| `Tabs*` | `TabsRoot/List/Trigger/Content` | Styled Radix tabs; contexts restyle through their own modules. |
| `SelectField` | `id?, label, value, options, onChange, container?, className?` | Radix select. Keeps `field`, `select-trigger`, `select-content`, `select-item` classes and `data-value`. `CLOSE_OPEN_SELECT` window event closes an open list. |
| `RadioCards` | `label, value, options: { value, title, description?, leading?, trailing? }[], onChange, columns?, compact?, hideLabel?` | A radio group drawn as cards (role radiogroup / radio, roving tab stop, arrows select). The card's name is its title only. |
| `NumberField` | `label, value, min, max, step?, unit?, hint?, onChange, decreaseLabel, increaseLabel` | A spinbutton with − / + buttons; typing is clamped to the range and step on blur or Enter. `clampNumber` exported. |
| `Hint`, `HintProvider` | `label`, `side?` | Radix tooltip. Keeps `hint-target` / `hint-content`. |

Depth: frame bars use `--bar-sheen` / `--shadow-bar`, side panels `--panel-sheen` / `--panel-edge`, hoverable cards
`--shadow-lift`, primary actions `--accent-gradient` over `background-color: var(--accent)` (computed colour stays the
accent) with `--glow-accent`. Scrollbars are themed globally in `theme/base.css`.

Rules: no inline styles except dynamic geometry; no `any`; every control keyboard reachable with a visible focus
ring (`--focus`); text contrast per `theme/CONTRAST.md`.
