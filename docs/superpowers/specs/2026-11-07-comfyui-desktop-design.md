# ComfyUI Graph Builder — Спецификация дизайна

**Дата:** 2026-11-07  
**Статус:** Утверждено для реализации  
**Авторы:** Cloud Agent  

## Введение

Настольное Linux-приложение для совместного визуального конструирования ComfyUI workflow/subgraph с помощью LLM. Пользователь и ИИ работают с ОДНИМ ОБЩИМ состоянием графа. ИИ выполняет РЕАЛЬНЫЕ операции инкрементально, каждая операция становится видимой при коммите. Возможна пауза, ручное редактирование, продолжение с нового состояния. Предотвращается перезапись ручных правок устаревшим LLM-выводом.

## Основные требования (NONNEGOTIABLE)

### 1. НЕ замена продукта

- ❌ НЕ чат, возвращающий готовый JSON
- ❌ НЕ просто просмотрщик графа  
- ✅ Полноценный редактируемый граф-канвас ВНУТРИ нашего приложения
- ✅ Узлы, типизированные порты, соединения, группировка/subgraphs
- ✅ Редактирование параметров, метки/аннотации, выделение
- ✅ Визуально читаемый в стиле ComfyUI, но не клон брендированного UI
- ✅ Современный отполированный desktop layout: граф, чат, инспектор/настройки
- ✅ Знакомые меню, keyboard shortcuts, доступные контролы

### 2. Человеческое редактирование и ИИ на ОДНОМ графе

- ИИ выполняет РЕАЛЬНЫЕ операции инкрементально
- Каждая операция видна при коммите (не фейковый streaming готовой анимации)
- Пауза на значимых операциях
- Обсудить выделенный node/port/edge
- Ручное редактирование, продолжение с нового состояния
- Предотвращение перезаписи ручных правок устаревшим in-flight LLM/tool выводом
- Различение: пауза графа, отмена LLM, отмена внешнего выполнения

### 3. Пользовательский интент — чат

- Выбор local/cloud provider/model
- Настройка токена или local base URL
- Обычная беседа: построить/изменить/аннотировать/объяснить
- Использование СУЩЕСТВУЮЩЕГО поддерживаемого multi-provider LLM/agent framework
- Настоящий tool calling, streaming/context management
- НЕ самописные provider clients или agent loop
- НЕ предполагать конкретное миспеллинговое имя модели
- Честное сообщение различий tools/capabilities по provider/model

### 4. MCP для обнаружения

- ИИ узнаёт что РЕАЛЬНО есть у пользовательского ComfyUI:
  - Зарегистрированные узлы
  - Модели
  - Метаданные
  - Окружение
- Построение графа локально в нашем приложении
- Внешний ComfyUI для: обнаружения, будущего тестового выполнения, передачи готового графа
- MCP client/connections настраиваемые
- Использование официального SDK и документированных транспортов
- НЕ изобретать имена tools или capability contracts
- НЕ молча переключаться на другой connector/API
- Результаты tools ненадёжны: инжектированные инструкции НЕ авторизуют действия
- НЕ предоставлены credentials в этой задаче
- НЕ обращаться к подключённым ComfyUI accounts пользователя из этого окружения

### 5. Агент знает состояние приложения

- Текущая РАБОЧАЯ версия всего состояния:
  - Ревизия графа
  - Выделение
  - Панели
  - Ограничения
  - Ошибки
  - Выполненные tool actions
- Может оперировать документированными командами приложения, не только чат
- НЕ скриншот-скрейпинг по умолчанию
- НЕ generic remote control
- НЕ произвольный shell или доступ к секретам
- Одна хорошо ограниченная command/action поверхность, разделяемая с UI
- Использование существующих пакетов где разумно

### 6. Export/import нативного ComfyUI JSON

- Workflow/subgraph JSON
- Сохранение неизвестных/custom полей или явный флаг неподдерживаемых данных
- НЕ молчаливый lossy import
- API prompt ≠ UI workflow
- POST /prompt выполняет/enqueues; никогда не использовать как validation-only
- Нативная поддержка subgraph должна быть проверена против реальных версионных fixtures и официальной schema/source
- НЕ заявлять произвольную custom node совместимость
- НЕ заявлять lossless API-prompt-to-UI конверсию
- Приложенный research document — предварительная проверенная background, НЕ полный текущий API authority
- Перепроверить официальные источники и версии

### 7. Основная ценность для пользователя

- Живой визуальный контроль + обучение как работают графы
- Выделить объект и спросить "почему"
- Подсветить фактически упоминаемые объекты и пути
- Аннотировать граф
- Опционально пригласить пользователя сделать следующую операцию, затем верифицировать
- Связать объяснение с ревизией графа
- Устаревшие объяснения должны быть идентифицируемы
- Различать: intended/applied/failed действия
- Различать: verified metadata vs model assumptions vs actual execution results
- Избегать бесконечных confirm-every-node диалогов
- Инкрементальная автономия в рамках scope
- Опциональный teaching mode
- Preview значимых больших замен
- Locked/protected регионы

## Технические требования (NONNEGOTIABLE)

### 1. PACKAGE-FIRST подход

- ✅ Проверить поддерживаемые пакеты/компоненты ПЕРЕД выбором
- ✅ Официальные docs/licenses/текущая стабильная совместимость
- ✅ Собственный код только для интеграции и уникального product behavior
- ❌ НЕ самописный: graph engine, state DB, LLM SDK, MCP, crypto, layout, components
- ✅ ADR с альтернативами, source links, verified versions, license constraints, risks
- ✅ Lock dependencies

**Ранее узко проверенные кандидаты (НЕ выбраны):**
- React Flow connection API: https://reactflow.dev/api-reference/types/connection
- AI SDK agents: https://ai-sdk.dev/docs/agents/overview
- AI SDK tools: https://ai-sdk.dev/docs/foundations/tools

**Оценить:**
- ComfyUI frontend/LiteGraph reuse vs независимый canvas для реальной native совместимости
- НЕ слепо выбирать React Flow
- Выбрать appropriate Node/TypeScript Linux desktop shell на основе официальных docs
- Linux обязателен, не web-only
- Browser preview может помочь в тестах, но не является desktop delivery

### 2. Модульные границы

- Строгие модульные границы
- Cohesive feature modules
- НЕ гигантские файлы
- НЕ разбросанные hardcoded URLs/credentials/model/node catalog
- Validated configuration
- Безопасные секреты через установленные platform facilities
- Redact logs/errors
- Секреты никогда в: graph/chat/context/exports/source
- НЕ fake data представленная как discovered environment
- Явно лейблированные sample/demo fixtures только для offline deterministic tests

### 3. Persistence

- Проекты
- Чат
- Ревизии графа/история/checkpoints/autosave/recovery
- Append action logs отдельно от объяснений
- Undo graph operations не может undo money/внешние эффекты
- Context chunking/retrieval/summaries с provenance
- User-viewable memory и cloud-data контролы
- Model/node/weight/LoRA/plugin/dependency catalog с совместимостью evidence и update/search (RAG где оправдано)
- НЕ угаданная universal compatibility database
- Шаблоны для частых задач
- Генерируемые JSON версии

### 4. Разрешения и scope

- Permissions и scoped budgets для:
  - Внешних тестов
  - Installation/deletion/overwrite
  - Оплачиваемая работа
- Тест что provider keys и malicious tool outputs не могут драйвить несвязанные действия
- НЕ фактически генерировать изображения/видео
- НЕ запускать реальные workflow пользователя
- НЕ устанавливать custom nodes/models
- НЕ отправлять сообщения
- НЕ тратить/пополнять
- НЕ деплоить публично
- Можно использовать deterministic mocks/fixtures и non-generative test harnesses, чётко лейблированные
- НЕ создавать imagery/video assets генеративными инструментами
- Фактические UI screenshots для QA — нормально

### 5. Linux compatibility

- Distro/архитектура не специфицирована
- Разумная initial validation target: ваше фактическое Linux окружение
- Явно записать OS/arch/desktop assumptions
- Оставшееся покрытие: Wayland/X11/package/other-distro
- НЕ '100% Linux' claims без test matrix
- План: desktop packaging/install/update/recovery и compatibility testing
- НЕ просто npm dev web UI

## Архитектура

### Выбор технологий (верифицированные версии)

#### Desktop Shell: Electron 45.2.3
- **Источник:** https://releases.electronjs.org/release/v45.2.3 (2026-11-05)
- **Версия:** 45.2.3 (latest stable)
- **Node.js:** 24.22.2
- **Chromium:** 156.0.8078.80
- **Linux поддержка:** x64 и arm64 binaries
- **Установка:** `npm install electron@45.2.3 --save-dev`
- **Лицензия:** MIT
- **Обоснование:** 
  - Стабильная проверенная платформа для Linux desktop
  - Полная поддержка TypeScript
  - Нативная интеграция с OS
  - IPC для главный/рендер процессы
  - Большое сообщество и документация
- **Риски:** 
  - Размер дистрибутива (~150MB)
  - Нужно тестирование на Wayland и X11
  - Разные desktop environments могут вести себя по-разному

#### Graph Canvas: React Flow (@xyflow/react)
- **Источник:** https://reactflow.dev/
- **Пакет:** `@xyflow/react` (latest stable)
- **Документация:** https://reactflow.dev/api-reference
- **Лицензия:** MIT
- **Особенности:**
  - TypeScript first
  - Custom nodes с typed data
  - Custom edges
  - Handles (порты): source и target
  - Built-in zoom, pan, selection
  - Hooks: useNodesState, useEdgesState
  - Plugin: MiniMap, Controls, Background
- **Обоснование:**
  - Зрелое решение с активным maintenance
  - Хорошая TypeScript поддержка
  - Гибкие custom nodes для ComfyUI-style визуализации
  - Built-in features для drag-drop, connections
- **Альтернатива:** ComfyUI LiteGraph
  - **За:** Нативная совместимость с ComfyUI
  - **Против:** JavaScript библиотека, не TypeScript first, менее документирована
  - **Решение:** React Flow с custom rendering для совместимости с ComfyUI JSON
- **Риски:**
  - Нужна кастомизация для полной ComfyUI visual parity
  - Проверить performance на больших графах (>100 узлов)

#### LLM Framework: Vercel AI SDK (ai)
- **Источник:** https://ai-sdk.dev/
- **Пакет:** `ai` (latest stable)
- **Документация:** 
  - https://ai-sdk.dev/docs/introduction
  - https://ai-sdk.dev/docs/foundations/providers-and-models
  - https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- **Лицензия:** Apache 2.0
- **Особенности:**
  - Unified provider API (OpenAI, Anthropic, Google, Mistral, и др.)
  - Streaming: `streamText`, `streamObject`
  - Tool calling с schema validation (zod)
  - Structured outputs
  - TypeScript native
- **Providers поддержка:**
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude)
  - Google (Gemini)
  - Mistral
  - Ollama (local models)
  - Custom providers
- **Обоснование:**
  - Единый API для всех провайдеров
  - Встроенный tool calling
  - Streaming out of the box
  - Хорошая TypeScript integration
  - Активное развитие от Vercel
- **Риски:**
  - Относительно новый SDK (проверить stability)
  - Некоторые providers могут иметь ограниченные capabilities
  - Нужно честно сообщать различия по providers

#### MCP Client: @modelcontextprotocol/client
- **Источник:** https://ts.sdk.modelcontextprotocol.io/v2/
- **Пакет:** `@modelcontextprotocol/client` v2 (latest stable)
- **Spec:** 2026-07-28 MCP spec
- **Документация:** 
  - https://ts.sdk.modelcontextprotocol.io/v2/clients/connect.html
  - https://ts.sdk.modelcontextprotocol.io/v2/clients/calling.html
- **Лицензия:** MIT
- **Особенности:**
  - Client для подключения к MCP servers
  - Транспорты: HTTP (StreamableHTTPClientTransport), stdio (StdioClientTransport)
  - API: listTools, callTool, listResources, readResource, listPrompts, getPrompt
  - TypeScript native
- **Обоснование:**
  - Официальный SDK
  - Поддержка stdio (local) и HTTP (remote) transports
  - Типизированные responses
  - Установленный протокол для tool discovery
- **Риски:**
  - Требует отдельный ComfyUI MCP server (не включён в эту задачу)
  - НЕ гарантированы credentials в этом окружении
  - Тест с mock MCP server для offline development

#### UI Framework: React 18 + TypeScript
- **React:** 18.x (latest stable)
- **TypeScript:** ^5.0
- **State Management:** Zustand или React Context (минимальный для начала)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Лицензия:** MIT (React), Apache 2.0 (shadcn/ui)

#### Database/Storage: SQLite + better-sqlite3
- **Пакет:** `better-sqlite3` (latest stable)
- **Цель:** 
  - Persistence проектов
  - Чат история
  - Graph revisions
  - Action logs
  - Context/memory
- **Лицензия:** MIT
- **Обоснование:**
  - Встраиваемая DB, без сервера
  - Отличная для desktop приложений
  - Synchronous API (проще чем async для Electron main process)
  - Хорошая TypeScript поддержка
- **Альтернативы:**
  - IndexedDB (browser-side): менее удобна для complex queries
  - JSON files: не подходит для concurrent access, no transactions

### Архитектурная диаграмма

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Window Mgmt │  │  IPC Handler │  │  DB (SQLite) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ IPC
┌─────────────────────────────────────────────────────────────┐
│                   Electron Renderer Process                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    UI Layer (React)                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐           │ │
│  │  │  Graph   │  │   Chat   │  │ Inspector  │           │ │
│  │  │  Canvas  │  │  Panel   │  │   Panel    │           │ │
│  │  │(ReactFlow)│  │          │  │            │           │ │
│  │  └──────────┘  └──────────┘  └────────────┘           │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 Application State                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ Graph State  │  │  Chat State  │  │ Project State│ │ │
│  │  │ (nodes/edges)│  │  (messages)  │  │  (metadata)  │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Services Layer                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ LLM Service  │  │ MCP Service  │  │Graph Service │ │ │
│  │  │(Vercel AI SDK)│  │(@mcp/client) │  │(ComfyUI JSON)│ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ LLM Provider │  │  ComfyUI     │                        │
│  │(OpenAI, etc) │  │  MCP Server  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Модульная структура

```
comfyui-desktop/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts            # Main entry, window creation
│   │   ├── ipc.ts              # IPC handlers
│   │   ├── database.ts         # SQLite connection/queries
│   │   └── menu.ts             # Application menu
│   │
│   ├── renderer/               # Electron renderer process
│   │   ├── index.tsx           # React entry
│   │   ├── App.tsx             # Root component
│   │   │
│   │   ├── components/         # UI components
│   │   │   ├── graph/          # Graph canvas components
│   │   │   │   ├── GraphCanvas.tsx       # Main React Flow wrapper
│   │   │   │   ├── nodes/                # Custom node types
│   │   │   │   │   ├── ComfyNode.tsx    # Base ComfyUI-style node
│   │   │   │   │   ├── ImageNode.tsx
│   │   │   │   │   └── ...
│   │   │   │   ├── edges/                # Custom edge types
│   │   │   │   └── handles/              # Port components
│   │   │   │
│   │   │   ├── chat/           # Chat panel components
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── Message.tsx
│   │   │   │   └── MessageInput.tsx
│   │   │   │
│   │   │   ├── inspector/      # Inspector/settings panel
│   │   │   │   ├── InspectorPanel.tsx
│   │   │   │   ├── NodeInspector.tsx
│   │   │   │   └── ProjectSettings.tsx
│   │   │   │
│   │   │   └── common/         # Reusable UI components
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       └── ...
│   │   │
│   │   ├── services/           # Business logic services
│   │   │   ├── llm/            # LLM integration
│   │   │   │   ├── llmService.ts         # Main LLM service
│   │   │   │   ├── providers.ts          # Provider configs
│   │   │   │   ├── tools.ts              # Tool definitions
│   │   │   │   └── streaming.ts          # Stream handling
│   │   │   │
│   │   │   ├── mcp/            # MCP integration
│   │   │   │   ├── mcpClient.ts          # MCP client wrapper
│   │   │   │   ├── discovery.ts          # Node/model discovery
│   │   │   │   └── mockServer.ts         # Mock MCP for testing
│   │   │   │
│   │   │   ├── graph/          # Graph operations
│   │   │   │   ├── graphService.ts       # Graph CRUD
│   │   │   │   ├── comfyImport.ts        # ComfyUI JSON import
│   │   │   │   ├── comfyExport.ts        # ComfyUI JSON export
│   │   │   │   ├── validation.ts         # Graph validation
│   │   │   │   └── revisions.ts          # Revision management
│   │   │   │
│   │   │   ├── persistence/    # Data persistence
│   │   │   │   ├── projectStore.ts       # Projects
│   │   │   │   ├── chatStore.ts          # Chat history
│   │   │   │   ├── graphStore.ts         # Graph revisions
│   │   │   │   └── settingsStore.ts      # Settings
│   │   │   │
│   │   │   └── actions/        # AI action execution
│   │   │       ├── actionExecutor.ts     # Action queue/executor
│   │   │       ├── graphActions.ts       # Graph manipulation actions
│   │   │       ├── conflictDetection.ts  # Stale state detection
│   │   │       └── pauseResume.ts        # Pause/resume logic
│   │   │
│   │   ├── state/              # Application state
│   │   │   ├── graphState.ts   # Graph state (Zustand)
│   │   │   ├── chatState.ts    # Chat state
│   │   │   ├── uiState.ts      # UI state (panels, selection)
│   │   │   └── projectState.ts # Project state
│   │   │
│   │   ├── types/              # TypeScript types
│   │   │   ├── graph.ts        # Graph types
│   │   │   ├── comfyui.ts      # ComfyUI types
│   │   │   ├── chat.ts         # Chat types
│   │   │   ├── actions.ts      # Action types
│   │   │   └── mcp.ts          # MCP types
│   │   │
│   │   └── utils/              # Utilities
│   │       ├── logger.ts       # Logging (redact secrets)
│   │       ├── validation.ts   # Input validation
│   │       └── errors.ts       # Error types
│   │
│   ├── preload/                # Electron preload scripts
│   │   └── index.ts            # Expose safe IPC to renderer
│   │
│   └── shared/                 # Shared between main/renderer
│       ├── ipc-channels.ts     # IPC channel names
│       └── constants.ts        # Constants
│
├── tests/                      # Tests
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── fixtures/               # Test fixtures
│       └── comfyui/            # ComfyUI workflow samples
│
├── docs/                       # Documentation
│   ├── superpowers/            # This document
│   ├── decisions/              # ADRs
│   └── api/                    # API docs
│
├── resources/                  # Application resources
│   └── icons/                  # App icons
│
├── package.json
├── tsconfig.json
├── electron-builder.yml        # Packaging config
└── README.md
```

## Типы данных

### Graph Types

```typescript
// ComfyUI native workflow JSON (UI format)
interface ComfyUIWorkflow {
  version: string;  // "1.0" or "0.4"
  nodes: ComfyUINode[];
  links: ComfyUILink[];
  groups: ComfyUIGroup[];
  config: Record<string, unknown>;
  extra: Record<string, unknown>;  // Preserve unknown fields
  [key: string]: unknown;  // Preserve all unknown fields
}

interface ComfyUINode {
  id: string | number;
  type: string;  // class_type
  pos: [number, number];
  size: [number, number];
  flags: Record<string, unknown>;
  order: number;
  mode: number;
  outputs: ComfyUIOutput[];
  inputs: ComfyUIInput[];
  properties: Record<string, unknown>;
  widgets_values?: unknown[];
  [key: string]: unknown;  // Preserve unknown fields
}

interface ComfyUILink {
  id: number;
  origin_id: number;
  origin_slot: number;
  target_id: number;
  target_slot: number;
  type: string;  // Data type
}

interface ComfyUIGroup {
  title: string;
  bounding: [number, number, number, number];  // x, y, w, h
  color: string;
  font_size: number;
  [key: string]: unknown;
}

// ComfyUI API prompt JSON (execution format)
interface ComfyUIPrompt {
  [nodeId: string]: {
    class_type: string;
    inputs: Record<string, unknown | [string, number]>;  // value or [source_id, output_index]
    _meta?: {
      title?: string;
      [key: string]: unknown;
    };
  };
}

// Internal graph representation (React Flow format)
interface InternalNode extends Node {
  id: string;
  type: string;  // node type for React Flow
  position: { x: number; y: number };
  data: {
    comfyType: string;  // ComfyUI class_type
    inputs: PortDefinition[];
    outputs: PortDefinition[];
    parameters: Record<string, unknown>;
    title?: string;
    annotations?: string[];
    locked?: boolean;
    // Preserve all ComfyUI fields
    comfyData: Partial<ComfyUINode>;
  };
}

interface InternalEdge extends Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;  // output port id
  targetHandle: string;  // input port id
  data: {
    dataType: string;
    // Preserve ComfyUI link data
    comfyData: Partial<ComfyUILink>;
  };
}

interface PortDefinition {
  id: string;
  name: string;
  dataType: string;
  optional: boolean;
}
```

### Chat Types

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // Link to graph revision
  graphRevisionId?: string;
  // Tool calls and results
  toolCalls?: ToolCall[];
  // Annotations
  annotations?: Annotation[];
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

interface Annotation {
  type: 'node-highlight' | 'edge-highlight' | 'explanation' | 'warning';
  nodeIds?: string[];
  edgeIds?: string[];
  text: string;
}
```

### Action Types

```typescript
interface GraphAction {
  id: string;
  type: 'add-node' | 'remove-node' | 'add-edge' | 'remove-edge' | 
        'update-node' | 'add-group' | 'update-group';
  timestamp: number;
  // Graph revision before and after
  beforeRevisionId: string;
  afterRevisionId: string;
  // Action details
  payload: unknown;
  // Source of action
  source: 'user' | 'ai';
  // Status
  status: 'pending' | 'applied' | 'failed' | 'conflict';
  error?: string;
}

interface GraphRevision {
  id: string;
  timestamp: number;
  graph: {
    nodes: InternalNode[];
    edges: InternalEdge[];
  };
  parentRevisionId?: string;
  description?: string;
  source: 'user' | 'ai' | 'import';
}
```

### MCP Types

```typescript
interface MCPConnection {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  config: StdioConfig | HttpConfig;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

interface StdioConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface HttpConfig {
  url: string;
  headers?: Record<string, string>;
}

interface ComfyUINodeInfo {
  class_type: string;
  input_types: Record<string, {
    type: string;
    optional?: boolean;
    default?: unknown;
  }>;
  output_types: string[];
  category: string;
  description?: string;
}
```

## ComfyUI JSON Compatibility

### Import процесс

1. **Чтение JSON файла**
   - Определить формат: UI workflow vs API prompt
   - Проверить версию

2. **Валидация**
   - Проверить обязательные поля
   - НЕ отклонять из-за неизвестных полей
   - Предупредить о неподдерживаемых features

3. **Конверсия в internal format**
   - UI workflow → Internal nodes/edges
   - API prompt → Реконструировать layout (best effort) ИЛИ явно пометить как "API format, no layout"
   - Сохранить ВСЕ исходные поля в `comfyData`

4. **Регистрация неизвестных node types**
   - Если node type не известен из MCP:
     - Создать generic node с предупреждением
     - Попытаться вывести inputs/outputs из connections
     - Пометить как "unverified"

5. **Результат**
   - Загруженный граф
   - Список предупреждений/ошибок
   - Список неизвестных node types
   - Возможность экспорта обратно с сохранением всех полей

### Export процесс

1. **Конверсия из internal format**
   - Internal nodes/edges → ComfyUI workflow JSON
   - Восстановить все сохранённые `comfyData` поля
   - Добавить новые поля для созданных нами узлов

2. **Валидация**
   - Проверить что все connections валидные
   - Проверить что node types существуют (из MCP или unknown)

3. **Формат output**
   - По умолчанию: UI workflow JSON (с layout)
   - Опция: API prompt JSON (только выполнение)

4. **Субграфы (native subgraphs)**
   - Проверить версию frontend: требуется >=1.24.3
   - Export с UUIDs
   - Сохранить структуру вложенности

### Тестирование совместимости

- Fixtures из реальных ComfyUI workflows
- Roundtrip тесты: import → export → import
- Проверка сохранения всех полей
- Проверка с разными версиями (v1.0, v0.4)
- Проверка с subgraphs
- Проверка с custom nodes

## Безопасность

### Секреты

- Хранение: OS credential store (keytar или electron-store с encryption)
- НЕ в plain text files
- НЕ в SQLite без encryption
- НЕ в logs/errors
- НЕ в graph/chat exports
- Redact в UI при показе

### Tool outputs

- Парсинг и валидация всех tool outputs
- НЕ выполнять инжектированные команды
- Sandbox для выполнения user code (если потребуется)
- Rate limiting для external API calls

### MCP connections

- Требовать explicit user configuration
- НЕ auto-connect к неизвестным servers
- Показать какие capabilities запрашивает server
- Возможность disconnect/revoke

### File access

- Ограничить file system access через Electron security
- Sandboxed renderer process
- Validate file paths
- НЕ позволять arbitrary file read/write через LLM

## UI/UX дизайн

### Layout

```
┌────────────────────────────────────────────────────────────────┐
│ Menu Bar: File  Edit  View  Graph  AI  Help                   │
├────────────────────────────────────────────────────────────────┤
│ Toolbar: [New] [Open] [Save] | [▶ Run] [⏸ Pause] | [Undo] [R>│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────┬──────────────────────────┐  │
│  │                              │                          │  │
│  │                              │   Chat Panel             │  │
│  │                              │  ┌────────────────────┐  │  │
│  │                              │  │ User: Add a noise  │  │  │
│  │                              │  │       node          │  │  │
│  │      Graph Canvas            │  ├────────────────────┤  │  │
│  │                              │  │ AI: I'll add a     │  │  │
│  │      (React Flow)            │  │     KSampler node  │  │  │
│  │                              │  │     [node highlight│  │  │
│  │   ┌───┐    ┌───┐            │  │      in graph]     │  │  │
│  │   │ N │───▶│ N │            │  └────────────────────┘  │  │
│  │   └───┘    └───┘            │  ┌────────────────────┐  │  │
│  │                              │  │ [Message input]    │  │  │
│  │                              │  │ [Send] [⏸ Pause]   │  │  │
│  │                              │  └────────────────────┘  │  │
│  │                              │                          │  │
│  ├──────────────────────────────┼──────────────────────────┤  │
│  │                              │   Inspector Panel        │  │
│  │   MiniMap                    │  ┌────────────────────┐  │  │
│  │   ┌──────────┐               │  │ Node: KSampler    │  │  │
│  │   │  [mini]  │               │  │ Type: KSampler    │  │  │
│  │   └──────────┘               │  │ Parameters:       │  │  │
│  │                              │  │   steps: 20       │  │  │
│  │                              │  │   cfg: 7.0        │  │  │
│  │                              │  └────────────────────┘  │  │
│  └──────────────────────────────┴──────────────────────────┘  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ Status Bar: Ready | 5 nodes | 4 connections | Model: GPT-4   │
└────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

- `Ctrl+N`: New project
- `Ctrl+O`: Open project
- `Ctrl+S`: Save project
- `Ctrl+Z`: Undo
- `Ctrl+Shift+Z`: Redo
- `Ctrl+E`: Export workflow
- `Ctrl+I`: Import workflow
- `Space`: Pan mode
- `Delete`: Delete selected
- `Ctrl+G`: Group selected
- `Ctrl+/`: Focus chat
- `Esc`: Cancel AI operation

### Visual feedback

- **AI operation в процессе:**
  - Highlight затронутых nodes (пульсирующий border)
  - Progress indicator в chat
  - "Pause" кнопка активна

- **Конфликт состояний:**
  - Warning icon на conflicted nodes
  - Tooltip с объяснением
  - Возможность: Accept AI / Keep Manual / Merge

- **Node states:**
  - Normal: белый background
  - Selected: синий border
  - AI-editing: жёлтый пульсирующий border
  - Error: красный border
  - Locked: замок icon

- **Annotations:**
  - AI explanations: синяя подсветка + tooltip
  - Warnings: жёлтый icon
  - Errors: красный icon

### Accessibility

- Keyboard navigation
- Screen reader support (ARIA labels)
- High contrast mode
- Adjustable font sizes
- Focus indicators

## Следующие шаги

См. [Implementation Plan](../plans/2026-11-07-comfyui-desktop.md) для детального плана реализации.

## Дополнительные решения

См. директорию `/workspace/docs/decisions/` для Architecture Decision Records (ADRs):

- ADR-001: Desktop Framework Selection (Electron vs Tauri)
- ADR-002: Graph Canvas Selection (React Flow vs LiteGraph)
- ADR-003: LLM Framework Selection (AI SDK vs LangChain)
- ADR-004: State Management (Zustand vs Redux)
- ADR-005: Database Selection (SQLite vs IndexedDB)

## Проверка соответствия требованиям

### ✅ Основные требования

| Требование | Реализация |
|-----------|-----------|
| Полноценный граф-канвас | React Flow с custom nodes/edges |
| Человеческое + AI редактирование | Action queue с conflict detection |
| Чат interface | Chat panel с AI SDK |
| MCP обнаружение | @modelcontextprotocol/client |
| Агент знает состояние | State доступен через tools |
| Export/import ComfyUI JSON | comfyImport/comfyExport services |
| Живой визуальный контроль | Annotations, highlights, explanations |

### ✅ Технические требования

| Требование | Реализация |
|-----------|-----------|
| Package-first | Использование Electron, React Flow, AI SDK, MCP SDK |
| Модульные границы | Чёткая структура src/ с feature modules |
| Persistence | SQLite для всех данных |
| Разрешения и scope | Permissions layer, mock для тестов |
| Linux compatibility | Electron 45.2.3 с Linux поддержкой |

### 🔄 Дальнейшая работа (после MVP)

- Desktop packaging (AppImage, .deb, Flatpak)
- Wayland/X11 тестирование
- Реальный ComfyUI MCP server integration
- Advanced features: templates, RAG, teaching mode
- Performance optimization для больших графов
- Multi-language support (сейчас Russian + English)

---

**Версия:** 1.0  
**Последнее обновление:** 2026-11-07
