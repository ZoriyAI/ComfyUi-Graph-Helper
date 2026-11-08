# ComfyUI Graph Helper — бриф и контракты (2026-11-08)

Этот документ — источник истины для всех, кто доделывает приложение. Он фиксирует, что хочет владелец
продукта, принципы, целевую архитектуру и контракты между модулями. Код в `src/shared/contracts/` — машинная
часть этих контрактов; при расхождении правь и код, и этот файл.

## 1. Что это за приложение

**Умный хелпер для человека, который приходит в ComfyUI с нуля.** У него стоит ComfyUI с сотнями нод и
терабайтами моделей и LoRA, и он не понимает, что для чего и как это соединять. Приложение подключается к его
ComfyUI через MCP, забирает всё к себе в базу и дальше **показывает, как создавать, и объясняет почему** — на
живом графе, в диалоге, с анимацией.

Это **не** агент-исполнитель и **не** «создай мне workflow». Человек строит сам, зовёт помощника, когда застрял,
или просит показать пример. Помощник предлагает из того, что реально есть у человека, ставит на поле серые
заготовки, по просьбе строит вживую, отвечает на вопрос про любой вход, выход, ноду или связь одним кликом.
В конце человек экспортирует чистый workflow JSON в ComfyUI и понимает, что он экспортировал.

Пример сценария. «Хочу три связанных субграфа, которые делают то-то.» — «У тебя есть то-то и то-то, можно так,
а можно так.» — «Покажи пример.» Субграфы появляются на поле анимированно. «А это что? А это зачем? А как
это подключить?» — ответы по конкретному объекту, правки, достройка. Экспорт. Результат в ComfyUI.

## 2. Принципы (не обсуждаются)

1. **ComfyUI не трогаем.** Поток данных односторонний: ComfyUI → приложение. Через MCP используются только
   read-only инструменты. Никаких установок нод, скачиваний моделей, удалений, записи метаданных, постановки
   промптов в очередь. Если ноды нет — помощник говорит, как она называется, ставит её человек сам.
2. **Хелпер, не исполнитель.** Любое предложение помощника появляется **призраком** (серая нода, пунктирная связь)
   и не попадает в граф, пока человек не принял. Принять можно поштучно или «принять всё». Прямое построение —
   только когда человек явно попросил «сделай/построй/покажи пример».
3. **Факт, догадка, интернет, человек.** Каждое объяснение помечено источником: `fact` (object_info, манифест,
   метаданные файла), `inference` (вывод модели по имени и контексту), `web` (найдено в интернете, со ссылкой),
   `user` (записал человек). Пометка видна в интерфейсе.
4. **Объяснения живут в проекте, не в чате.** Спросил про порт — ответ записался к этому объекту и виден в
   инспекторе потом. Чат уходит, знание остаётся. Объяснение привязано к ревизии графа; устаревшее помечается.
5. **Анимация = реальные события.** Нода появляется с движением, потому что коммит применился. Никаких
   постановочных сборок заранее, fake typing, растягивания. Политика motion (system/on/reduced/off) соблюдается
   везде; при reduced/off вся информация доступна статично.
6. **Совместимость — первый класс.** Для каждой модели и LoRA известна базовая семья (SDXL, Flux, Qwen, WAN,
   LTX, Z-Image, Krea…). Помощник предупреждает до постановки ноды, проверка перед экспортом подсвечивает.
7. **Два формата.** Внутренний проект хранит всё: граф, субграфы, объяснения, предложения, процесс, историю.
   В ComfyUI уходит только нативный workflow JSON (UI формат 1, subgraph definitions по схеме фронтенда).
8. **Тема контента не влияет** на объяснение механики. Приложение ничего не генерирует.
9. **Секреты** никогда не пишутся в SQLite в открытом виде, не логируются, не попадают в промпт, экспорт и ошибки.
10. **Package-first.** Готовые поддерживаемые пакеты; свой код только для интеграции и уникального поведения.

## 3. Что уже есть в коде

- Electron 45, React 18, React Flow 12, Zustand, better-sqlite3, Vercel AI SDK 7, Radix, motion 14, i18next (ru/en).
- Движок команд в main: `src/main/commands/commit.ts` — коммит мутаций с ревизиями, конфликтами, run с
  pause/cancel/resume. Мутации описаны в `src/shared/commands/types.ts`. Проекция читается рендерером.
- Канвас React Flow (`src/renderer/components/graph/`), инспектор с полями purpose/usage (component records).
- Импорт/экспорт нативного workflow JSON (`src/shared/workflow/codec.ts`), subgraph definitions сохраняются
  при импорте как сырой документ, но в канвасе не создаются и не редактируются.
- Чат на AI SDK (`src/main/llmService.ts`, `src/renderer/services/llm/chatService.ts`). Инструменты агента:
  addNode, annotateNode, setComponentDocumentation, setProcess (`src/shared/commands/tools.ts`). connect и
  прочие не замаплены. Провайдеры: openai, local (OpenAI-совместимый), test.
- Каталог в SQLite: `node_catalog`, `model_catalog` (`src/main/catalog/repository.ts`); чтение из object_info
  по HTTP, из файла и через MCP (`src/main/mcp/client.ts`). Поле `mcpUrl` в настройках, токен в памяти.
- Настройки (Radix Dialog/Tabs/Select), тёмная графитовая тема, токены (`src/renderer/theme/tokens.css`),
  motion policy (`src/renderer/motion/policy.ts`).
- Нативный формат проекта `comfy-graph-helper-project` v1 (`src/shared/native-project.ts`).
- Тесты: vitest (unit + integration, `npm test`), Playwright e2e под Xvfb (`tests/e2e`).

## 4. Факты про MCP-сервер владельца (проверено 2026-11-08)

- Публичный адрес `https://llm.propriq.io/home_comfyui/mcp`, Streamable HTTP, протокол 2025-11-25.
  Без токена отвечает 401 с `WWW-Authenticate: Bearer resource_metadata=…` (OAuth protected resource).
  Приложение шлёт `Authorization: Bearer <token>`; токен держится только в памяти процесса.
- Нативный ComfyUI на той же машине: `studio_info describe` → `comfyui_url: http://127.0.0.1:28188`.
- `studio_capabilities {section:'nodes', kind:'classes', limit≤100, cursor}` → 3272 класса:
  `{class_type, module, display_name, category, external_api, import_state}`. Входов/выходов нет.
- `studio_capabilities {section:'nodes', kind:'packs'}` → 74 пака: `{name, installed_state, import_state,
  version, commit, imported_class_count}`.
- `studio_capabilities {section:'models'}` → категории с `root_count`. `models {action:'list', category?, limit,
  cursor}` → файлы `{category, filename, root_path, size_bytes, status}` (включая мусор `.cache/…`, фильтруем по
  расширению и dotfiles). Несколько корней на категорию → `inspect` по `filename` даёт
  `ADMIN_MODEL_ROOT_AMBIGUOUS`; надо передавать `location: {absolute_path}` = `root_path + '/' + filename`.
- `models {action:'inspect', location}` → `{size_bytes, format, sha256|null, source, compatibility:'unknown'}`.
- `model_metadata {action:'read', category, name}` (read-only) → `embedded_metadata` safetensors-заголовка:
  `ss_base_model_version` ('zimage', 'sdxl_base_v1-0', …), `ss_tag_frequency`, `modelspec.*`, `ss_output_name`,
  software; `civitai_sidecar` (trainedWords, baseModel, description, modelId) если есть. Optional node
  `comfyui-model-explorer` у владельца не установлен → ответ `model_explorer: 'unavailable'` с локальными данными.
  `fetch_civitai` read-only, но ходит в интернет; `propose` — НЕ использовать (запись).
- `comfy_api GET /object_info` отвергается (`COMFY_API_BODY_CAPACITY`) даже для одного класса. Полный object_info
  читаем напрямую GET с `comfyui_url` (приложение работает на той же машине). Это уже реализовано как fallback.
- `list_local_models {action:'list', model_type?}` → markdown по категориям, только loader-категории.
- Запрещённые к использованию инструменты (пишут или запускают): install_custom_node, download_model,
  nodepacks install/update/remove, models download/move/remove, model_metadata propose, workflow_run,
  enqueue_workflow, comfy_api POST /prompt, restart_comfyui, clear_vram, любые *_import_*, stage_file.

## 5. Целевая архитектура

```
main/
  mcp/            подключение, чтение каталога, планировщик синхронизации, обогащение метаданными
  catalog/        SQLite-репозиторий нод, паков, моделей
  knowledge/      объяснения (explanations), проверка графа (check), поиск по каталогу
  commands/       движок команд, ревизии, run; новые мутации субграфов и групп
  proposals/      призрачные предложения: создать, принять (→ commitCommand), отклонить
  agent/          инструменты агента (main-side), системный промпт, поиск в интернете, чтение страниц
  llmService.ts   провайдеры: anthropic, google, openai, local(OpenAI-совместимый, Ollama)
  ipc/            регистрация IPC-обработчиков по доменам (knowledgeIpc, engineIpc, agentIpc)
shared/
  contracts/      типы IPC и предметной области — ЕДИНСТВЕННЫЙ источник типов между main и renderer
  commands/       схема мутаций, маппинг инструментов агента → мутации
  workflow/       кодек нативного JSON (импорт/экспорт, subgraph definitions)
  catalog/, knowledge/  парсеры, вывод семьи базовой модели, типы портов
  agent/          построение контекста для модели (без секретов)
renderer/
  ui/             дизайн-система: примитивы на Radix + motion, CSS Modules на компонент
  components/shell|library|graph|chat|explain|proposals|settings|sync
  state/          Zustand-сторы
  services/       проекция команд, chatService
```

## 6. Контракты

### 6.1 База данных: миграция v9 (уже в коде, `src/main/settings/migrate.ts`)

- `model_catalog` + `kind TEXT`, `base_model TEXT`, `base_model_evidence TEXT`, `trigger_words TEXT` (JSON
  массив), `description TEXT`, `source_url TEXT`, `metadata_json TEXT`, `root_path TEXT`, `sha256 TEXT`,
  `synced_at INTEGER`, `enriched_at INTEGER`.
- `node_catalog` + `description TEXT`, `pack_name TEXT`, `output_node INTEGER`, `synced_at INTEGER`.
- `node_packs (name PK, version, commit_sha, installed_state, import_state, class_count, synced_at)`.
- `explanations (id PK, project_id NULL, owner_kind, owner_id, aspect, text, provenance, source_url, revision_id,
  created_by, created_at)`; индекс по (owner_kind, owner_id).
- `proposals (id PK, project_id, run_id, kind, status, payload TEXT JSON, note, revision_id, created_at,
  resolved_at)`; индекс по (project_id, status).
- `sync_state (key PK, value TEXT)`: `last_sync_at`, `last_error`, `auto_enabled`, `auto_interval_minutes`,
  `server_identity`.
- `chat_messages` уже есть (id, project_id, role, content, timestamp, graph_revision_id, tool_calls).

### 6.2 Типы и IPC — `src/shared/contracts/*.ts`

Все payload-типы IPC лежат там. Каналы — в `src/shared/ipc-channels.ts` (и зеркало в `src/preload/index.ts`,
preload не может импортировать). Обработчики регистрируются в `src/main/ipc/*Ipc.ts`.

| Канал | Вход → Выход | Реализует |
|---|---|---|
| `knowledge:search-nodes` | `{query, category?, limit?}` → `NodeClassSummary[]` | KB |
| `knowledge:node-detail` | `classType` → `NodeClassDetail \| null` | KB |
| `knowledge:search-models` | `{query, directory?, baseModel?, kind?, limit?}` → `ModelSummary[]` | KB |
| `knowledge:model-detail` | `{directory, name}` → `ModelDetail \| null` | KB |
| `knowledge:list-explanations` | `{projectId?, owner?: ObjectRef}` → `Explanation[]` | KB |
| `knowledge:save-explanation` | `ExplanationInput` → `Explanation` | KB |
| `knowledge:check-graph` | `projectId` → `GraphCheckReport` | KB |
| `sync:status` | → `SyncStatus` | KB |
| `sync:now` | → `SyncStatus` | KB |
| `sync:set-auto` | `{enabled, intervalMinutes}` → `SyncStatus` | KB |
| `sync:event` (push main→renderer) | `SyncStatus` | KB |
| `proposals:list` | `projectId` → `Proposal[]` | Engine |
| `proposals:resolve` | `{projectId, proposalId, decision}` → `ProposalResolution` | Engine |
| `proposals:event` (push) | `Proposal[]` текущего проекта | Engine |
| `command:*` (есть) | новые мутации в payload | Engine |
| `llm:stream-chat` (есть) | + 5-й аргумент `AgentTurnContext` | Agent |
| `chat:load-history`, `chat:save-message` | `projectId` → `ChatRecord[]`; `ChatRecord` → `{ok}` | Agent |
| `mcp:read`, `mcp:set-token`, `mcp:token-status` (есть) | | KB |

### 6.3 Мутации графа (Engine добавляет в `mutationSchema`)

Существующие: add-node, annotate-node, remove-node, move-node, connect, remove-edge, import-workflow,
set-parameter, retarget-edge, set-component, set-process, open-native.

Новые:
- `create-subgraph {name, nodeIds[], inputs: SubgraphIO[], outputs: SubgraphIO[]}` — выделенные ноды уходят в
  новое subgraph definition (uuid), на их месте один instance node; внешние связи переподключаются через IO.
- `insert-subgraph {definitionId, x, y, title?}` — новый instance существующего definition.
- `add-subgraph-io {definitionId, direction, name, type, nodeId, handle}`, `remove-subgraph-io`, `rename-subgraph`.
- `dissolve-subgraph {nodeId}` — обратно в ноды (ungroup).
- `add-group {title, nodeIds[], color?}`, `remove-group {groupId}`.
- `accept-proposal` — НЕ мутация. Принятие проходит через `proposals:resolve`, которое коммитит payload
  предложения как обычную мутацию с `actor:'manual'`, `actionId: 'proposal-<id>'`.

Экспорт: subgraph definitions в `definitions.subgraphs[]` по схеме ComfyUI_frontend (id uuid, name, inputs,
outputs, nodes, links, widgets); instance node с `type = definition.id`. Проверять против фикстур
`tests/e2e/fixtures` и официальной схемы; не заявлять совместимость, которая не проверена тестом.

### 6.4 Предложения (призраки)

`Proposal {id, projectId, runId|null, kind: 'add-node'|'connect'|'set-parameter'|'create-subgraph'|
'insert-subgraph'|'remove-node', status: 'proposed'|'accepted'|'rejected'|'superseded', payload: GraphMutation,
note, revisionId, createdAt, resolvedAt}`. Канвас рисует `proposed` как призраки. Принятие коммитит;
если ревизия ушла и коммит конфликтует — статус `superseded`, человеку показывается почему.

### 6.5 Инструменты агента (имена фиксированы, `src/shared/contracts/agentTools.ts`)

Чтение: `searchNodeTypes`, `describeNodeType`, `findInstalledModels`, `describeModel`, `checkGraph`,
`searchWeb`, `fetchPage`, `getGraph`.
Знание: `explain` (сохраняет Explanation с provenance).
Предложения: `proposeNode`, `proposeConnection`, `proposeParameter`, `proposeSubgraph`.
Прямое построение (только по явной просьбе): `addNode`, `connectNodes`, `setParameter`, `removeNode`,
`createSubgraph`, `insertSubgraph`, `annotateNode`, `setComponentDocumentation`, `setProcess`.

Инструменты графа маппятся через `mutationFromTool` (Engine). Инструменты чтения и знаний выполняются в main
(Agent) через функции `src/main/knowledge/repository.ts` (KB) и `src/main/proposals/repository.ts` (Engine).
Поиск в интернете: нативный инструмент провайдера, если есть (OpenAI webSearch, Anthropic webSearch,
Google googleSearch), иначе простой поиск из main; `fetchPage` — GET с лимитом размера и времени, только http(s).

### 6.6 Контекст хода (`AgentTurnContext`)

Рендерер передаёт `{objectRef?, selection: ObjectRef[], viewport?, intent: 'ask'|'build'|'chat'}`.
Main строит системный промпт: роль учителя, принципы 2.2–2.3, сводка каталога (сколько классов, какие
семьи моделей и сколько LoRA под каждую), текущий граф (без значений виджетов, чтобы не утекли секреты),
выделение и объект вопроса, доступные инструменты и когда предлагать, а когда строить.

## 7. Рабочие потоки и владение файлами

Фаза 1 (параллельно, отдельные worktree и ветки):

| Поток | Владеет | Не трогает |
|---|---|---|
| **KB** (знания и синхронизация) | `src/shared/catalog/**`, `src/shared/knowledge/**`, `src/shared/graph/compatibility.ts`, `src/main/catalog/**`, `src/main/mcp/**`, `src/main/knowledge/**`, `src/main/ipc/knowledgeIpc.ts`, тесты knowledge/mcp/objectInfo, i18n-пространства `knowledge`, `sync`, `check` | commands, llm, renderer |
| **Engine** (граф, субграфы, предложения) | `src/shared/commands/**`, `src/shared/workflow/**`, `src/shared/components/**`, `src/shared/native-project.ts`, `src/shared/graph/ports.ts`, `linkTypes.ts`, `src/main/commands/**`, `src/main/proposals/**`, `src/main/ipc/engineIpc.ts`, тесты команд/кодека/компонентов, i18n `proposals` | catalog, mcp, llm, renderer |
| **Agent** (модель, инструменты, промпт) | `src/main/llmService.ts`, `src/main/agent/**`, `src/main/testLLMTransport.ts`, `src/main/ipc/agentIpc.ts` (сюда переезжает обработчик `llm:stream-chat` из `ipc.ts`), `src/shared/agent/**`, `src/shared/config/schema.ts` (только enum провайдеров), тесты llm/agent, i18n `agent` и ключи `provider.*` | catalog, commands, codec, renderer |

Общие файлы, которые можно править только добавлением строк в своём блоке: `src/shared/ipc-channels.ts`,
`src/preload/index.ts`, `src/shared/i18n/catalog.ts` (своё пространство), `src/main/ipc.ts` (только вызов
своего `register*Ipc`), `src/shared/contracts/*.ts` (расширять, не ломать существующие поля).

Фаза 2 (после слияния фазы 1): **Shell** (дизайн-система `src/renderer/ui/**`, токены, `App.tsx`, раскладка,
библиотека нод и моделей, настройки, строка состояния, индикатор синхронизации), **Canvas**
(`components/graph/**`: ноды с глубиной и цветными портами, слой призраков, анимация появления и прорисовки
связей, контекстное меню, субграфы, подсветка объяснений), **Chat/Explain** (`components/chat/**`,
`components/explain/**`, `components/proposals/**`, `services/llm/chatService.ts`, вопрос по объекту,
бейджи источника, панель проверки перед экспортом, принятие предложений).

## 8. Правила для всех

- `npm run type-check` и `npm test` зелёные перед коммитом. Новое поведение — с тестом. E2E не ломать.
- Коммиты на своей ветке, без push, без имён моделей в сообщениях. Небольшие коммиты с ясными сообщениями.
- i18n: каждый ключ и в `en`, и в `ru`. Тест `locale.test.ts` проверяет паритет.
- Никаких сетевых вызовов в unit-тестах к реальным серверам: фикстуры, локальный http.Server, фейковая сессия.
- Секреты: не логировать, не возвращать в renderer, не писать в SQLite без доказанного OS-шифрования.
- Не менять версии зависимостей без необходимости; новая зависимость — только проверенная лицензия
  (MIT/Apache-2.0/OFL) и фиксированная версия в lock.
- Стиль кода как в репозитории: строгий TS, zod на границах, маленькие функции, комментарии о «почему».
- Интерфейс: тёмная цветная «ночная» тема, глубина (слои, тени, свечение портов), motion design через
  токены и `motion`, CSS Modules на компонент (`Component.module.css`), Radix для доступности.
  Ничего плоского и «веб-страничного»: это десктоп-инструмент.
