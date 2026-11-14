# Разработка

Документы для тех, кто меняет код. Что приложение делает для человека, написано в [`README.md`](../README.md) и в
руководстве [`docs/user/guide.ru.md`](user/guide.ru.md).

- Дизайн-система: [`docs/DESIGN.md`](DESIGN.md), [`src/renderer/ui/README.md`](../src/renderer/ui/README.md)

## Как это устроено

Как добавить свой урок: шаги описаны в `src/shared/lessons/lessons.ts` как то, что должно быть на холсте
(ноды, связи, значения полей), слова в `texts.ru.ts` и `texts.en.ts`. Тест `tests/unit/lessons.test.ts` проходит
каждый урок от пустого холста до конца теми действиями, которые урок сам подсказывает.

## Как это устроено

| Слой | Что делает | Где |
|---|---|---|
| Синхронизация | Прямое HTTP-чтение ComfyUI и необязательный MCP-клиент (Streamable HTTP), планировщик, метаданные safetensors и sidecar | `src/main/comfy/`, `src/main/mcp/` |
| Знания | каталог узлов и моделей, вывод семьи базовой модели и вида модели, объяснения с источником, проверка графа перед экспортом | `src/main/knowledge/`, `src/shared/knowledge/` |
| Движок графа | команды с ревизиями и конфликтами, run с паузой и отменой, субграфы и группы, призрачные предложения, история ревизий | `src/main/commands/`, `src/main/proposals/`, `src/shared/commands/` |
| Кодек | импорт и экспорт нативного workflow JSON, subgraph definitions без потерь | `src/shared/workflow/` |
| Агент | Vercel AI SDK: Anthropic, Google, OpenAI, локальный OpenAI-совместимый сервер (Ollama); инструменты чтения каталога, поиска в интернете, объяснений и предложений; обучающий системный промпт | `src/main/agent/`, `src/main/llmService.ts` |
| Интерфейс | React 18, React Flow 12, Radix, motion, CSS Modules: оболочка и библиотека, канвас с призраками и объясняющей анимацией, чат с карточками инструментов, панели объяснений и проверки | `src/renderer/` |
| Контракты | типы IPC и предметной области, общие для main и renderer | `src/shared/contracts/` |

База: SQLite (`better-sqlite3`), схема версионируется миграциями в `src/main/settings/migrate.ts`.

Каталог публикуется одной синхронной транзакцией после сетевого чтения. Адрес источника берётся из текущего
соединения; ключ источника в `sync_state` — SHA-256, чтобы не сохранять в нём query-параметры MCP-адреса.
При смене источника (и при первом чтении старого каталога без такого ключа) каталог узлов, пакетов и моделей
заполняется заново. Проекты, графы и пользовательские объяснения остаются. Ошибка отдельной папки сохраняет
её прежние факты только для того же источника; новый источник может дать свежие имена из `object_info`.

Известное изменение размера или корневой папки модели сбрасывает её метаданные, hash, web-факты и preview.
Замена файла с тем же именем, размером и путём без fingerprint не обнаруживается надёжно. При доступном
metadata-tool заголовки `.safetensors`/`.sft` перечитываются после 24 часов на следующей синхронизации;
это обновляет доступные метаданные, но не вычисляет SHA-256 больших файлов. Свежие неизменные файлы
используют кеш. `SyncStatus.catalogRevision` меняется после принятой публикации, обновления фактов и импорта
`object_info`; renderer получает её через существующий `sync:event`.

## Команды

Node 22 (`.nvmrc`), Linux x64.

```bash
npm ci
npm test              # vitest: unit и integration
npm run type-check    # main и renderer
npm run build         # dist/main, dist/renderer, dist/notices, dist/help
npm run dev           # Vite + Electron
npm start             # собрать и запустить
xvfb-run -a npx playwright test --trace off --grep-invert "live-local|layout-walk"   # e2e на Electron (Linux без дисплея)
xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off  # обход всех экранов, отдельно
npm run package:linux # Linux-пакеты через Electron Forge, portable builder и smoke-проверки
```

`better-sqlite3` 13 загружает готовый модуль N-API (`prebuilds/linux-x64.node`) и в Node, и в Electron, поэтому
пересобирать его под Electron не нужно: unit-тесты и приложение работают с одним `node_modules`.

Две проверки смотрят на приложение глазами человека и входят в обычный набор тестов:

- `tests/unit/i18nUsage.test.ts` находит каждое место, где текст собирается из шаблона, и проверяет, что шаблон
  получает свои значения. Текст вида `{{done}} / {{total}}` на экран не попадёт.
- `tests/e2e/layout-walk.test.ts` проходит все экраны собранного приложения при разных размерах окна и ищет то,
  что вылезло из своего блока, обрезано, ушло за край окна, наехало на соседа или сжато до нечитаемого, а также
  читает каждый текст и подсказку: нет ли незаполненной вставки, «undefined» или ключа вместо слов. Обход
  запускается отдельно от остальных сквозных тестов: он подолгу держит открытыми меню и списки, а второе окно
  приложения, забрав фокус, закрыло бы их. `tests/e2e/layout-audit.test.ts` проверяет саму проверку на заведомо
  сломанной и на исправной вёрстке. Обход проверяет и привязку: карточка-описание стоит у своей ноды и имеет её
  ширину при любом масштабе холста, панели холста ничем не закрыты, ни одна нода не лежит на другой.
- `tests/e2e/node-size.test.ts` рисует каждую ноду каталога и сравнивает высоту, которую приложение рассчитало
  заранее, с нарисованной. По этой высоте выбирается место для новой ноды; если расчёт меньше, нода встаёт на
  соседнюю.

Полный прогон на всех размерах и втором языке, и прогоны под настоящий рабочий стол:

```bash
LAYOUT_FULL=1 xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off
LAYOUT_FULL=1 LAYOUT_LANG=en xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off
# LAYOUT_OUT=<папка> сохранит отчёт и снимки, LAYOUT_ONLY=canvas,helper пройдёт только названные части
LAYOUT_TEXT=wide xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off    # текст шире на 4 %
LAYOUT_FONTS=hinted xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off # шрифты с хинтингом
LAYOUT_DPR=1.5 xvfb-run -a npx playwright test tests/e2e/layout-walk.test.ts --trace off      # масштаб экрана 150 %
```

## Свой урок

Шаги описаны в `src/shared/lessons/lessons.ts` как то, что должно быть на холсте (ноды, связи, значения полей),
слова в `texts.ru.ts` и `texts.en.ts`. Тест `tests/unit/lessons.test.ts` проходит каждый урок от пустого холста до
конца теми действиями, которые урок сам подсказывает.

## Сборка пакета

`npm run package:linux` собирает `dist/`, делает `.deb` и, при наличии `rpmbuild`, `.rpm` через Electron Forge
(`forge.config.js`), затем переносимый `.tar.gz` с `install.sh` и AppImage через `scripts/make-linux-portable.js`.
Для `.deb` нужны `dpkg` и `fakeroot`; AppImage требует `mksquashfs` и `APPIMAGE_RUNTIME`. Без них локальная
сборка может пропустить AppImage; в release workflow он обязателен (`REQUIRE_APPIMAGE=1`). После сборки идут
`scripts/smoke-linux-package.js` и `scripts/smoke-linux-portable.js`. Наличие сборщика в исходниках не
подтверждает наличие формата в опубликованном выпуске.

- В пакет попадает только то, что работает: `dist/`, `node_modules` основного процесса, `package.json` и
  `resources/icon.png`. Библиотеки интерфейса (React, Radix, React Flow, lucide, motion) лежат в
  `devDependencies`: Vite уже собрал их в `dist/renderer`.
- `scripts/build-assets.js` (часть `npm run build`) пишет `dist/notices` (лицензия приложения и лицензии всех
  пакетов, которые идут вместе с ним) и `dist/help` (руководство, решение проблем, заметки текущего выпуска).
- Файл `copyright` в пакете: лицензия приложения и затем эти лицензии.
- Значки от 16 до 512 px в `resources/icons/` делает `scripts/make-icon.js`; ярлык `resources/linux/desktop.ejs`.

### Имена

- Человек видит «Graph Helper for ComfyUI»: окно, ярлык, диалоги, страница входа на сервере.
- Машины видят `comfyui-graph-builder`: пакет, программа, ярлык `comfyui-graph-builder.desktop`, класс окна,
  папка профиля `~/.config/comfyui-graph-builder` и запись в хранилище паролей. **Это имя не меняется никогда**:
  иначе обновление откроет пустой профиль и не расшифрует сохранённые ключи. Подробности в `src/main/identity.ts`.
- Не переименовывать также: `comfyui-desktop.db`, формат проекта `comfy-graph-helper-project`, `.graph-helper.json`.

## Служебные скрипты

- `scripts/electron-sqlite-probe.js`, `scripts/prove-os-secret.js`, `scripts/report-secret-runtime.js`: ручные
  проверки SQLite и хранилища паролей на настоящем рабочем столе (`npx electron scripts/<файл>` после `npm run build`).
- `scripts/capture-screens/capture.js` (`npm run shots -- <папка>`): снимки экранов собранного приложения.
- `scripts/changelog.js`: собирает `CHANGELOG.md` из `docs/releases/*.md`.

## Выпуск

1. `docs/releases/vX.Y.Z.md`: заметки к выпуску; `node scripts/changelog.js` обновляет `CHANGELOG.md`.
2. `npm version X.Y.Z --no-git-tag-version`.
3. Всё зелёное на коммите: тесты, обход экранов, пакет, проверка установленного пакета и обновления.
4. GitHub Actions ▸ Build and package ▸ Run workflow с `release_tag: vX.Y.Z`. Шаг выпуска сверяет тег с версией
   и наличием заметок, публикует только после UI/package/upgrade-проверок `.deb`, `.rpm`, AppImage, `.tar.gz`, SBOM и `SHA256SUMS`.
