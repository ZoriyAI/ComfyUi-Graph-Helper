# Native workflow compatibility — 17 November 2026

This qualification covers file preservation, supported editor commands and the official frontend. It does not claim that every model, custom extension or GPU workflow executes successfully.

## Versions and corpus

- Running ComfyUI: **0.45.3**; installed official frontend: **1.58.5**.
- Installed official workflow templates: **0.11.107**, JSON package **0.1.133**.
- Corpus: **696 JSON files**, of which **678 canvas workflows** and **18 other documents**; no unreadable JSON. Other documents are classified explicitly, not counted as workflows.
- Manifest SHA256: `8b2bb04c860be9d4ca5aef6b73b3b6e8b030e3d54a132ab25c709a25e7a0cf2c`.
- `tests/corpus/workflowRoundTrip.test.ts`: **1,356 checks passed**. All 678 workflows survived unchanged import/export; all 678 passed the applicable edit/refusal checks. Commands include movement, parameter edits, removing/retargeting/adding links and nodes where applicable. Unknown positional-to-named widget mappings are refused atomically instead of inventing a named field.

An earlier installed JSON package 0.1.57 contained 517 workflows. Its unchanged round trips all passed, while edit checks exposed a Primitive value reset and an unknown named-widget mutation. Both were fixed before the current corpus passed. The corpus uses a controlled catalog; an unavailable class in this test is not a statement about the user's installed nodes.

## Actual frontend

An isolated Chromium profile loaded the real server's assets, catalog and 69 official core extensions. Server writes were blocked; settings were intercepted locally; no prompt was queued and the owner's profile was unchanged. A write-blocked startup with all 813 extension scripts did not settle, so this report does not qualify all custom JavaScript.

Four paths completed with no page errors:

1. A NodeWise root workflow containing DynamicCombo, Autogrow/list inputs and a native reroute opened and serialized in ComfyUI.
2. NodeWise wrapped nodes into a subgraph and exposed a nested dynamic parameter; ComfyUI retained its value and internal routing point.
3. ComfyUI's modern subgraph save (definition `widgets` and `widgets_values_named`, without legacy `proxyWidgets`) imported into NodeWise, changed the exposed multiplier from 1.5 to 2.75, and reopened in ComfyUI with 2.75.
4. NodeWise dissolved that instance; ComfyUI retained 2.75 and the routing point on the restored edge.

ComfyUI 1.58.5 can serialize a **0.4 outer envelope with native subgraph definitions**. Import preserves it. Creating a new subgraph in an old graph can use NodeWise's explicit format upgrade; the user need not resave it elsewhere first.

## Regression boundaries

Tests cover shared reroute chains, independent graph-level IDs, inner/root movement, unknown extension fields, old tuple-link metadata, Undo, modern named promoted controls, per-instance values, changed dynamic branches and Primitive values after an additional link. An isolated Electron constructor scenario also edits a modern named control, reloads and exports it without reintroducing legacy proxy fields.

Private acceptance artifacts are under `audit-work/desktop/md-completion-audit/`: the corpus manifest/report/log, `qualify-live-comfy.cjs`, `live-native-dynamic-*`, and `native-roundtrip-*`. The real catalog and owner paths are not distributed with the application.

## Русский

На ComfyUI **0.45.3**, frontend **1.58.5** и официальных шаблонах **0.11.107 / JSON 0.1.133** проверены **678 workflow из 696 JSON**. Остальные 18 документов явно отделены. Все 678 файлов сохраняются без изменений при обычном переносе; **1356 проверок** переноса и допустимых команд редактирования прошли. Неизвестный порядок именованных полей теперь даёт атомарный отказ, а дополнительная связь Primitive сохраняет ранее заданное значение.

В настоящем frontend проверены открытие динамического графа, сворачивание в субграф, изменение современного вынесенного поля **1,5 → 2,75**, повторное открытие и разворачивание с сохранением значения и точки связи. Современные `definition.widgets` и `widgets_values_named` работают без добавления старого `proxyWidgets`. Оболочка 0.4 с существующими субграфами сохраняется; для создания новых доступно обновление формата внутри NodeWise.

Проверка выполнена в отдельном профиле с 69 официальными расширениями, без записи на сервер и без запуска GPU. Полный запуск 813 сторонних скриптов с блокировкой их записей не завершился; совместимость всех расширений этим отчётом не подтверждается. Изолированный Electron дополнительно проверил правку современного поля, перезагрузку и экспорт. Манифест и результаты закреплены локально; пользовательский каталог не публикуется.
