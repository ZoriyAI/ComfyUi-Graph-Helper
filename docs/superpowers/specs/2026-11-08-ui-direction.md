# Интерфейс: направление и контракты фазы 2 (2026-11-08)

Дополнение к `2026-11-08-helper-brief.md`. Читать после него. Это десктоп-инструмент, не веб-страница:
глубина, цвет, движение, плотная информативная раскладка, клавиатура и контекстные меню.

## 1. Визуальное направление

- **Ночная цветная тема.** Фон почти чёрный с холодным синим подтоном, поверхности слоями: canvas → panel →
  raised → overlay. Каждый слой светлее на шаг и имеет тонкую границу с внутренним бликом сверху
  (`inset 0 1px 0 rgba(255,255,255,.04)`) и мягкую тень вниз. Акцент — циан/бирюза для действия, фиолет для
  фокуса и ИИ, янтарь для предупреждений, малина для ошибок, мята для успеха.
- **Цвет типов портов** как в ComfyUI, чтобы знание переносилось: MODEL лавандовый, CLIP жёлтый, VAE красный,
  CONDITIONING оранжевый, LATENT розово-пурпурный, IMAGE голубой, MASK зелёный, CONTROL_NET бирюзовый,
  STRING/INT/FLOAT серые. Токены `--type-*` уже есть, расширить. Порт — круг с мягким свечением своего
  цвета при hover/focus и при «подсветке объяснения». Связь окрашена в цвет типа, при выделении — ярче и толще.
- **Нода не плоская:** карточка с заголовком-полосой в цвете категории, скруглением 10px, тенью по глубине,
  лёгким градиентом поверхности. Состояния: selected (кольцо акцента), ai-touched (пульс один раз),
  ghost (пунктир, 55% непрозрачности, десатурация, значок «предложено» и кнопки принять/отклонить),
  error (кольцо малины + иконка), locked (замок), subgraph-instance (двойная рамка, бейдж «субграф»).
- **Типографика:** Geist (уже в проекте), размеры 12/13/14/16/20; моноширинный для id и типов.
- **Иконки:** lucide-react (есть). Никаких эмодзи в интерфейсе.

## 2. Движение (motion)

Токены в `src/renderer/theme/tokens.css`: `--motion-feedback 100ms`, `--motion-enter 160ms`,
`--motion-exit 120ms`, `--motion-panel 200ms`, добавить `--motion-reveal 320ms` (появление ноды/связи),
`--motion-spring` (пружина для появления ноды через `motion`). Политика `data-motion` уже есть; при
`reduced`/`off` всё мгновенно и статично, информация остаётся.

Движение показывает **реальные события**:
- Нода применилась (коммит) → появляется из точки с лёгким масштабом 0.92→1 и подъёмом тени; одновременно
  короткая подпись-подсказка рядом («Добавлен KSampler: семплер делает шаги шума…») из объяснения.
- Связь применилась → прорисовка пути через `stroke-dashoffset` за `--motion-reveal`, порты по краям
  вспыхивают цветом типа.
- Призрак предложен → появляется без прорисовки, тихо, пунктиром; принят → превращается в реальную ноду
  той же анимацией появления; отклонён → растворяется.
- Объяснение по объекту → один импульс свечения вокруг объекта и стрелка-указатель от панели объяснения.
- «Что дальше?» → подсветка свободного выхода, призрачная связь к призрачной ноде.
- Пошаговая сборка агентом → каждая применённая команда приходит отдельным событием проекции; между
  событиями UI ничего не выдумывает. Можно включить опцию «следить за агентом» (viewport подъезжает),
  по умолчанию выключена; любое действие человека её останавливает.

Пакет `motion` (`motion/react`) уже установлен: `AnimatePresence`, `motion.div`, `useReducedMotion`.
Для SVG-связей — CSS keyframes. Никаких случайных задержек, stagger только как отражение порядка событий.

## 3. Раскладка

```
┌ AppBar: марка · проект (имя, dirty) · ─ ─ ─ · Sync-индикатор · Провайдер · Проверить граф · Экспорт · ⚙ ┐
├ Rail (библиотека, 300px, сворачивается) ─┬─ Canvas ───────────────────────────┬─ Dock (320–720px) ──────┤
│ Табы: Ноды · Модели · Субграфы          │ плавающий тулбар (добавить, fit,  │ Табы: Чат · Объяснение · │
│ Поиск; фильтры: категория / семья /     │ зум, следить за агентом)          │ Инспектор · Проверка     │
│ вид; карточки с бейджами семьи и вида   │ крошки субграфа (↩ наверх)        │ Чат: сообщения, карточки │
│ перетаскивание на канвас                │ слой призраков поверх React Flow  │ инструментов, предложения│
│                                         │ контекстное меню на всём          │ Объяснение: по объекту,  │
│                                         │                                   │ бейдж источника, история │
├ StatusBar: узлы · связи · ревизия · состояние run (пауза/отмена/продолжить) · язык · motion ─────────────┤
```

Rail и Dock сворачиваются в полосу иконок. Минимальная ширина окна 1024: Rail свёрнут, Dock табами.

## 4. Контекстное меню (Radix ContextMenu)

На ноде: Что это · Зачем это здесь · Что дальше · Объяснить порты · Создать субграф из выделенного ·
Документация компонента · Удалить. На порте (правый клик по handle): Что сюда подключить (вход) / Куда это
идёт (выход) · Какой тип · Предложить соединение. На связи: Что передаётся · Почему так · Разорвать.
На пустом месте: Добавить ноду (поиск) · Вставить субграф · Вставить призраки агента · Fit.
На модели в библиотеке: Что это за модель · С чем совместима · Поставить загрузчик (призрак).

Каждый пункт «спросить» формирует `AgentTurnContext { intent:'ask', objectRef, selection }` и
отправляет короткое сообщение-шаблон в чат (видно человеку); ответ агента записывается объяснением и
подсвечивает объект.

## 5. Компоненты дизайн-системы `src/renderer/ui/`

Каждый компонент: `Name.tsx` + `Name.module.css`, типизированные пропсы, forwardRef где уместно, Radix для
доступности. Существующие (Dialog, Tabs, SelectField, Hint) переодеть в модули, не ломая селекторы, на
которые смотрят e2e-тесты (`.settings-dialog`, `.select-content`, `#chat-provider`, `.ghost-button`,
`.send-button` — сохранить как дополнительные классы).

Button (variants: primary, ghost, subtle, danger; sizes sm/md; loading), IconButton, Chip/Badge
(provenance: fact/inference/web/user; family; kind; status), Surface/Panel (elevation 0–3), SearchField,
ContextMenu (Radix), Popover (Radix), Toast (Radix Toast, очередь событий агента), Splitter (есть в
Dock, вынести), ScrollArea (Radix), Switch (Radix), Kbd, Skeleton, ProgressRing, EmptyState, Breadcrumb.

Разрешённые новые зависимости (MIT, пин версии): `@radix-ui/react-context-menu@2.4.1`,
`@radix-ui/react-toast@1.3.1`, `@radix-ui/react-popover@1.3.1`, `@radix-ui/react-scroll-area@1.4.0`,
`@radix-ui/react-switch@1.4.1`, `@radix-ui/react-dropdown-menu@2.2.1`. React остаётся 18.3 (React Flow,
Radix и motion совместимы; обновление до 19 — отдельная задача после зелёных e2e).

## 6. Сторы (Zustand) и владение

- `state/graphState.ts` (есть, Canvas расширяет): nodes, edges, components, process, document, `subgraphs`,
  `groups`, `activeSubgraphId` (крошки), selection.
- `state/uiState.ts` (Shell создаёт): `selection: ObjectRef[]`, `focusRef: ObjectRef|null` (объект
  текущего объяснения), `contextTarget`, `railOpen`, `railTab`, `followAgent`, `toasts`.
- `state/proposalsState.ts` (Canvas): `proposals: Proposal[]`, подписка `onProposalsEvent`, accept/reject.
- `state/knowledgeState.ts` (Chat/Explain): `sync: SyncStatus`, `explanations` кэш по `objectKey`,
  `check: GraphCheckReport|null`.
- `state/chatState.ts` (есть, Chat расширяет): история из `loadChatHistory`, карточки инструментов.

## 7. Границы компонентов фазы 2

| Поток | Компоненты (экспорт) | Пропсы/контракт |
|---|---|---|
| Shell | `App.tsx`, `components/shell/AppBar.tsx`, `Rail.tsx`, `StatusBar.tsx`, `components/library/NodeLibrary.tsx`, `ModelLibrary.tsx`, `SubgraphLibrary.tsx`, `components/sync/SyncIndicator.tsx`, `components/settings/**`, `ui/**`, `theme/**`, `state/uiState.ts` | Shell собирает экран из `GraphWorkspace`, `ChatDock`, `ExplainPanel`, `CheckPanel`, `Inspector`. Drag из библиотеки: `dataTransfer` типа `application/x-helper-node` `{classType}` и `application/x-helper-model` `{directory,name}`. |
| Canvas | `components/graph/GraphWorkspace.tsx` (обёртка над React Flow: тулбар, крошки, слой призраков, контекстное меню), `nodes/ComfyNode.tsx`, `nodes/SubgraphNode.tsx`, `edges/TypedEdge.tsx`, `GhostLayer.tsx`, `GraphContextMenu.tsx`, `state/proposalsState.ts` | Пропсы: `onAsk(context: AgentTurnContext, message: string)`, `onCreateSubgraph(nodeIds)`. Принимает drop из библиотеки и коммитит `add-node` через `submitManual`. Экспортирует `highlightObject(ref)` через стор `uiState.focusRef`. |
| Chat/Explain | `components/chat/ChatDock.tsx`, `ToolCard.tsx`, `ProposalCard.tsx`, `components/explain/ExplainPanel.tsx`, `components/check/CheckPanel.tsx`, `services/llm/chatService.ts`, `state/knowledgeState.ts` | `ChatDock` принимает `ask(context, message)` снаружи через стор/контекст; показывает карточки инструментов по именам из `contracts/agentTools.ts`; `ExplainPanel` показывает объяснения для `uiState.focusRef`; `CheckPanel` вызывает `checkGraph` и кликом по находке ставит `focusRef`. |

Общие файлы фазы 2 (править только добавлением): `src/shared/i18n/catalog.ts` (свои пространства:
Shell — `library`, `sync`? (sync принадлежит KB, использовать их ключи), `shell`; Canvas — `canvas`,
`contextMenu`; Chat — `explain`, `chat`, `agent` UI-ключи), `src/renderer/theme/tokens.css` (Shell
владеет; другим добавлять токены только с префиксом своего домена `--canvas-*`, `--chat-*`).

## 8. Доступность и качество

- Всё достижимо клавиатурой: контекстное меню по Shift+F10/Menu, фокус-кольца, ARIA-подписи на портах
  («вход model, тип MODEL, не подключён»).
- Контраст текста ≥ 4.5:1 на всех поверхностях; проверка в e2e `desktop-captures` уже есть, расширить.
- Никаких `any` в новых компонентах; CSS Modules; никаких инлайн-стилей кроме динамических координат.
- E2E на Electron под Xvfb: существующие тесты должны проходить; новые сценарии: контекстное меню →
  вопрос → объяснение записано; призрак → принять → нода в графе; библиотека → drop → нода.
