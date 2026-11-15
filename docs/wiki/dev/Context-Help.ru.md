[English](Context-Help.md)
[Главная](../Home.ru.md) › [Для разработчиков](README.ru.md)

# Ссылки на справку из приложения

Сообщение, подсказка или пункт меню в приложении могут открыть страницу этой вики в окне справки. Они делают это по
постоянному **идентификатору**, а не по имени файла: когда страница переезжает, меняется только одна таблица.

## Таблица

`HELP_IDS` в `src/shared/help/contextHelp.ts` сопоставляет каждому идентификатору страницу в виде
`папка/Имя-Страницы` (без языка и расширения). Окно справки открывает `docs/wiki/<страница>.md` или
`<страница>.ru.md`, если интерфейс на русском.

| Идентификатор | Страница |
| --- | --- |
| `home` | `Home` |
| `quick-start` | `start/Quick-Start` |
| `installing` | `start/Installing` |
| `faq` | `start/FAQ` |
| `connecting` | `connect/Connecting` |
| `connection-problems` | `connect/Connection-Problems` |
| `running-in-comfyui` | `graph/Running-In-ComfyUI` |
| `comfyui-errors` | `graph/ComfyUI-Errors` |
| `history-and-undo` | `graph/History-And-Undo` |
| `checking-a-graph` | `graph/Checking-A-Graph` |
| `choosing-who-answers` | `assistant/Choosing-Who-Answers` |
| `context-window` | `assistant/Context-Window` |
| `what-is-sent` | `assistant/What-Is-Sent` |
| `lessons` | `lessons/README` |
| `glossary` | `reference/Glossary` |
| `troubleshooting` | `reference/Troubleshooting` |
| `messages` | `reference/Messages` |
| `shortcuts` | `reference/Shortcuts` |
| `data-folder` | `reference/Data-Folder` |
| `known-limits` | `reference/Known-Limits` |
| `privacy` | `trust/Privacy` |
| `security` | `trust/Security` |
| `licence` | `trust/Licence` |

«Справка ▸ Что нового» это не страница вики: она открывает `@whats-new`, заметки к работающей версии из
`docs/releases/`.

## Как связать новое место приложения

1. Добавьте идентификатор в `HELP_IDS`: слова строчными буквами через дефис, указывающие на существующую страницу.
2. В renderer вызовите `openHelp('<id>')` из `src/renderer/services/help.ts`, например из кнопки в сообщении или
   команды меню.
3. Запустите `npx vitest run tests/unit/aboutHelp.test.ts`: он падает, если идентификатор указывает на страницу,
   которой нет на обоих языках.

## Как перенести или переименовать страницу

1. Перенесите оба языковых файла и исправьте ссылки на них (`tests/unit/wiki.test.ts` перечислит сломанные).
2. Поменяйте страницу в `HELP_IDS` у каждого идентификатора, который на неё указывал. Код приложения не меняется.

## Как окно справки находит страницы

`npm run build` копирует `docs/wiki` в `dist/help/wiki` и пишет рядом два файла (`scripts/build-assets.js`):
`wiki-index.json` (папки и их страницы в порядке оглавлений, с названиями на обоих языках) и `wiki-search.json`
(простой текст каждой страницы для поиска). Main отдаёт их по `help:tree`, `help:page` и `help:search`
(`src/main/ipc/aboutIpc.ts`). Относительные ссылки между страницами работают в окне справки; ссылка за пределы вики
(на файл репозитория, например `LICENSE`) там не открывается.

## См. также

- [Для разработчиков](README.ru.md)
- [Как писать страницы справки](Wiki-Style.ru.md)
- [IPC между окном и main](IPC.ru.md)
