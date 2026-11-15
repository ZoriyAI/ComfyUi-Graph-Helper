[Русский](Code-Words.ru.md)
[Home](../Home.md) › [For developers](README.md)

# Code words and screen words

The code and the screen sometimes use different words for the same thing. This list maps them, so a bug report in
screen words can be found in the code.

| In the code | On screen (English) | On screen (Russian) |
| --- | --- | --- |
| `agent`, `helper`, `llm` | the assistant | помощник |
| `provider` | Provider, who answers | Кто отвечает |
| `test` provider | Test mode | проверочный режим |
| `local` provider | your own model / own server | своя модель |
| `turn` | an answer | ответ |
| `run` (`runs` table) | the assistant's work on one answer; Pause / Resume / Stop the assistant | работа помощника над ответом |
| `checkpoint`, `turn-paused`, `maxStepsPerTurn` | a pause at the step limit; Steps per answer | пауза; Шагов на ответ |
| `intent: ask / build / chat` | Ask / Build modes | режимы «Спросить» / «Строить» |
| `proposal`, `ghost` | draft, grey draft, suggestion | черновик, серый черновик, предложение |
| `revision` | version, a step of history | версия, шаг истории |
| `restore-revision` | Undo, Redo | Отменить, Повторить |
| `replay` | Replay history | Просмотр истории |
| `projection` | what the window shows of the graph | (not shown) |
| `command`, `actionId` | an edit | правка |
| `conflict` | "That edit was not applied" | «Изменение не применено» |
| `catalog`, `object_info`, `node_catalog` | the library, the node list | библиотека, список нод |
| `sync`, `enrichment` | Sync; reading model metadata | синхронизация; чтение метаданных моделей |
| `pack` | node pack | пак нод |
| `sidecar`, side file | the description and picture next to a model | описание и картинка рядом с моделью |
| `mature`, `marked` | marked as adult content | с пометкой «для взрослых» |
| `component` (`setComponentDocumentation`) | purpose and how to use a node | назначение и использование ноды |
| `process` (`setProcess`) | the title and notes of the graph | название и заметки графа |
| `explanation`, `provenance` | explanation and its source | объяснение и его источник |
| `description card`, `descriptions` mode | Description cards | Карточки-описания |
| `dock` | the right panel; View ▸ Tools panel | правая панель |
| `rail` | the library panel on the left | левая панель (библиотека) |
| `tour` | Graph ▸ Guided tour | «Граф ▸ Экскурсия по графу» |
| `native project`, `open-native` | project file, Open project | файл проекта, Открыть проект |
| `import-workflow`, `export` | Open workflow, Save workflow for ComfyUI | Открыть workflow, Сохранить workflow для ComfyUI |
| `exportGuard` | the check before saving a workflow | проверка перед сохранением |
| `secretGuard` | "N fields look like a key or token" | «N полей похожи на ключ или токен» |
| `modelTrace`, `modelLog` | the conversation log | журнал общения с моделью |
| `mcpAuth: none / token / oauth` | No sign-in / Access token / Sign in through the browser | Без входа / Токен доступа / Войти через браузер |
| `secret`, `safeStorage` | key, token; the system password store | ключ, токен; хранилище паролей |
| `userData` | the data folder | папка с данными |

The app's names: `DISPLAY_NAME` (what people read), `APP_ID` (user agents, the MCP client name) and
`STABLE_APP_NAME` (the package, the program, the profile folder and the password-store entry) in
`src/main/identity.ts`. `STABLE_APP_NAME` must never change once released: an update would open an empty profile and
could not decrypt saved keys.

## See also

- [For developers](README.md)
- [Glossary](../reference/Glossary.md)
- [Texts and languages](Texts-And-Languages.md)
