# Design system (`src/renderer/ui`)

Every component is `Name.tsx` + `Name.module.css`, typed props, Radix underneath
where there is behaviour, colours only from `theme/tokens.css`. All motion uses the `--motion-*` tokens, so the
motion policy (`html[data-motion]`: system / on / reduced / off) applies without code. Import from `ui/index.ts`
or the file directly.

| Component | Props (beyond native ones) | Notes |
|---|---|---|
| `Button` | `variant: 'primary' \| 'ghost' \| 'subtle' \| 'danger'` (ghost), `size: 'sm' \| 'md'`, `loading`, `icon`, `quiet` | forwardRef. Ghost also carries the legacy `ghost-button` class. Primary: accent gradient and a faint glow; `quiet` keeps the gradient and the top highlight and drops the glow. Press shifts 1px only with full motion. |
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
| `EmptyState` | `icon`, `title`, `children`, `actions`, `size: 'regular' \| 'compact'`, `footer`, `titleAs: 'p' \| 'h2' \| 'h3'` | Says why a region is empty and what to do: icon, title, one sentence, one action. `regular` for a region of its own (a library tab); `compact` inside a panel or a dock tab (smaller tile, no halo). Every empty panel uses it; no dashed boxes, no bare centred text. |
| `Segmented` | `label, value, options: { value, label, icon?, disabled? }[], onChange` | A segmented control (radiogroup): sunken track, the chosen option raised (`--surface-active`). No per-option colours. `Segmented.module.css` `.track` / `.option` can be used through `composes:` by markup of its own (the assistant's modes do). |
| `RadioMark.module.css` | `.mark` (+ `.on`) for a drawn mark, `.input` for a native radio | The one radio look: empty ring off, accent ring with a dot on. Never a native radio with its system look. |
| `AppMark` | `size` | The application's icon (`resources/icon.png`), decorative. The menu bar uses it at 18px. |
| `Breadcrumb` | `items: { id, label, onSelect? }[]`, `label` | Last item is current (`aria-current=page`). |
| `Dialog*` | `DialogRoot/Trigger/Portal/Overlay/Content/Title/Description/Close` | `DialogOverlay` and `DialogContent` are styled (elevation 3, enter/exit on motion tokens). |
| `Tabs*` | `TabsRoot/List/Trigger/Content` | Styled Radix tabs; contexts restyle through their own modules. |
| `SelectField` | `id?, label, value, options, onChange, container?, className?` | Radix select. Keeps `field`, `select-trigger`, `select-content`, `select-item` classes and `data-value`. `CLOSE_OPEN_SELECT` window event closes an open list. |
| `SuggestField` (the list opens from a chevron inside the field; the field's placeholder says what the list offers) | `label, value, onChange, onPick?, inputProps?, suggestions: { value, label?, detail?, badges? }[], pickerLabel, placeholder, emptyText, action?, status?, container?` | A text input plus a Radix select of values the app could read (models, servers, known addresses). Typing stays free; picking fills the input. Same legacy select classes as `SelectField`; closes on `CLOSE_OPEN_SELECT`. Pass the settings `field` class so the input looks like other fields. |
| `RadioCards` | `label, value, options: { value, title, description?, leading?, trailing? }[], onChange, columns?, compact?, hideLabel?` | A radio group drawn as cards (role radiogroup / radio, roving tab stop, arrows select). The card's name is its title only. |
| `NumberField` | `label, value, min, max, step?, unit?, hint?, onChange, decreaseLabel, increaseLabel` | A spinbutton with − / + buttons; typing is clamped to the range and step on blur or Enter. `clampNumber` exported. |
| `Hint`, `HintProvider` | `label`, `side?` | Radix tooltip. Keeps `hint-target` / `hint-content`. |

Depth: frame bars use `--bar-sheen` / `--shadow-bar`, side panels `--panel-sheen` / `--panel-edge`, hoverable cards
`--shadow-lift`, primary actions `--accent-gradient` over `background-color: var(--accent)` (computed colour stays the
accent) with `--glow-accent`. Scrollbars are themed globally in `theme/base.css`.

Rules: no inline styles except dynamic geometry; no `any`; every control keyboard reachable with a visible focus
ring (`--focus`); text contrast per `theme/CONTRAST.md`.

## One glowing primary per view

A primary button (accent gradient and glow) marks *the* next step. At most one glowing primary is visible per
view: the region a person is looking at (the canvas with its welcome card, an open dialog, a dock tab). Other
primaries in the same view take `quiet` (gradient, no glow) or become `subtle`. A popover, a menu and a toolbar
never carry a glowing primary: their actions are `subtle` (the canvas toolbar's Add node is a raised button with
an accent icon). Glow is for the one main action and for focus of attention, never decoration.

## Lists that open (menus, selects, suggestions)

One item spec everywhere: 13px text, rows at least 28px, highlight `--surface-active` with an inset
`--border-strong` ring, the chosen item marked by an accent check. An action row at the end of a select ("Set
up…") reads as normal text with a leading icon, never dimmed like a disabled row.

## Measures and colours

- Form columns (Settings, dialogs) use one width: `min(100%, var(--measure-form))` for fields, hints, groups and
  tables alike. Never a width in `ch`: it changes with each element's font size.
- Shades of the action colour come from `--accent-line`, `--accent-halo`, `--accent-wash`, `--accent-tint`
  (theme/tokens.css), so the accent chosen in Settings reaches them. Never write the cyan as an rgba literal.
- Status colours keep their meaning: mint saved/works, a mint ring for "this session only", violet for the
  assistant and the test mode, amber for a warning, raspberry for an error. Cyan is only for actions.
- Inside a dialog or a card, containers (groups, option cards, notes) are one step lighter than what they sit on;
  only text fields are wells (`--surface-sunken`).
- Font sizes come from the scale tokens (`--text-xs` … `--text-xl`); `--text-mono-xs` (11px) only for key caps.
- A text field's keyboard focus: border `--focus` plus `--focus-field` (a soft ring); buttons and tabs keep the
  2px `--focus` outline.
