# ADR-000: User Requirements vs Engineering Decisions

**Дата:** 2026-11-07  
**Статус:** Принято  

## Контекст

Важно различать что было **явно утверждено пользователем** и что является **предложениями инженера** для реализации.

## User Requirements (Confirmed)

Следующие требования были **явно утверждены пользователем**:

### Функциональные требования
1. ✅ Linux desktop приложение (Node.js + TypeScript)
2. ✅ Полноценный редактируемый граф-канвас внутри приложения (НЕ просто чат с JSON, НЕ просто viewer)
3. ✅ Nodes, typed ports, connections, grouping/subgraphs, parameter editing, labels/annotations, selection
4. ✅ Визуально читаемый в стиле ComfyUI (не клон брендированного UI)
5. ✅ Человек и AI работают с ОДНИМ графом, AI выполняет РЕАЛЬНЫЕ операции инкрементально
6. ✅ Pause, manual edit, resume from new state
7. ✅ Предотвращение перезаписи ручных правок устаревшим LLM output
8. ✅ Различение: graph pause, LLM cancellation, external execution cancellation
9. ✅ Чат как основной интент: выбор local/cloud provider/model, конфигурация токена или local base URL
10. ✅ Использование СУЩЕСТВУЮЩЕГО maintained multi-provider LLM/agent framework с real tool calling, streaming
11. ✅ MCP для обнаружения что РЕАЛЬНО есть у ComfyUI пользователя (nodes, models, metadata)
12. ✅ Export/import нативного ComfyUI workflow/subgraph JSON
13. ✅ Сохранение неизвестных/custom полей, НЕ молчаливый lossy import
14. ✅ Живой визуальный контроль + обучение (select object and ask why, highlight, annotate)
15. ✅ Package-first: проверенные maintained packages, НЕ самописные graph engine/LLM SDK/MCP/etc
16. ✅ Модульные boundaries, validated configuration, safe secrets, redact logs
17. ✅ Persistence: projects, chat, graph revisions/history/autosave, action logs
18. ✅ Permissions и scoped budgets, НЕ фактически генерировать images/video или тратить деньги
19. ✅ Linux distro/arch не специфицированы, явно записать assumptions

### Что НЕ делать (подтверждено)
- ❌ НЕ chat returning completed JSON
- ❌ НЕ просто graph viewer
- ❌ НЕ самописный provider clients или agent loop
- ❌ НЕ fake streaming already-computed workflow
- ❌ НЕ молчаливо падать на другой connector/API
- ❌ НЕ фактически генерировать media, запускать workflows, устанавливать nodes
- ❌ НЕ обращаться к user's connected ComfyUI accounts из этого окружения
- ❌ НЕ заявлять '100% Linux' без test matrix

## Engineering Decisions (NOT user-approved)

Следующие решения являются **ПРЕДЛОЖЕНИЯМИ ИНЖЕНЕРА** и могут быть изменены:

### Technology Stack (Proposals)

#### Desktop Framework
- **Proposal:** Electron 45.2.3
- **Source:** npm @electron package (verified 2026-11-07)
- **License:** MIT
- **Alternatives considered:** Tauri, native Qt/GTK
- **Rationale:** Mature, TypeScript support, cross-platform, large community
- **Risks:** Bundle size ~150MB, Wayland/X11 testing needed
- **Status:** ⏳ NOT approved by user

#### Graph Canvas
- **Proposal:** @xyflow/react 12.12.1
- **Source:** npm @xyflow/react package (verified 2026-11-07)
- **License:** MIT
- **Alternatives considered:** ComfyUI LiteGraph (native but not TypeScript-first), custom canvas
- **Rationale:** TypeScript-first, active maintenance, custom nodes support
- **Risks:** Need customization for ComfyUI visual parity, performance on large graphs
- **Status:** ⏳ NOT approved by user

#### LLM Framework
- **Proposal:** Vercel AI SDK (`ai` package)
- **Source:** Research from ai-sdk.dev docs
- **License:** Apache 2.0 (assumed, NOT verified from package.json)
- **Alternatives considered:** LangChain, direct provider APIs
- **Rationale:** Multi-provider API, streaming, tool calling built-in
- **Risks:** Relatively newer SDK, provider capability differences
- **Status:** ⏳ NOT approved by user, LICENSE NOT VERIFIED

#### MCP Client
- **Proposal:** @modelcontextprotocol/client 2.4.0
- **Source:** npm @modelcontextprotocol/client package (verified 2026-11-07)
- **License:** Apache-2.0
- **Spec:** 2026-07-28 MCP spec
- **Status:** ✅ Official SDK, stable v2 confirmed

#### State Management
- **Proposal:** Zustand
- **Alternatives:** Redux, React Context only
- **Status:** ⏳ NOT approved by user

#### Database
- **Proposal:** SQLite + better-sqlite3
- **Alternatives:** IndexedDB, JSON files
- **Status:** ⏳ NOT approved by user

### Architecture Decisions (Proposals)

1. **Module structure:** Feature-based modules in src/renderer/services/
2. **Revision tracking:** Snapshot-based with conflict detection
3. **Action queue:** Sequential execution with pause/resume
4. **ComfyUI compatibility:** Preserve all fields in `comfyData`, warn on unknown

**Status:** ⏳ All architecture decisions are proposals, NOT user-approved

## Fake Examples to Avoid

❌ НЕ использовать выдуманные model IDs из search synthesis:
- "gpt-6-astra" — NOT A REAL MODEL
- "openai/gpt-6-astra" — NOT A REAL MODEL
- Любые другие выдуманные названия моделей из примеров

✅ Использовать только:
- Generic placeholders: `provider.model`, `<model-name>`
- Real verified model IDs from official provider docs when needed
- Let user configure actual model names

## Decision Process

1. ✅ User requirements → Implement as specified
2. ⏳ Engineering proposals → Document clearly as proposals
3. ⏳ Before committing to a technology → Verify from primary source (package.json, official docs)
4. ⏳ Document alternatives and rationale in separate ADRs

## Next Steps

1. Create individual ADRs for each major technology choice
2. Proceed with implementation using proposed stack
3. Keep proposals clearly marked in documentation
4. Be ready to swap technologies if user requests

---

**Вывод:** Пользователь утвердил ПРОДУКТОВОЕ НАПРАВЛЕНИЕ и требования. Конкретные технологии — это инженерные предложения, которые будут проверены в процессе реализации.
