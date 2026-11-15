[English](Code-Words.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Слова кода и слова на экране

Код и экран иногда называют одно и то же разными словами. Этот список их сопоставляет, чтобы сообщение об ошибке
словами экрана можно было найти в коде.

| В коде | На экране (по-английски) | На экране (по-русски) |
| --- | --- | --- |
| `agent`, `helper`, `llm` | the assistant | помощник |
| `provider` | Provider | Кто отвечает |
| поставщик `test` | Test mode | проверочный режим |
| поставщик `local` | your own model | своя модель |
| `turn` | an answer | ответ |
| `run` (таблица `runs`) | работа помощника над одним ответом; Pause / Resume / Stop the assistant | «Приостановить», «Продолжить работу», «Остановить помощника» |
| `checkpoint`, `turn-paused`, `maxStepsPerTurn` | a pause at the step limit; Steps per answer | пауза на лимите шагов; «Шагов на ответ» |
| `intent: ask / build / chat` | Ask / Build | режимы «Спросить» / «Строить» |
| `proposal`, `ghost` | draft, suggestion | черновик, серый черновик, предложение |
| `revision` | version | версия, шаг истории |
| `restore-revision` | Undo, Redo | «Отменить», «Повторить» |
| `replay` | Replay history | «Просмотр истории» |
| `projection` | (не показывается) | то, что окно показывает из графа |
| `command`, `actionId` | an edit | правка |
| `conflict` | "That edit was not applied" | «Изменение не применено» |
| `catalog`, `object_info`, `node_catalog` | the library, the node list | библиотека, список нод |
| `sync`, `enrichment` | Sync; reading model metadata | синхронизация; чтение метаданных моделей |
| `pack` | node pack | пак нод |
| `sidecar`, файл рядом | the description and picture next to a model | описание и картинка рядом с моделью |
| `mature`, `marked` | marked as adult content | с пометкой «для взрослых» |
| `component` (`setComponentDocumentation`) | purpose and how to use | назначение и использование ноды |
| `process` (`setProcess`) | the title and notes of the graph | название и заметки графа |
| `explanation`, `provenance` | explanation and its source | объяснение и его источник |
| `description card`, режим `descriptions` | Description cards | «Карточки-описания» |
| `dock` | Tools panel | «Правая панель» |
| `rail` | the library on the left | левая панель (библиотека) |
| `tour` | Guided tour | «Экскурсия по графу» |
| `native project`, `open-native` | Open project | файл проекта, «Открыть проект» |
| `import-workflow`, `export` | Open workflow, Save workflow for ComfyUI | «Открыть workflow», «Сохранить workflow для ComfyUI» |
| `exportGuard` | the check before saving | проверка перед сохранением |
| `secretGuard` | "N fields look like a key or token" | «N полей похожи на ключ или токен» |
| `modelTrace`, `modelLog` | Conversation log | журнал общения с моделью |
| `mcpAuth: none / token / oauth` | No sign-in / Access token / Sign in through the browser | «Без входа» / «Токен доступа» / «Войти через браузер» |
| `secret`, `safeStorage` | key, token; password store | ключ, токен; хранилище паролей |
| `userData` | data folder | папка с данными |

Имена приложения: `DISPLAY_NAME` (что читают люди), `APP_ID` (user agent, имя клиента MCP) и `STABLE_APP_NAME`
(пакет, программа, папка профиля и запись в хранилище паролей) в `src/main/identity.ts`. `STABLE_APP_NAME` нельзя
менять после выпуска: обновление открыло бы пустой профиль и не расшифровало бы сохранённые ключи.

## См. также

- [Для разработчиков](README.ru.md)
- [Словарь](../reference/Glossary.ru.md)
- [Тексты и языки](Texts-And-Languages.ru.md)
