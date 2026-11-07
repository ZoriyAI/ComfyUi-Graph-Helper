# ComfyUiGraphHelper

# ComfyUI Graph Builder

**Статус:** 🚧 В разработке (Alpha)  
**Платформа:** Linux Desktop (Electron)  
**Язык:** TypeScript + Node.js

## Описание

Linux desktop приложение для совместного визуального конструирования ComfyUI workflows/subgraphs с помощью LLM. Человек и AI работают с ОДНИМ ОБЩИМ графом, выполняя инкрементальные операции.

### Основные возможности

- ✅ **Полноценный граф-канвас** с nodes, typed ports, connections (React Flow)
- ✅ **Chat interface** для взаимодействия с AI (multi-provider LLM support planned)
- ✅ **Ручное + AI редактирование** одного графа
- ⏳ **Pause/resume** AI operations
- ⏳ **Conflict detection** для предотвращения перезаписи ручных правок
- ⏳ **Import/Export** native ComfyUI workflow JSON
- ⏳ **MCP integration** для обнаружения доступных ComfyUI nodes/models
- ⏳ **Persistence** projects, chat history, graph revisions

## Архитектура

### Technology Stack (PROPOSALS, not user-approved)

| Component | Technology | Version | License | Status |
|-----------|-----------|---------|---------|--------|
| Desktop Shell | Electron | 45.2.3 | MIT | ✅ Verified |
| Graph Canvas | @xyflow/react | 12.12.1 | MIT | ✅ Verified |
| LLM Framework | Vercel AI SDK | TBD | Apache 2.0 (assumed) | ⏳ Not verified |
| MCP Client | @modelcontextprotocol/client | 2.4.0 | Apache 2.0 | ✅ Verified |
| State Management | Zustand | 5.x | MIT | ⏳ In use |
| Database | SQLite (better-sqlite3) | 11.x | MIT | ⏳ In use |
| UI Framework | React | 18.x | MIT | ✅ In use |

См. `/docs/decisions/ADR-000-requirements-vs-decisions.md` для деталей.

### Модульная структура

```
src/
├── main/           # Electron main process
├── renderer/       # React UI
│   ├── components/ # UI components
│   ├── services/   # Business logic
│   ├── state/      # Zustand stores
│   └── types/      # TypeScript types
├── preload/        # Electron preload scripts
└── shared/         # Shared code
```

## Установка и запуск

### Requirements

- Node.js 18+ (24.22.2 included with Electron 45.2.3)
- npm или pnpm
- Linux (tested on Ubuntu-based, Wayland/X11 compatibility TBD)

### Development

```bash
# Install dependencies
npm install

# Run development mode
npm run dev

# Build
npm run build

# Type check
npm run type-check

# Tests
npm test
```

### Development mode

Development mode запускает:
1. Vite dev server (port 5173) для React app
2. Electron main process подключается к dev server

## Current Implementation Status

### ✅ Реализовано

- [x] Project setup (npm, TypeScript, Electron)
- [x] Electron main process (window management, IPC)
- [x] SQLite database (projects, chat, revisions)
- [x] React renderer с Vite
- [x] Graph canvas (React Flow) с custom ComfyUI-style nodes
- [x] Graph state management (Zustand)
- [x] Chat panel UI (messages, input, streaming indicator)
- [x] Chat state management
- [x] Sample nodes для demo
- [x] Import/Export buttons (UI только)

### ⏳ В процессе / Planned

- [ ] Real LLM integration (AI SDK)
- [ ] Graph operation tools для LLM
- [ ] Action executor с pause/resume
- [ ] Conflict detection (revision-based)
- [ ] ComfyUI JSON import/export (actual implementation)
- [ ] MCP client integration (mock ready)
- [ ] Graph revisions tracking
- [ ] Project save/load (IPC handlers ready, UI integration needed)
- [ ] Comprehensive tests
- [ ] Desktop packaging (AppImage, .deb)

### ❌ Not in scope for MVP

- Production packaging
- Real ComfyUI MCP server (mock only)
- Actual workflow execution/image generation
- Advanced features: templates, RAG, teaching mode

## Testing

### Manual verification

1. **Launch app:**
   ```bash
   npm run dev
   ```

2. **Graph editing:**
   - Drag nodes on canvas
   - Create connections by dragging from output to input ports
   - Zoom and pan
   - See MiniMap

3. **Chat:**
   - Type messages in chat panel
   - Currently shows mock responses (real LLM integration pending)

### Automated tests

```bash
npm test
```

## Security

- ❌ **No API keys in code** — user configures
- ❌ **No secrets in logs** — redacted
- ❌ **No real workflow execution** — mock only for testing
- ❌ **No real image generation** — disabled
- ✅ **Sandboxed renderer** — contextIsolation enabled
- ✅ **Safe IPC** — preload script exposes minimal API

## Linux Compatibility

**Tested on:**
- Environment: Cloud VM (Ubuntu-based)
- Display server: Headless (dbus errors expected)
- Architecture: x86_64

**Not yet tested:**
- Wayland vs X11
- Different desktop environments (GNOME, KDE, XFCE)
- ARM64
- Other distros (Fedora, Arch, Debian)

**Assumptions:**
- Modern Linux distribution with GTK support
- DBus available (warnings are non-fatal)

## ComfyUI JSON Compatibility

### Import/Export Strategy

1. **Preserve all fields** — store original data in `comfyData`
2. **Warn on unknown nodes** — don't fail silently
3. **Roundtrip testing** — import → export → import должен сохранить данные

### Format Support

- ✅ UI workflow JSON (v1.0, v0.4) — planned
- ⏳ API prompt JSON — planned (best effort layout reconstruction)
- ⏳ Native subgraphs — planned (requires frontend >=1.24.3)

## Documentation

- `/docs/superpowers/specs/` — Design specification
- `/docs/superpowers/plans/` — Implementation plan
- `/docs/decisions/` — Architecture Decision Records (ADRs)

## Known Limitations

1. **LLM integration** — currently mock responses only
2. **ComfyUI compatibility** — import/export не полностью реализован
3. **MCP** — mock server только, нет реального ComfyUI connection
4. **Tests** — minimal coverage, expanding
5. **Linux desktop** — packaging не готов, dev mode только
6. **Performance** — не тестировался на больших графах (>100 nodes)

## Roadmap

### Phase 1: Core Foundation (Current)
- ✅ Basic desktop app structure
- ✅ Graph canvas with manual editing
- ⏳ Real LLM tool integration
- ⏳ Conflict detection

### Phase 2: ComfyUI Integration
- ComfyUI JSON roundtrip
- MCP client для node discovery
- Node metadata от MCP

### Phase 3: Polish & Testing
- Comprehensive test coverage
- Desktop packaging
- Linux distro testing
- Performance optimization

### Phase 4: Advanced Features (Future)
- Templates
- RAG для node docs
- Teaching mode
- Multi-language support

## Contributing

Проект находится в активной разработке. 

## License

MIT (proposed, not finalized)

---

**Version:** 0.1.0 Alpha  
**Last Updated:** 2026-11-07  
**Agent Link:** TBD (after push)
