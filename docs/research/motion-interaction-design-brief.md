# Современный motion-интерфейс ComfyUI Graph Editor — brief кодеру

## Рекомендация

**Сделать тёмный профессиональный рабочий инструмент, а не анимированную демонстрацию:** графитовые поверхности, цветные типизированные порты, чёткая иерархия панелей; движение объясняет реальные изменения и никогда не мешает редактированию. Использовать CSS tokens и встроенную механику React Flow; для небольшого набора переходов панелей — условно принять поддерживаемый пакет Motion, только после проверки реальных зависимостей. Не переписывать граф и чат ради дизайна.

Исследование: 7 ноября 2026, Europe/Berlin (CET). Это самостоятельная проектная рекомендация, **не аудит репозитория и не отчёт о готовой реализации**. React 18 / React Flow 12 / Electron 45 сообщены средой разработки, здесь не проверены. Прочитаны официальные документы ниже; «все статьи» не прочитаны. Полные извлечения ограничены размером; для rendering дополнительно прочитана целевая выборка тела статьи.

Известный из переданного контекста блокер: badges успешных tool-действий остаются в состоянии выполнения. **Исправление и существующие функциональные E2E — раньше motion-полировки.** Анимация не может скрывать этот дефект.

## 1. Что берём из исследований

| Основание | Решение для приложения |
|---|---|
| Fluent: движение функционально, последовательно, связано с задачей; крупные переходы не должны дезориентировать. [Fluent Motion](https://fluent2.microsoft.design/motion) | Один визуальный язык для inspector, settings, palette и chat; без «въезда всего экрана». Двигать преимущественно объект внимания. |
| React Flow предоставляет dark mode, CSS variables и стилизацию классов. [Theming](https://reactflow.dev/learn/customization/theming) | Настроить существующий React Flow через `colorMode` и проверенные `--xy-*` переменные; не заменять библиотеку самодельным canvas. |
| Частые node updates вызывают лишние рендеры; рекомендуются memoization, узкие зависимости, простые стили. [Performance](https://reactflow.dev/learn/advanced-use/performance) | Чат, inspector и toolbar не подписывать на весь массив нод. Не включать анимацию всех связей и тяжёлые тени. |
| Web rendering: предпочтительны transform/opacity; layout/paint и лишние слои требуют измерения. [web.dev](https://web.dev/articles/animations-guide) | Не анимировать геометрию всего workspace на каждом токене/шаге. `will-change` не ставить глобально. |
| WCAG SC 2.3.3 — Level AAA: несущественную анимацию взаимодействия можно отключить. Это не заявление, что всё приложение соответствует WCAG. [W3C](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html) | System/reduced/off, полноценная работа без motion; информация всегда остаётся текстом и иконками. |
| React Flow имеет keyboard/focus/ARIA возможности, но их надо сохранить в custom nodes. [Accessibility](https://reactflow.dev/learn/advanced-use/accessibility) | Доступные элементы не превращать в декоративные div; локализовать инструкции и проверять реальные keyboard flows. |

**Осознанное отличие от Fluent:** хотя руководство обсуждает stagger для списков, здесь не использовать случайную задержку событий графа: порядок операций должен отражать фактические события, а не театральную хореографию.

## 2. Выбор реализации — три варианта

| Подход | Плюсы | Ограничения / решение |
|---|---|---|
| Только существующие CSS transitions/keyframes | Минимум зависимостей; хорошо для hover, focus, border, opacity | При размонтировании и прерывании сложных переходов придётся поддерживать lifecycle вручную. Оставить основной базой; проверить, что уже реализовано. |
| CSS + один Motion package для UI shell | Декларативные enter/exit, presence и reduced-motion политика; меньше самописной оркестрации | Новая зависимость, размер и совместимость. **Предпочтительный ограниченный вариант**, если этих задач уже нет в имеющемся UI toolkit. Не ставить второй motion toolkit. |
| Browser View Transition API | Переходы между DOM/view states без ещё одного пакета | Не engine для node dragging или live stream; совместимость конкретного Electron renderer и поведение snapshot/focus надо проверять. Для текущего этапа не использовать; возможный будущий opt-in для редкой смены workspace. |

Motion installation рекомендует пакет `motion`, импорт `motion/react`, React **18.2+**. [Installation](https://motion.dev/docs/react-installation). В извлечённой accessibility-странице встречаются старые импорты `framer-motion`: не копировать их автоматически; ориентироваться на installation и API закреплённой версии. `motion` components и layout API описаны в [component reference](https://motion.dev/docs/react-motion-component), `MotionConfig reducedMotion="user"` и `useReducedMotion` — в [accessibility guide](https://motion.dev/docs/react-accessibility).

**Проверка версии/лицензии в этом проходе:** npm registry `motion/latest` вернул `14.10.1`, `MIT`, React/ReactDOM peer range `^18.0.0 || ^19.0.0`; также указан peer `remix: ^3.1.0`. Это снимок registry, а не приказ обновляться: проверить optional peer metadata, транзитивные зависимости, React minor и lockfile; более осторожное требование installation 18.2+ не игнорировать. [Registry](https://registry.npmjs.org/motion/latest), [official repository / MIT](https://github.com/motiondivision/motion). Проверить LICENSE/NOTICE **точной выбранной версии**, закрепить разрешённую версию lockfile; платные Motion+ возможности для brief не нужны. Пакет здесь не установлен.

[MDN View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) описывает SPA/MPA-переходы и отдельные возможности API. Наличие в современном браузере не доказывает поддержку всех функций в нашей Electron-сборке: проверить Chromium/runtime, feature detection и fallback. Не применять browser navigation API вслепую к `file://`/custom scheme. Не связывать commit графа с окончанием view transition.

## 3. Информационная архитектура и тёмная тема — проектное предложение

- Центральный workspace: граф с неброской сеткой; toolbar поиска/добавления/undo/redo/fit view и явным масштабом. Слева компактная библиотека нод, справа переключаемые Chat и Inspector либо resizeable split при достаточной ширине. Не заставлять три панели конкурировать на узком окне.
- Inspector показывает выбранную ноду, реальные параметры, порт/type, допустимые соединения, исходящие/входящие связи, ошибки валидации. Chat ссылается на **ID реальных нод** кнопкой «Показать», а не копией графа.
- Вверху: проект, dirty/saved state, ComfyUI connection. В чате: run state и доступные Pause / Cancel / Resume. Не смешивать «LLM подключена», «ComfyUI подключён» и «генерация выполняется».
- Стиль: непрозрачные поверхности, тонкие границы, ограниченная глубина, спокойная типографика; без стекла, постоянного glow, parallax, neon-шума и пульсации всей сцены.
- Ноды: заголовок + тип/категория, типизированные порты, краткие значения, раскрываемые подробности. Выделение и focus различимы. Цвет категории не равен успеху операции.

**Начальная палитра — только предложение, не результат проверки контраста:** canvas `#101217`, panel `#181C24`, raised `#222836`, text `#E7ECF4`, muted `#A8B3C7`, cyan `#64D9F3`, violet `#B59AFF`, success `#75D6A0`, warning `#F0C46C`, error `#FF8A95`. Подобрать границы и контраст реальными проверками для текста, focus, портов и disabled state. Цвет типа сопровождать именем типа; состояния — иконкой и подписью, не только цветом.

## 4. Истина операции отдельно от её отображения

**Контракт предложения:** одинаковый graph command pipeline для manual и chat. Презентационный слой подписывается на подтверждённые события и не производит graph mutations из animation callbacks.

- Хранить идентификатор run/action, порядок событий, затронутые node/edge IDs, результат, error/cancel reason и graph revision. Адаптировать к уже существующему протоколу, не заводить вторую истину.
- План, предложенный моделью, — «Предложено». Отправленная операция — «В очереди / Выполняется». «Применено» — только после подтверждённого изменения canonical graph. Наличие красивой карточки или текст модели «готово» не является подтверждением.
- Жизненный цикл отображения: queued → running → succeeded / failed / cancelled; пауза run — отдельное состояние. succeeded не возникает по таймеру, концу CSS transition или последнему токену.
- Deduplicate повторные события; terminal state не возвращается в running от запоздалого сообщения. Поздний callback старого run не меняет следующий run. При неизвестном исходе показывать «Статус не подтверждён», не фальшивый успех.
- Прогресс с процентом только при реальном измеряемом total; иначе краткий текст выполняемого действия. Запрещена постановочная «сборка графа», fake typing и искусственное растягивание быстрых операций.

### Pause → обсудить → изменить → Resume

Pause сразу подтверждает **запрос**; «На паузе» — после backend acknowledgement / безопасной границы. Если текущий tool нельзя прервать, честно показать «Завершаем текущий шаг; новые не запускаем». Cancel отдельно от Pause, без обещания rollback уже применённых действий. Не блокировать инспекцию.

На паузе пользователь редактирует тот же граф, обсуждает следующий шаг в чате. Resume использует текущую revision и revalidation; конфликт со старым планом показывает diff/объяснение и требует нового решения, а не молча перетирает правку. Undo/redo ручных и AI-команд должны пользоваться существующими транзакциями; visual transitions сами не добавляют history entries. Возможность pause/cancel зависит от реального backend: не показывать рабочий контроль, если поддержки ещё нет.

## 5. Матрица взаимодействий — все значения движения ниже проектные

| Событие | UI и движение | Reduced / Off |
|---|---|---|
| Add node вручную / подтверждённый AI commit | Нода существует сразу, короткое появление внутренней поверхности; badge «Добавлено». Batch виден сразу, без stagger-задержек | Мгновенно; текстовый итог |
| Drag / zoom / pan | Следовать указателю напрямую, без spring/inertia; лёгкая статичная граница активной ноды. React Flow владеет внешним transform | То же непосредственное управление |
| Connect | Preview следует указателю; compatible ports имеют текстовую подсказку типа. Ошибка объясняет несовместимость, не рисует успешную связь | То же; без shake/pulse |
| Selection / keyboard focus | Selection border и отдельный устойчивый focus ring; inspector обновляется без скачка ширины | Мгновенно |
| Annotation | Редактирование inline с явным commit/cancel, без потери caret; подтверждённая подпись появляется без resize-анимации графа | Мгновенно |
| Inspect node / port | Компактная информация по hover **и** focus; закрепляемый inspector для подробностей. Tooltip не единственный способ чтения | Короткий fade либо мгновенно |
| Manual intervention | Видимый badge «Изменено вручную», AI не переставляет выбранную/перетаскиваемую ноду; конфликт подтверждается явно | Статичный badge |
| Pause / cancel / resume | Контроль доступен сразу; label меняется по истинному состоянию. Не ждать завершения перехода | Без движения |
| Settings / palette | Короткий fade + небольшой сдвиг только локальной панели; focus management обязателен | Fade или мгновенно |
| Empty / error / disconnected | Содержательные состояния, см. ниже; без looping illustrations | Статичные состояния |

**Viewport не захватывать:** не вызывать fitView после каждой AI-ноды. «Следить за AI» — явный opt-in; pan/drag/zoom пользователя его приостанавливает. За пределами viewport показывать «Добавлено N нод — Показать». Клавиатурный переход к ноде может раскрыть её в поле зрения; это полезное отличие от автоматического слежения за AI. React Flow описывает `autoPanOnNodeFocus`; сверить доступность конкретного prop в закреплённой версии. [Keyboard/focus](https://reactflow.dev/learn/advanced-use/accessibility).

**Chat streaming:** одна устойчивая карточка текущего ответа, фиксированное место для статуса; не создавать bubble на токен и не анимировать высоту на каждом chunk. Текст естественно переносится, но обработка Markdown и перерисовка группируются, а не запускаются посимвольно. Scroll следует только пока пользователь у нижнего края; при чтении истории — «Новые сообщения», без кражи scroll или focus. ARIA сообщает смену этапа, не каждый токен. Терминальные статусы flush немедленно; busy indicator не скрывает backend error.

## 6. Motion tokens — стартовый дизайн, НЕ нормативные длительности

| Token | Предлагаемый старт | Назначение | Reduced / Off |
|---|---|---|---|
| `motion.instant` | 0 ms | drag, viewport, input, semantic commit | 0 |
| `motion.feedback` | 100 ms | hover / border / opacity feedback | 0–60 ms fade / 0 |
| `motion.enter` | 160 ms | появление локальной карточки/панели | 60 ms opacity / 0 |
| `motion.exit` | 120 ms | уход панели; без удержания ввода | 60 ms opacity / 0 |
| `motion.panel` | 200 ms, не более 8 px смещения | локальное открытие shell panel | opacity / 0 |
| `motion.ease-out` | `cubic-bezier(.2,0,0,1)` | локальный enter | без transform |
| `motion.ease-in` | `cubic-bezier(.4,0,1,1)` | локальный exit | без transform |

Уточнять на реальном Linux окне, не объявлять эти значения «исследованным стандартом». Не применять `transition: all`. Никаких бесконечно анимированных edges, мерцающих glows, bouncing нод, random stagger и задержек input ради красоты. Переходы прерываемые: быстрое reopen не оставляет невидимый overlay. Off не должен ломать обработчики, зависящие сегодня от `transitionend` — такую зависимость убрать.

Настройка motion: System / Reduced / Off, хранить обычной пользовательской конфигурацией. System читает `prefers-reduced-motion`; при недоступной Linux desktop интеграции ручной выбор остаётся рабочим. Reduced отключает spatial/layout transitions, smooth programmatic zoom/pan и декоративные циклы; Off отключает все декоративные переходы. Прямое перемещение пользователем сохраняется. MotionConfig не отключает сторонние CSS/React Flow анимации автоматически — их покрывает общая политика. [Motion accessibility](https://motion.dev/docs/react-accessibility), [W3C](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html).

## 7. Focus, settings и исключительные состояния

- Modal settings: доступное имя, focus внутри, Escape закрывает, возврат к инициатору; обычный inspector не крадёт focus. Inputs не должны запускать graph shortcuts (Delete, Space, стрелки). Использовать существующие доступные primitives, если они есть; Motion не заменяет dialog toolkit.
- Settings: appearance/motion, ComfyUI connection и LLM connection отдельно; понятная валидация, Test connection с реальным результатом. Не раскрывать ключи в статусах/логах. Этот brief не задаёт новый способ хранения секретов.
- Keyboard: Tab, Enter/Space, Escape, стрелки, доступный поиск нод; connection/edit/delete должны иметь keyboard-путь, даже если понадобятся действия через inspector. Не выключать keyboard a11y ради обработки жестов. Сохранить видимый focus, локализовать labels. [React Flow](https://reactflow.dev/learn/advanced-use/accessibility).
- Empty: «Добавить ноду», «Открыть проект», «Описать задачу в чате»; demo явно обозначается как demo, не результаты модели.
- Error: конкретный action, причина и безопасный retry; не повторять destructive operation автоматически. Не терять граф/черновик чата.
- Disconnected: постоянный неброский banner, endpoint и reconnect; ручное локальное редактирование остаётся доступным. «Подключение восстановлено» не означает автоматический restart генерации.

## 8. Изоляция и производительность

Предложенные границы, **не имена существующих файлов**: theme tokens; motion preference adapter; UI-only `PanelTransition` / `StatusBadge` / focus primitives; адаптер реальных run events. Переиспользовать имеющиеся store/components, не вводить новый state manager без необходимости.

React Flow владеет position/viewport transforms. Если нужна node entry animation, только внутри ноды, без второго drag engine и без изменения геометрии/handle hit targets. Не навешивать `layout` на весь граф или transcript. Memoize custom nodes/edges, стабильные callbacks/types; inspector подписывается на выбранный ID/данные, toolbar — на свои поля. [React Flow performance](https://reactflow.dev/learn/advanced-use/performance).

Backpressure: semantic события применяются по порядку, не теряются; декоративные промежуточные highlights можно объединять/пропускать при нагрузке. Coalesce text/progress rendering, bounded UI log/virtualization лишь по измерениям; не накапливать очередь таймеров на каждый token/node. В background/minimized окне прекращать декоративные loops, но не забывать terminal state. При росте нагрузки сначала уменьшать декор, не частоту критических updates.

Для CPU/GPU: преимущественно opacity/transform, без массовых blur/backdrop-filter, full-screen shadows и слоёв для каждой ноды. Профилировать layout/paint, long tasks и input latency во время одновременных graph updates и stream; `will-change` только адресно по измерению. Нельзя обещать «GPU ускорение = бесплатно». [web.dev rendering](https://web.dev/articles/animations-guide). Числовых замеров этой сборки здесь нет.

## 9. Малые checkpoints и критерии приёмки

1. **Функциональная база:** исправить terminal badges и принять прежние E2E без ослабления assertions/timeouts ради зелёного отчёта. Проверить actual node IDs/count, annotation, ответ, success/error/cancel и следующий запрос.
2. **Статичная тема:** tokens, dark React Flow, surfaces/ports/focus/error. Скриншоты настоящей Electron Linux сборки: normal/empty/error/disconnected. Не подменять доказательство mockup.
3. **Interaction correctness:** manual/chat один граф, keyboard/inspector, viewport ownership, scroll-follow policy; Pause/Resume только по поддерживаемому протоколу и revision checks.
4. **Один motion primitive:** проверить package/React compatibility, license, bundle delta и lockfile. Подключить ограниченный panel enter/exit; если существующий toolkit уже решает задачу, новой зависимости не нужно.
5. **Motion policy:** System/Reduced/Off для CSS, package и viewport; одинаковые functional assertions в normal и Off.
6. **Нагрузка и повторная приёмка:** настоящая упакованная Linux Electron сборка, не только браузерный dev server. Сохранить trace, console errors, конкретные build/version/graph fixture и screenshots; сравнить baseline до/после на одной машине. Проблемы не прикрывать сменой темы.

### Checklist тестировщику

- [ ] Реальные create/connect/annotate commit видны в canonical graph; fake success и stale running отсутствуют; duplicate/out-of-order events не ломают badge.
- [ ] Keyboard-only: добавить/выбрать/редактировать/соединить/удалить, undo/redo; focus restore settings, Escape; shortcut не удаляет ноду при вводе текста.
- [ ] Pause-request vs paused; cancel in-flight; ошибка после partial apply; manual edit на паузе; resume revision conflict; следующий run не получает старые callbacks.
- [ ] AI stream + непрерывные drag/zoom: нет рывков viewport, перескоков курсора, авто-fit, случайной смены selection или input blocking.
- [ ] Чат при чтении старого сообщения/выделении текста не скроллит вниз; смены статуса объявляются доступно, не каждый токен.
- [ ] Normal / OS reduced / app Reduced / Off; переключение в процессе; также Electron Linux session, где системная preference не передаётся.
- [ ] Несколько размеров окна и display scale; tooltip/menus не обрезаются; размеры портов и hit targets стабильны при zoom.
- [ ] Малый и репрезентативный большой workflow (размер зафиксировать в отчёте), burst обновлений, длинный transcript, minimized/restore; сравнить trace, CPU/GPU и input responsiveness с baseline. Порог согласовать по замерам, не выдумывать FPS.
- [ ] Rapid open/close, interrupted transition, error/reconnect; невидимые overlays не ловят клики; нет утечек timers/listeners после смены проекта.
- [ ] Весь прежний functional E2E suite сохранён и проходит; screenshot сам по себе не подтверждает functional readiness. Никакая генерация в ComfyUI для этого research не запускалась.

## Sources

- [React Flow — Theming](https://reactflow.dev/learn/customization/theming)
- [React Flow — Performance](https://reactflow.dev/learn/advanced-use/performance)
- [React Flow — Accessibility](https://reactflow.dev/learn/advanced-use/accessibility)
- [Motion — Installation](https://motion.dev/docs/react-installation)
- [Motion — Component API](https://motion.dev/docs/react-motion-component)
- [Motion — Accessibility](https://motion.dev/docs/react-accessibility)
- [Motion official repository / MIT](https://github.com/motiondivision/motion)
- [npm registry motion/latest — observed metadata](https://registry.npmjs.org/motion/latest)
- [MDN — View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [W3C — SC 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [web.dev — Animation and motion](https://web.dev/learn/accessibility/motion)
- [web.dev — High-performance CSS animations](https://web.dev/articles/animations-guide)
- [Fluent 2 — Motion](https://fluent2.microsoft.design/motion)

Данные поиска: `motion-search.json`, `motion-search-supplement.json`. Извлечённые страницы: `motion-extract-core.json`, `motion-extract-supplement.json`; targeted rendering passages: `motion-rendering-extract.json`. Сводный manifest: `motion-sources.json`; npm metadata: `motion-registry.json`. Все пути относительно этой папки `research/`.
