# ComfyUI Graph Builder — Implementation Plan

**Дата:** 2026-11-07  
**Статус:** В работе  
**Приоритет:** Высокий  

## Executive Summary

Полный implementation план для Linux desktop приложения совместного визуального конструирования ComfyUI workflows с LLM. План разбит на проверяемые инкременты с чёткими acceptance criteria и командами для тестирования.

**Scope:** Meaningful runnable vertical slice включающий:
- Linux desktop shell (Electron)
- Editable graph canvas (React Flow) с ComfyUI-style nodes
- Chat interface с multi-provider LLM (AI SDK)
- Real framework-integrated tool-based graph editing
- Pause/resume/conflict detection
- MCP client bridge (configurable, с mock для offline testing)
- Import/export native ComfyUI JSON
- Persistence (projects, chat, graph revisions)
- Offline deterministic end-to-end tests

**Out of scope для этого run:**
- Production packaging (AppImage, .deb)
- Real ComfyUI MCP server (используем mock)
- Actual image generation/workflow execution
- Advanced features: templates, RAG, teaching mode

## Зависимости и риски

### External dependencies

| Dependency | Version | Risk | Mitigation |
|-----------|---------|------|------------|
| Electron | 45.2.3 | Medium: Размер, Linux compatibility | Тестировать на текущем Linux окружении |
| @xyflow/react | latest | Low: Mature package | Проверить custom node API |
| ai (Vercel AI SDK) | latest | Medium: Относительно новый | Fallback на direct provider APIs если нужно |
| @modelcontextprotocol/client | v2 | Low: Official SDK | Mock server для offline testing |
| better-sqlite3 | latest | Low: Mature | Native build может требовать python |

### Technical risks

1. **React Flow → ComfyUI visual parity**
   - Риск: Custom rendering может быть сложным
   - Mitigation: Начать с simple nodes, инкрементально улучшать

2. **AI action conflict detection**
   - Риск: Race conditions между user edits и AI actions
   - Mitigation: Revision-based graph state, explicit locking

3. **ComfyUI JSON roundtrip**
   - Риск: Потеря данных при import/export
   - Mitigation: Fixtures-based tests, preserve unknown fields

4. **Linux desktop compatibility**
   - Риск: Различия между Wayland/X11, desktop environments
   - Mitigation: Тестировать на текущем окружении, документировать assumptions

## Milestones

### M1: Project scaffold + basic Electron app (ДЕНЬ 1)
- ✅ Критерий: Запускается Electron окно с "Hello World"
- **Включает:** package.json, tsconfig, Electron main/renderer setup

### M2: Graph canvas с React Flow (ДЕНЬ 1-2)
- ✅ Критерий: Можно добавлять/удалять nodes и edges вручную
- **Включает:** React Flow integration, custom ComfyUI-style nodes

### M3: Chat panel + LLM integration (ДЕНЬ 2-3)
- ✅ Критерий: Можно отправить сообщение и получить ответ от LLM
- **Включает:** AI SDK setup, chat UI, basic streaming

### M4: LLM tools для graph operations (ДЕНЬ 3-4)
- ✅ Критерий: LLM может добавить node через tool call, результат виден на canvas
- **Включает:** Tool definitions, graph service, action executor

### M5: Conflict detection + pause/resume (ДЕНЬ 4-5)
- ✅ Критерий: User edit во время AI operation → conflict warning
- **Включает:** Revision tracking, conflict detection, pause mechanism

### M6: ComfyUI JSON import/export (ДЕНЬ 5-6)
- ✅ Критерий: Import ComfyUI workflow fixture → export → diff shows no data loss
- **Включает:** JSON parsers, validators, roundtrip tests

### M7: MCP client integration (ДЕНЬ 6-7)
- ✅ Критерий: Can discover available nodes from mock MCP server
- **Включает:** MCP client wrapper, mock server, discovery service

### M8: Persistence layer (ДЕНЬ 7-8)
- ✅ Критерий: Save project → close app → reopen → project restored
- **Включает:** SQLite setup, stores, IPC handlers

### M9: End-to-end tests + polish (ДЕНЬ 8-9)
- ✅ Критерий: All tests pass, app runnable, documented
- **Включает:** Test suite, bug fixes, documentation

## Детальные задачи

---

## PHASE 1: Project Setup & Electron Shell

### Task 1.1: Initialize project structure

**Цель:** Create repository structure и base configuration

**Шаги:**

1. Initialize npm project
   ```bash
   npm init -y
   npm install --save-dev typescript @types/node
   npx tsc --init
   ```

2. Install Electron
   ```bash
   npm install --save-dev electron@45.2.3
   npm install --save-dev @types/electron
   ```

3. Configure TypeScript
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "commonjs",
       "lib": ["ES2022", "DOM"],
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "types": ["node"]
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

4. Create directory structure
   ```bash
   mkdir -p src/{main,renderer,preload,shared}
   mkdir -p src/renderer/{components,services,state,types,utils}
   mkdir -p src/renderer/components/{graph,chat,inspector,common}
   mkdir -p src/renderer/services/{llm,mcp,graph,persistence,actions}
   mkdir -p tests/{unit,integration,fixtures/comfyui}
   mkdir -p docs/{decisions,api}
   mkdir -p resources/icons
   ```

5. Setup package.json scripts
   ```json
   {
     "scripts": {
       "dev": "electron .",
       "build": "tsc",
       "watch": "tsc --watch",
       "test": "jest",
       "lint": "eslint src/",
       "type-check": "tsc --noEmit"
     }
   }
   ```

**Acceptance:** `npm run build` успешно компилирует, структура директорий создана

---

### Task 1.2: Electron main process

**Цель:** Setup Electron main process с window management

**Шаги:**

1. Create main process entry
   ```typescript
   // src/main/index.ts
   import { app, BrowserWindow } from 'electron';
   import * as path from 'path';

   let mainWindow: BrowserWindow | null = null;

   function createWindow() {
     mainWindow = new BrowserWindow({
       width: 1400,
       height: 900,
       webPreferences: {
         preload: path.join(__dirname, '../preload/index.js'),
         nodeIntegration: false,
         contextIsolation: true,
         sandbox: true
       }
     });

     if (process.env.NODE_ENV === 'development') {
       mainWindow.loadURL('http://localhost:3000');
       mainWindow.webContents.openDevTools();
     } else {
       mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
     }

     mainWindow.on('closed', () => {
       mainWindow = null;
     });
   }

   app.whenReady().then(createWindow);

   app.on('window-all-closed', () => {
     if (process.platform !== 'darwin') {
       app.quit();
     }
   });

   app.on('activate', () => {
     if (mainWindow === null) {
       createWindow();
     }
   });
   ```

2. Create preload script
   ```typescript
   // src/preload/index.ts
   import { contextBridge, ipcRenderer } from 'electron';

   // Expose safe IPC API to renderer
   contextBridge.exposeInMainWorld('electronAPI', {
     // Will be expanded later
     platform: process.platform,
     versions: {
       node: process.versions.node,
       chrome: process.versions.chrome,
       electron: process.versions.electron
     }
   });
   ```

3. Create IPC channels
   ```typescript
   // src/shared/ipc-channels.ts
   export const IPC_CHANNELS = {
     // Database
     DB_SAVE_PROJECT: 'db:save-project',
     DB_LOAD_PROJECT: 'db:load-project',
     DB_LIST_PROJECTS: 'db:list-projects',
     
     // Graph
     GRAPH_SAVE_REVISION: 'graph:save-revision',
     GRAPH_LOAD_REVISION: 'graph:load-revision',
     
     // Chat
     CHAT_SAVE_MESSAGE: 'chat:save-message',
     CHAT_LOAD_HISTORY: 'chat:load-history',
     
     // File operations
     FILE_IMPORT_WORKFLOW: 'file:import-workflow',
     FILE_EXPORT_WORKFLOW: 'file:export-workflow',
   } as const;
   ```

4. Update package.json main
   ```json
   {
     "main": "dist/main/index.js"
   }
   ```

**Test command:**
```bash
npm run build && npm run dev
```

**Acceptance:** Electron window открывается, dev tools доступны, preload работает

---

### Task 1.3: Renderer setup with React

**Цель:** Setup React renderer process

**Шаги:**

1. Install React и build tools
   ```bash
   npm install react@18 react-dom@18
   npm install --save-dev @types/react @types/react-dom
   npm install --save-dev vite @vitejs/plugin-react
   ```

2. Create Vite config
   ```typescript
   // vite.config.ts
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     base: './',
     build: {
       outDir: 'dist/renderer',
       emptyOutDir: true
     },
     server: {
       port: 3000
     }
   });
   ```

3. Create renderer entry
   ```typescript
   // src/renderer/index.tsx
   import React from 'react';
   import ReactDOM from 'react-dom/client';
   import App from './App';
   import './index.css';

   const root = ReactDOM.createRoot(
     document.getElementById('root') as HTMLElement
   );

   root.render(
     <React.StrictMode>
       <App />
     </React.StrictMode>
   );
   ```

4. Create App component
   ```typescript
   // src/renderer/App.tsx
   import React from 'react';

   function App() {
     const platform = (window as any).electronAPI?.platform;
     const versions = (window as any).electronAPI?.versions;

     return (
       <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
         <h1>ComfyUI Graph Builder</h1>
         <p>Platform: {platform}</p>
         <p>Electron: {versions?.electron}</p>
         <p>Node: {versions?.node}</p>
         <p>Chrome: {versions?.chrome}</p>
       </div>
     );
   }

   export default App;
   ```

5. Create HTML template
   ```html
   <!-- src/renderer/index.html -->
   <!DOCTYPE html>
   <html lang="en">
   <head>
     <meta charset="UTF-8">
     <meta name="viewport" content="width=device-width, initial-scale=1.0">
     <title>ComfyUI Graph Builder</title>
   </head>
   <body>
     <div id="root"></div>
     <script type="module" src="./index.tsx"></script>
   </body>
   </html>
   ```

6. Update package.json scripts
   ```json
   {
     "scripts": {
       "dev:vite": "vite",
       "dev:electron": "npm run build:main && NODE_ENV=development electron .",
       "dev": "concurrently \"npm run dev:vite\" \"npm run dev:electron\"",
       "build:main": "tsc --project tsconfig.main.json",
       "build:renderer": "vite build",
       "build": "npm run build:main && npm run build:renderer"
     }
   }
   ```

7. Install concurrently
   ```bash
   npm install --save-dev concurrently
   ```

8. Create separate tsconfig for main
   ```json
   // tsconfig.main.json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "outDir": "./dist"
     },
     "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*"]
   }
   ```

**Test command:**
```bash
npm run dev
```

**Acceptance:** React app загружается в Electron window, hot reload работает

---

## PHASE 2: Graph Canvas with React Flow

### Task 2.1: Install and setup React Flow

**Цель:** Integrate React Flow с basic functionality

**Шаги:**

1. Install React Flow
   ```bash
   npm install @xyflow/react
   ```

2. Create graph types
   ```typescript
   // src/renderer/types/graph.ts
   import { Node, Edge } from '@xyflow/react';

   export interface PortDefinition {
     id: string;
     name: string;
     dataType: string;
     optional: boolean;
   }

   export interface ComfyNodeData {
     comfyType: string;
     inputs: PortDefinition[];
     outputs: PortDefinition[];
     parameters: Record<string, unknown>;
     title?: string;
     annotations?: string[];
     locked?: boolean;
     // Preserve original ComfyUI data
     comfyData?: Record<string, unknown>;
   }

   export type GraphNode = Node<ComfyNodeData>;
   export type GraphEdge = Edge<{
     dataType: string;
     comfyData?: Record<string, unknown>;
   }>;

   export interface GraphState {
     nodes: GraphNode[];
     edges: GraphEdge[];
   }
   ```

3. Create GraphCanvas component
   ```typescript
   // src/renderer/components/graph/GraphCanvas.tsx
   import React, { useCallback } from 'react';
   import {
     ReactFlow,
     Background,
     Controls,
     MiniMap,
     useNodesState,
     useEdgesState,
     addEdge,
     Connection,
     NodeTypes,
   } from '@xyflow/react';
   import '@xyflow/react/dist/style.css';
   import { GraphNode, GraphEdge } from '../../types/graph';
   import ComfyNode from './nodes/ComfyNode';

   const nodeTypes: NodeTypes = {
     comfy: ComfyNode,
   };

   const initialNodes: GraphNode[] = [
     {
       id: '1',
       type: 'comfy',
       position: { x: 100, y: 100 },
       data: {
         comfyType: 'LoadImage',
         title: 'Load Image',
         inputs: [],
         outputs: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
         parameters: {},
       },
     },
     {
       id: '2',
       type: 'comfy',
       position: { x: 400, y: 100 },
       data: {
         comfyType: 'KSampler',
         title: 'KSampler',
         inputs: [
           { id: 'in-0', name: 'image', dataType: 'IMAGE', optional: false },
         ],
         outputs: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
         parameters: { steps: 20, cfg: 7.0 },
       },
     },
   ];

   const initialEdges: GraphEdge[] = [];

   export default function GraphCanvas() {
     const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>(initialNodes);
     const [edges, setEdges, onEdgesChange] = useEdgesState<GraphEdge>(initialEdges);

     const onConnect = useCallback(
       (connection: Connection) => {
         const edge: GraphEdge = {
           ...connection,
           data: { dataType: 'IMAGE' },
         } as GraphEdge;
         setEdges((eds) => addEdge(edge, eds));
       },
       [setEdges]
     );

     return (
       <div style={{ width: '100%', height: '100%' }}>
         <ReactFlow
           nodes={nodes}
           edges={edges}
           onNodesChange={onNodesChange}
           onEdgesChange={onEdgesChange}
           onConnect={onConnect}
           nodeTypes={nodeTypes}
           fitView
         >
           <Background />
           <Controls />
           <MiniMap />
         </ReactFlow>
       </div>
     );
   }
   ```

4. Create custom ComfyNode component
   ```typescript
   // src/renderer/components/graph/nodes/ComfyNode.tsx
   import React from 'react';
   import { Handle, Position, NodeProps } from '@xyflow/react';
   import { ComfyNodeData } from '../../../types/graph';

   export default function ComfyNode({ data, selected }: NodeProps<ComfyNodeData>) {
     return (
       <div
         style={{
           padding: '10px',
           borderRadius: '8px',
           border: `2px solid ${selected ? '#1a73e8' : '#ccc'}`,
           background: data.locked ? '#f0f0f0' : 'white',
           minWidth: '150px',
         }}
       >
         {/* Input handles */}
         {data.inputs.map((input, idx) => (
           <Handle
             key={input.id}
             type="target"
             position={Position.Left}
             id={input.id}
             style={{ top: `${30 + idx * 20}px` }}
           />
         ))}

         {/* Node content */}
         <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
           {data.title || data.comfyType}
         </div>
         <div style={{ fontSize: '12px', color: '#666' }}>
           {data.comfyType}
         </div>

         {/* Parameters */}
         {Object.keys(data.parameters).length > 0 && (
           <div style={{ marginTop: '8px', fontSize: '11px' }}>
             {Object.entries(data.parameters).map(([key, value]) => (
               <div key={key}>
                 {key}: {String(value)}
               </div>
             ))}
           </div>
         )}

         {/* Annotations */}
         {data.annotations && data.annotations.length > 0 && (
           <div style={{ marginTop: '8px', fontSize: '11px', color: '#1a73e8' }}>
             💡 {data.annotations[0]}
           </div>
         )}

         {/* Output handles */}
         {data.outputs.map((output, idx) => (
           <Handle
             key={output.id}
             type="source"
             position={Position.Right}
             id={output.id}
             style={{ top: `${30 + idx * 20}px` }}
           />
         ))}
       </div>
     );
   }
   ```

5. Update App.tsx to include GraphCanvas
   ```typescript
   // src/renderer/App.tsx
   import React from 'react';
   import GraphCanvas from './components/graph/GraphCanvas';

   function App() {
     return (
       <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
         <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
           <h1 style={{ margin: 0, fontSize: '18px' }}>ComfyUI Graph Builder</h1>
         </div>
         <div style={{ flex: 1 }}>
           <GraphCanvas />
         </div>
       </div>
     );
   }

   export default App;
   ```

**Test command:**
```bash
npm run dev
```

**Acceptance:** 
- График отображается с 2 nodes
- Можно создать connection между nodes
- Можно drag nodes
- Zoom и pan работают

---

### Task 2.2: Graph state management

**Цель:** Setup Zustand для graph state

**Шаги:**

1. Install Zustand
   ```bash
   npm install zustand
   ```

2. Create graph store
   ```typescript
   // src/renderer/state/graphState.ts
   import { create } from 'zustand';
   import { GraphNode, GraphEdge } from '../types/graph';

   interface GraphState {
     nodes: GraphNode[];
     edges: GraphEdge[];
     selectedNodeIds: string[];
     selectedEdgeIds: string[];
     
     // Actions
     setNodes: (nodes: GraphNode[]) => void;
     setEdges: (edges: GraphEdge[]) => void;
     addNode: (node: GraphNode) => void;
     updateNode: (id: string, data: Partial<GraphNode['data']>) => void;
     removeNode: (id: string) => void;
     addEdge: (edge: GraphEdge) => void;
     removeEdge: (id: string) => void;
     setSelection: (nodeIds: string[], edgeIds: string[]) => void;
     clearGraph: () => void;
   }

   export const useGraphStore = create<GraphState>((set) => ({
     nodes: [],
     edges: [],
     selectedNodeIds: [],
     selectedEdgeIds: [],

     setNodes: (nodes) => set({ nodes }),
     
     setEdges: (edges) => set({ edges }),
     
     addNode: (node) =>
       set((state) => ({ nodes: [...state.nodes, node] })),
     
     updateNode: (id, data) =>
       set((state) => ({
         nodes: state.nodes.map((node) =>
           node.id === id ? { ...node, data: { ...node.data, ...data } } : node
         ),
       })),
     
     removeNode: (id) =>
       set((state) => ({
         nodes: state.nodes.filter((node) => node.id !== id),
         edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
       })),
     
     addEdge: (edge) =>
       set((state) => ({ edges: [...state.edges, edge] })),
     
     removeEdge: (id) =>
       set((state) => ({
         edges: state.edges.filter((edge) => edge.id !== id),
       })),
     
     setSelection: (nodeIds, edgeIds) =>
       set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),
     
     clearGraph: () =>
       set({ nodes: [], edges: [], selectedNodeIds: [], selectedEdgeIds: [] }),
   }));
   ```

3. Update GraphCanvas to use store
   ```typescript
   // src/renderer/components/graph/GraphCanvas.tsx (updated)
   import React, { useCallback } from 'react';
   import {
     ReactFlow,
     Background,
     Controls,
     MiniMap,
     addEdge as addReactFlowEdge,
     Connection,
     NodeTypes,
     OnNodesChange,
     OnEdgesChange,
     applyNodeChanges,
     applyEdgeChanges,
   } from '@xyflow/react';
   import '@xyflow/react/dist/style.css';
   import { useGraphStore } from '../../state/graphState';
   import ComfyNode from './nodes/ComfyNode';

   const nodeTypes: NodeTypes = {
     comfy: ComfyNode,
   };

   export default function GraphCanvas() {
     const { nodes, edges, setNodes, setEdges, addEdge } = useGraphStore();

     const onNodesChange: OnNodesChange = useCallback(
       (changes) => {
         setNodes(applyNodeChanges(changes, nodes));
       },
       [nodes, setNodes]
     );

     const onEdgesChange: OnEdgesChange = useCallback(
       (changes) => {
         setEdges(applyEdgeChanges(changes, edges));
       },
       [edges, setEdges]
     );

     const onConnect = useCallback(
       (connection: Connection) => {
         const newEdge = {
           ...connection,
           id: `e${connection.source}-${connection.target}`,
           data: { dataType: 'IMAGE' },
         };
         addEdge(newEdge as any);
       },
       [addEdge]
     );

     return (
       <div style={{ width: '100%', height: '100%' }}>
         <ReactFlow
           nodes={nodes}
           edges={edges}
           onNodesChange={onNodesChange}
           onEdgesChange={onEdgesChange}
           onConnect={onConnect}
           nodeTypes={nodeTypes}
           fitView
         >
           <Background />
           <Controls />
           <MiniMap />
         </ReactFlow>
       </div>
     );
   }
   ```

4. Initialize store with sample data
   ```typescript
   // src/renderer/App.tsx (updated)
   import React, { useEffect } from 'react';
   import GraphCanvas from './components/graph/GraphCanvas';
   import { useGraphStore } from './state/graphState';

   // Sample initial data
   const sampleNodes = [
     {
       id: '1',
       type: 'comfy',
       position: { x: 100, y: 100 },
       data: {
         comfyType: 'LoadImage',
         title: 'Load Image',
         inputs: [],
         outputs: [{ id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false }],
         parameters: {},
       },
     },
   ];

   function App() {
     const { nodes, setNodes } = useGraphStore();

     useEffect(() => {
       if (nodes.length === 0) {
         setNodes(sampleNodes);
       }
     }, []);

     return (
       <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
         <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
           <h1 style={{ margin: 0, fontSize: '18px' }}>ComfyUI Graph Builder</h1>
         </div>
         <div style={{ flex: 1 }}>
           <GraphCanvas />
         </div>
       </div>
     );
   }

   export default App;
   ```

**Test command:**
```bash
npm run dev
```

**Acceptance:** Graph state управляется через Zustand, можно добавлять/удалять nodes через store

---

## PHASE 3: Chat Panel + LLM Integration

### Task 3.1: Create Chat UI

**Цель:** Build chat panel interface

**Шаги:**

1. Create chat types
   ```typescript
   // src/renderer/types/chat.ts
   export interface ChatMessage {
     id: string;
     role: 'user' | 'assistant' | 'system';
     content: string;
     timestamp: number;
     graphRevisionId?: string;
     toolCalls?: ToolCall[];
   }

   export interface ToolCall {
     id: string;
     name: string;
     arguments: Record<string, unknown>;
     result?: unknown;
     status: 'pending' | 'success' | 'error';
     error?: string;
   }
   ```

2. Create chat state
   ```typescript
   // src/renderer/state/chatState.ts
   import { create } from 'zustand';
   import { ChatMessage } from '../types/chat';

   interface ChatState {
     messages: ChatMessage[];
     isStreaming: boolean;
     isPaused: boolean;
     
     // Actions
     addMessage: (message: ChatMessage) => void;
     updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
     setStreaming: (streaming: boolean) => void;
     setPaused: (paused: boolean) => void;
     clearChat: () => void;
   }

   export const useChatStore = create<ChatState>((set) => ({
     messages: [],
     isStreaming: false,
     isPaused: false,

     addMessage: (message) =>
       set((state) => ({ messages: [...state.messages, message] })),
     
     updateMessage: (id, updates) =>
       set((state) => ({
         messages: state.messages.map((msg) =>
           msg.id === id ? { ...msg, ...updates } : msg
         ),
       })),
     
     setStreaming: (streaming) => set({ isStreaming: streaming }),
     
     setPaused: (paused) => set({ isPaused: paused }),
     
     clearChat: () => set({ messages: [] }),
   }));
   ```

3. Create Message component
   ```typescript
   // src/renderer/components/chat/Message.tsx
   import React from 'react';
   import { ChatMessage } from '../../types/chat';

   interface MessageProps {
     message: ChatMessage;
   }

   export default function Message({ message }: MessageProps) {
     const isUser = message.role === 'user';
     
     return (
       <div
         style={{
           display: 'flex',
           justifyContent: isUser ? 'flex-end' : 'flex-start',
           marginBottom: '12px',
         }}
       >
         <div
           style={{
             maxWidth: '80%',
             padding: '10px 14px',
             borderRadius: '12px',
             background: isUser ? '#1a73e8' : '#f0f0f0',
             color: isUser ? 'white' : 'black',
           }}
         >
           <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
             {message.content}
           </div>
           
           {/* Tool calls */}
           {message.toolCalls && message.toolCalls.length > 0 && (
             <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
               {message.toolCalls.map((tool) => (
                 <div key={tool.id} style={{ marginTop: '4px' }}>
                   🔧 {tool.name}
                   {tool.status === 'pending' && ' ⏳'}
                   {tool.status === 'success' && ' ✓'}
                   {tool.status === 'error' && ` ✗ ${tool.error}`}
                 </div>
               ))}
             </div>
           )}
           
           <div style={{ fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
             {new Date(message.timestamp).toLocaleTimeString()}
           </div>
         </div>
       </div>
     );
   }
   ```

4. Create MessageInput component
   ```typescript
   // src/renderer/components/chat/MessageInput.tsx
   import React, { useState } from 'react';

   interface MessageInputProps {
     onSend: (content: string) => void;
     onPause: () => void;
     isStreaming: boolean;
     isPaused: boolean;
     disabled?: boolean;
   }

   export default function MessageInput({
     onSend,
     onPause,
     isStreaming,
     isPaused,
     disabled = false,
   }: MessageInputProps) {
     const [input, setInput] = useState('');

     const handleSubmit = (e: React.FormEvent) => {
       e.preventDefault();
       if (input.trim() && !disabled) {
         onSend(input.trim());
         setInput('');
       }
     };

     return (
       <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
         <input
           type="text"
           value={input}
           onChange={(e) => setInput(e.target.value)}
           placeholder="Type a message..."
           disabled={disabled}
           style={{
             flex: 1,
             padding: '10px',
             border: '1px solid #ccc',
             borderRadius: '8px',
             fontSize: '14px',
           }}
         />
         
         {isStreaming && !isPaused && (
           <button
             type="button"
             onClick={onPause}
             style={{
               padding: '10px 16px',
               background: '#ff9800',
               color: 'white',
               border: 'none',
               borderRadius: '8px',
               cursor: 'pointer',
             }}
           >
             ⏸ Pause
           </button>
         )}
         
         <button
           type="submit"
           disabled={!input.trim() || disabled}
           style={{
             padding: '10px 16px',
             background: disabled ? '#ccc' : '#1a73e8',
             color: 'white',
             border: 'none',
             borderRadius: '8px',
             cursor: disabled ? 'not-allowed' : 'pointer',
           }}
         >
           Send
         </button>
       </form>
     );
   }
   ```

5. Create ChatPanel component
   ```typescript
   // src/renderer/components/chat/ChatPanel.tsx
   import React, { useRef, useEffect } from 'react';
   import { useChatStore } from '../../state/chatState';
   import Message from './Message';
   import MessageInput from './MessageInput';

   interface ChatPanelProps {
     onSendMessage: (content: string) => void;
     onPause: () => void;
   }

   export default function ChatPanel({ onSendMessage, onPause }: ChatPanelProps) {
     const { messages, isStreaming, isPaused } = useChatStore();
     const messagesEndRef = useRef<HTMLDivElement>(null);

     // Auto-scroll to bottom
     useEffect(() => {
       messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
     }, [messages]);

     return (
       <div
         style={{
           display: 'flex',
           flexDirection: 'column',
           height: '100%',
           borderLeft: '1px solid #ccc',
         }}
       >
         {/* Header */}
         <div
           style={{
             padding: '12px',
             borderBottom: '1px solid #ccc',
             fontWeight: 'bold',
           }}
         >
           Chat
         </div>

         {/* Messages */}
         <div
           style={{
             flex: 1,
             overflowY: 'auto',
             padding: '12px',
           }}
         >
           {messages.length === 0 ? (
             <div style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
               Start a conversation to build your workflow
             </div>
           ) : (
             messages.map((message) => <Message key={message.id} message={message} />)
           )}
           <div ref={messagesEndRef} />
         </div>

         {/* Input */}
         <div style={{ padding: '12px', borderTop: '1px solid #ccc' }}>
           <MessageInput
             onSend={onSendMessage}
             onPause={onPause}
             isStreaming={isStreaming}
             isPaused={isPaused}
           />
         </div>
       </div>
     );
   }
   ```

6. Update App.tsx with layout
   ```typescript
   // src/renderer/App.tsx (updated)
   import React, { useEffect } from 'react';
   import GraphCanvas from './components/graph/GraphCanvas';
   import ChatPanel from './components/chat/ChatPanel';
   import { useGraphStore } from './state/graphState';
   import { useChatStore } from './state/chatState';

   function App() {
     const addMessage = useChatStore((state) => state.addMessage);

     const handleSendMessage = (content: string) => {
       // Add user message
       addMessage({
         id: Date.now().toString(),
         role: 'user',
         content,
         timestamp: Date.now(),
       });

       // Simulate AI response (will be replaced with real LLM)
       setTimeout(() => {
         addMessage({
           id: (Date.now() + 1).toString(),
           role: 'assistant',
           content: 'I received your message: ' + content,
           timestamp: Date.now(),
         });
       }, 500);
     };

     const handlePause = () => {
       useChatStore.setState({ isPaused: true });
       console.log('Paused');
     };

     return (
       <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
         {/* Header */}
         <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
           <h1 style={{ margin: 0, fontSize: '18px' }}>ComfyUI Graph Builder</h1>
         </div>

         {/* Main content */}
         <div style={{ flex: 1, display: 'flex' }}>
           {/* Graph canvas - 70% */}
           <div style={{ flex: '0 0 70%' }}>
             <GraphCanvas />
           </div>

           {/* Chat panel - 30% */}
           <div style={{ flex: '0 0 30%' }}>
             <ChatPanel onSendMessage={handleSendMessage} onPause={handlePause} />
           </div>
         </div>
       </div>
     );
   }

   export default App;
   ```

**Test command:**
```bash
npm run dev
```

**Acceptance:** Chat panel отображается, можно отправлять сообщения, получать ответы (mock)

---

### Task 3.2: LLM Service integration (AI SDK)

**Цель:** Integrate Vercel AI SDK для real LLM calls

**Шаги:**

1. Install AI SDK
   ```bash
   npm install ai @ai-sdk/openai
   ```

2. Create LLM service types
   ```typescript
   // src/renderer/types/llm.ts
   export interface LLMConfig {
     provider: 'openai' | 'anthropic' | 'ollama' | 'custom';
     model: string;
     apiKey?: string;
     baseURL?: string;
     temperature?: number;
     maxTokens?: number;
   }

   export interface LLMMessage {
     role: 'system' | 'user' | 'assistant';
     content: string;
   }
   ```

3. Create LLM configuration store
   ```typescript
   // src/renderer/state/llmConfigState.ts
   import { create } from 'zustand';
   import { persist } from 'zustand/middleware';
   import { LLMConfig } from '../types/llm';

   interface LLMConfigState {
     config: LLMConfig;
     setConfig: (config: Partial<LLMConfig>) => void;
   }

   export const useLLMConfigStore = create<LLMConfigState>()(
     persist(
       (set) => ({
         config: {
           provider: 'openai',
           model: 'gpt-4',
           temperature: 0.7,
           maxTokens: 2000,
         },
         
         setConfig: (updates) =>
           set((state) => ({
             config: { ...state.config, ...updates },
           })),
       }),
       {
         name: 'llm-config',
         // Don't persist API keys (security)
         partialize: (state) => ({
           config: {
             ...state.config,
             apiKey: undefined,
           },
         }),
       }
     )
   );
   ```

4. Create LLM service
   ```typescript
   // src/renderer/services/llm/llmService.ts
   import { streamText } from 'ai';
   import { openai } from '@ai-sdk/openai';
   import { LLMConfig, LLMMessage } from '../../types/llm';

   export class LLMService {
     private config: LLMConfig;
     private abortController: AbortController | null = null;

     constructor(config: LLMConfig) {
       this.config = config;
     }

     updateConfig(config: LLMConfig) {
       this.config = config;
     }

     async *streamChat(
       messages: LLMMessage[],
       tools?: Record<string, any>
     ): AsyncGenerator<string, void, unknown> {
       this.abortController = new AbortController();

       try {
         const model = this.getModel();
         
         const result = streamText({
           model,
           messages,
           tools,
           temperature: this.config.temperature,
           maxTokens: this.config.maxTokens,
           abortSignal: this.abortController.signal,
         });

         for await (const part of result.textStream) {
           yield part;
         }
       } catch (error) {
         if ((error as any).name === 'AbortError') {
           console.log('Stream aborted');
         } else {
           console.error('LLM stream error:', error);
           throw error;
         }
       } finally {
         this.abortController = null;
       }
     }

     abort() {
       this.abortController?.abort();
       this.abortController = null;
     }

     private getModel() {
       const { provider, model, apiKey, baseURL } = this.config;

       switch (provider) {
         case 'openai':
           return openai(model, {
             apiKey: apiKey || process.env.OPENAI_API_KEY,
             baseURL,
           });
         
         // Add other providers as needed
         default:
           throw new Error(`Unsupported provider: ${provider}`);
       }
     }
   }

   // Singleton instance
   let llmServiceInstance: LLMService | null = null;

   export function getLLMService(config?: LLMConfig): LLMService {
     if (!llmServiceInstance && config) {
       llmServiceInstance = new LLMService(config);
     } else if (config) {
       llmServiceInstance!.updateConfig(config);
     }
     return llmServiceInstance!;
   }
   ```

5. Update App.tsx to use real LLM
   ```typescript
   // src/renderer/App.tsx (updated handleSendMessage)
   import { getLLMService } from './services/llm/llmService';
   import { useLLMConfigStore } from './state/llmConfigState';

   function App() {
     const llmConfig = useLLMConfigStore((state) => state.config);
     const { addMessage, setStreaming } = useChatStore();

     const handleSendMessage = async (content: string) => {
       // Add user message
       const userMessageId = Date.now().toString();
       addMessage({
         id: userMessageId,
         role: 'user',
         content,
         timestamp: Date.now(),
       });

       // Start streaming AI response
       setStreaming(true);
       const assistantMessageId = (Date.now() + 1).toString();
       let assistantContent = '';

       try {
         const llmService = getLLMService(llmConfig);
         const messages = [
           { role: 'system' as const, content: 'You are a helpful assistant for building ComfyUI workflows.' },
           { role: 'user' as const, content },
         ];

         // Add empty assistant message
         addMessage({
           id: assistantMessageId,
           role: 'assistant',
           content: '',
           timestamp: Date.now(),
         });

         // Stream response
         for await (const chunk of llmService.streamChat(messages)) {
           assistantContent += chunk;
           useChatStore.setState((state) => ({
             messages: state.messages.map((msg) =>
               msg.id === assistantMessageId
                 ? { ...msg, content: assistantContent }
                 : msg
             ),
           }));
         }
       } catch (error) {
         console.error('LLM error:', error);
         addMessage({
           id: (Date.now() + 2).toString(),
           role: 'assistant',
           content: `Error: ${(error as Error).message}`,
           timestamp: Date.now(),
         });
       } finally {
         setStreaming(false);
       }
     };

     // ... rest of component
   }
   ```

**Test command:**
```bash
# Set API key in environment or UI settings
export OPENAI_API_KEY=your-key-here
npm run dev
```

**Acceptance:** 
- Можно отправить сообщение и получить streaming ответ от LLM
- Streaming отображается в реальном времени
- НЕ требуется для offline testing (используем mock)

---

## PHASE 4: LLM Tools для Graph Operations

### Task 4.1: Define graph operation tools

**Цель:** Create tool definitions для graph manipulations

**Шаги:**

1. Create tools types
   ```typescript
   // src/renderer/types/tools.ts
   import { z } from 'zod';

   export const AddNodeArgsSchema = z.object({
     nodeType: z.string().describe('ComfyUI node class type (e.g., "KSampler", "LoadImage")'),
     title: z.string().optional().describe('Optional display title for the node'),
     x: z.number().optional().describe('X position (defaults to center)'),
     y: z.number().optional().describe('Y position (defaults to center)'),
     parameters: z.record(z.unknown()).optional().describe('Node parameters'),
   });

   export const RemoveNodeArgsSchema = z.object({
     nodeId: z.string().describe('ID of the node to remove'),
   });

   export const ConnectNodesArgsSchema = z.object({
     sourceNodeId: z.string().describe('Source node ID'),
     sourceOutputIndex: z.number().describe('Output port index'),
     targetNodeId: z.string().describe('Target node ID'),
     targetInputIndex: z.number().describe('Input port index'),
   });

   export const UpdateNodeArgsSchema = z.object({
     nodeId: z.string().describe('Node ID to update'),
     parameters: z.record(z.unknown()).describe('Parameters to update'),
   });

   export const AnnotateNodeArgsSchema = z.object({
     nodeId: z.string().describe('Node ID to annotate'),
     annotation: z.string().describe('Annotation text'),
   });

   export type AddNodeArgs = z.infer<typeof AddNodeArgsSchema>;
   export type RemoveNodeArgs = z.infer<typeof RemoveNodeArgsSchema>;
   export type ConnectNodesArgs = z.infer<typeof ConnectNodesArgsSchema>;
   export type UpdateNodeArgs = z.infer<typeof UpdateNodeArgsSchema>;
   export type AnnotateNodeArgs = z.infer<typeof AnnotateNodeArgsSchema>;
   ```

2. Create graph service для операций
   ```typescript
   // src/renderer/services/graph/graphService.ts
   import { GraphNode, GraphEdge } from '../../types/graph';
   import { useGraphStore } from '../../state/graphState';

   export class GraphService {
     addNode(args: {
       nodeType: string;
       title?: string;
       x?: number;
       y?: number;
       parameters?: Record<string, unknown>;
     }): GraphNode {
       const { nodeType, title, x = 300, y = 200, parameters = {} } = args;

       const node: GraphNode = {
         id: `node-${Date.now()}`,
         type: 'comfy',
         position: { x, y },
         data: {
           comfyType: nodeType,
           title: title || nodeType,
           inputs: this.inferInputs(nodeType),
           outputs: this.inferOutputs(nodeType),
           parameters,
         },
       };

       useGraphStore.getState().addNode(node);
       return node;
     }

     removeNode(nodeId: string): boolean {
       const { nodes } = useGraphStore.getState();
       const exists = nodes.some((n) => n.id === nodeId);
       
       if (exists) {
         useGraphStore.getState().removeNode(nodeId);
         return true;
       }
       return false;
     }

     connectNodes(args: {
       sourceNodeId: string;
       sourceOutputIndex: number;
       targetNodeId: string;
       targetInputIndex: number;
     }): GraphEdge | null {
       const { sourceNodeId, sourceOutputIndex, targetNodeId, targetInputIndex } = args;
       const { nodes } = useGraphStore.getState();

       const sourceNode = nodes.find((n) => n.id === sourceNodeId);
       const targetNode = nodes.find((n) => n.id === targetNodeId);

       if (!sourceNode || !targetNode) {
         console.error('Nodes not found');
         return null;
       }

       const sourceOutput = sourceNode.data.outputs[sourceOutputIndex];
       const targetInput = targetNode.data.inputs[targetInputIndex];

       if (!sourceOutput || !targetInput) {
         console.error('Ports not found');
         return null;
       }

       const edge: GraphEdge = {
         id: `edge-${Date.now()}`,
         source: sourceNodeId,
         target: targetNodeId,
         sourceHandle: sourceOutput.id,
         targetHandle: targetInput.id,
         data: {
           dataType: sourceOutput.dataType,
         },
       };

       useGraphStore.getState().addEdge(edge);
       return edge;
     }

     updateNode(nodeId: string, parameters: Record<string, unknown>): boolean {
       const { nodes } = useGraphStore.getState();
       const exists = nodes.some((n) => n.id === nodeId);

       if (exists) {
         useGraphStore.getState().updateNode(nodeId, { parameters });
         return true;
       }
       return false;
     }

     annotateNode(nodeId: string, annotation: string): boolean {
       const { nodes } = useGraphStore.getState();
       const node = nodes.find((n) => n.id === nodeId);

       if (node) {
         const annotations = node.data.annotations || [];
         useGraphStore.getState().updateNode(nodeId, {
           annotations: [...annotations, annotation],
         });
         return true;
       }
       return false;
     }

     // Helper: infer inputs based on node type
     private inferInputs(nodeType: string) {
       // This will be replaced by MCP discovery
       const inputMap: Record<string, any[]> = {
         KSampler: [
           { id: 'in-0', name: 'model', dataType: 'MODEL', optional: false },
           { id: 'in-1', name: 'positive', dataType: 'CONDITIONING', optional: false },
           { id: 'in-2', name: 'negative', dataType: 'CONDITIONING', optional: false },
           { id: 'in-3', name: 'latent', dataType: 'LATENT', optional: false },
         ],
         VAEDecode: [
           { id: 'in-0', name: 'samples', dataType: 'LATENT', optional: false },
           { id: 'in-1', name: 'vae', dataType: 'VAE', optional: false },
         ],
         SaveImage: [
           { id: 'in-0', name: 'images', dataType: 'IMAGE', optional: false },
         ],
       };

       return inputMap[nodeType] || [];
     }

     // Helper: infer outputs based on node type
     private inferOutputs(nodeType: string) {
       const outputMap: Record<string, any[]> = {
         LoadImage: [
           { id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false },
         ],
         KSampler: [
           { id: 'out-0', name: 'LATENT', dataType: 'LATENT', optional: false },
         ],
         VAEDecode: [
           { id: 'out-0', name: 'IMAGE', dataType: 'IMAGE', optional: false },
         ],
       };

       return outputMap[nodeType] || [];
     }

     // Get current graph state as JSON for context
     getCurrentGraphState(): string {
       const { nodes, edges } = useGraphStore.getState();
       return JSON.stringify({
         nodes: nodes.map((n) => ({
           id: n.id,
           type: n.data.comfyType,
           title: n.data.title,
           parameters: n.data.parameters,
         })),
         edges: edges.map((e) => ({
           id: e.id,
           source: e.source,
           target: e.target,
         })),
       }, null, 2);
     }
   }

   // Singleton
   let graphServiceInstance: GraphService | null = null;

   export function getGraphService(): GraphService {
     if (!graphServiceInstance) {
       graphServiceInstance = new GraphService();
     }
     return graphServiceInstance;
   }
   ```

3. Define tools для AI SDK
   ```typescript
   // src/renderer/services/llm/tools.ts
   import { tool } from 'ai';
   import {
     AddNodeArgsSchema,
     RemoveNodeArgsSchema,
     ConnectNodesArgsSchema,
     UpdateNodeArgsSchema,
     AnnotateNodeArgsSchema,
   } from '../../types/tools';
   import { getGraphService } from '../graph/graphService';

   const graphService = getGraphService();

   export const graphTools = {
     addNode: tool({
       description: 'Add a new node to the ComfyUI workflow graph',
       inputSchema: AddNodeArgsSchema,
       execute: async (args) => {
         const node = graphService.addNode(args);
         return {
           success: true,
           nodeId: node.id,
           message: `Added ${args.nodeType} node with ID ${node.id}`,
         };
       },
     }),

     removeNode: tool({
       description: 'Remove a node from the graph',
       inputSchema: RemoveNodeArgsSchema,
       execute: async (args) => {
         const success = graphService.removeNode(args.nodeId);
         return {
           success,
           message: success
             ? `Removed node ${args.nodeId}`
             : `Node ${args.nodeId} not found`,
         };
       },
     }),

     connectNodes: tool({
       description: 'Connect two nodes by creating an edge between output and input ports',
       inputSchema: ConnectNodesArgsSchema,
       execute: async (args) => {
         const edge = graphService.connectNodes(args);
         return {
           success: !!edge,
           edgeId: edge?.id,
           message: edge
             ? `Connected ${args.sourceNodeId} to ${args.targetNodeId}`
             : 'Failed to connect nodes',
         };
       },
     }),

     updateNode: tool({
       description: 'Update parameters of an existing node',
       inputSchema: UpdateNodeArgsSchema,
       execute: async (args) => {
         const success = graphService.updateNode(args.nodeId, args.parameters);
         return {
           success,
           message: success
             ? `Updated node ${args.nodeId}`
             : `Node ${args.nodeId} not found`,
         };
       },
     }),

     annotateNode: tool({
       description: 'Add an annotation/explanation to a node',
       inputSchema: AnnotateNodeArgsSchema,
       execute: async (args) => {
         const success = graphService.annotateNode(args.nodeId, args.annotation);
         return {
           success,
           message: success
             ? `Annotated node ${args.nodeId}`
             : `Node ${args.nodeId} not found`,
         };
       },
     }),

     getCurrentGraph: tool({
       description: 'Get the current graph state (nodes and connections)',
       inputSchema: z.object({}),
       execute: async () => {
         const state = graphService.getCurrentGraphState();
         return {
           success: true,
           graph: state,
         };
       },
     }),
   };
   ```

4. Update LLM service to use tools
   ```typescript
   // src/renderer/services/llm/llmService.ts (updated)
   import { streamText } from 'ai';
   import { openai } from '@ai-sdk/openai';
   import { LLMConfig, LLMMessage } from '../../types/llm';
   import { graphTools } from './tools';

   export class LLMService {
     // ... previous code ...

     async *streamChat(
       messages: LLMMessage[],
       options?: {
         enableTools?: boolean;
       }
     ): AsyncGenerator<{ type: 'text' | 'tool-call' | 'tool-result'; content: any }, void, unknown> {
       this.abortController = new AbortController();

       try {
         const model = this.getModel();
         
         const result = streamText({
           model,
           messages,
           tools: options?.enableTools ? graphTools : undefined,
           temperature: this.config.temperature,
           maxTokens: this.config.maxTokens,
           abortSignal: this.abortController.signal,
         });

         // Stream text chunks
         for await (const part of result.fullStream) {
           if (part.type === 'text-delta') {
             yield { type: 'text', content: part.textDelta };
           } else if (part.type === 'tool-call') {
             yield { type: 'tool-call', content: part };
           } else if (part.type === 'tool-result') {
             yield { type: 'tool-result', content: part };
           }
         }
       } catch (error) {
         if ((error as any).name === 'AbortError') {
           console.log('Stream aborted');
         } else {
           console.error('LLM stream error:', error);
           throw error;
         }
       } finally {
         this.abortController = null;
       }
     }

     // ... rest of class ...
   }
   ```

5. Update App.tsx to handle tool calls
   ```typescript
   // src/renderer/App.tsx (updated handleSendMessage)
   const handleSendMessage = async (content: string) => {
     const userMessageId = Date.now().toString();
     addMessage({
       id: userMessageId,
       role: 'user',
       content,
       timestamp: Date.now(),
     });

     setStreaming(true);
     const assistantMessageId = (Date.now() + 1).toString();
     let assistantContent = '';
     const toolCalls: any[] = [];

     try {
       const llmService = getLLMService(llmConfig);
       
       // Include current graph state in system message
       const graphService = getGraphService();
       const graphState = graphService.getCurrentGraphState();
       
       const messages = [
         {
           role: 'system' as const,
           content: `You are a helpful assistant for building ComfyUI workflows.
Current graph state:
${graphState}

You can use tools to modify the graph. When the user asks to add nodes or make connections, use the appropriate tools.`,
         },
         { role: 'user' as const, content },
       ];

       addMessage({
         id: assistantMessageId,
         role: 'assistant',
         content: '',
         timestamp: Date.now(),
         toolCalls: [],
       });

       for await (const chunk of llmService.streamChat(messages, { enableTools: true })) {
         if (chunk.type === 'text') {
           assistantContent += chunk.content;
         } else if (chunk.type === 'tool-call') {
           toolCalls.push({
             id: chunk.content.toolCallId,
             name: chunk.content.toolName,
             arguments: chunk.content.args,
             status: 'pending',
           });
         } else if (chunk.type === 'tool-result') {
           const idx = toolCalls.findIndex((t) => t.id === chunk.content.toolCallId);
           if (idx >= 0) {
             toolCalls[idx].result = chunk.content.result;
             toolCalls[idx].status = 'success';
           }
         }

         useChatStore.setState((state) => ({
           messages: state.messages.map((msg) =>
             msg.id === assistantMessageId
               ? { ...msg, content: assistantContent, toolCalls: [...toolCalls] }
               : msg
           ),
         }));
       }
     } catch (error) {
       console.error('LLM error:', error);
       addMessage({
         id: (Date.now() + 2).toString(),
         role: 'assistant',
         content: `Error: ${(error as Error).message}`,
         timestamp: Date.now(),
       });
     } finally {
       setStreaming(false);
     }
   };
   ```

**Test command:**
```bash
npm run dev
# Try: "Add a KSampler node"
# Try: "Connect node-xxx to node-yyy"
```

**Acceptance:** 
- LLM может вызвать tools для добавления nodes
- Tool calls отображаются в chat
- Nodes appear на graph canvas в реальном времени

---

## PHASE 5: Conflict Detection + Pause/Resume

### Task 5.1: Graph revision tracking

**Цель:** Track graph revisions для conflict detection

**Шаги:**

1. Create revision types
   ```typescript
   // src/renderer/types/revisions.ts
   export interface GraphRevision {
     id: string;
     timestamp: number;
     nodes: any[]; // GraphNode[]
     edges: any[]; // GraphEdge[]
     parentRevisionId?: string;
     description?: string;
     source: 'user' | 'ai' | 'import';
   }
   ```

2. Create revision store
   ```typescript
   // src/renderer/state/revisionState.ts
   import { create } from 'zustand';
   import { GraphRevision } from '../types/revisions';

   interface RevisionState {
     revisions: GraphRevision[];
     currentRevisionId: string | null;
     
     addRevision: (revision: GraphRevision) => void;
     getRevision: (id: string) => GraphRevision | undefined;
     getCurrentRevision: () => GraphRevision | undefined;
   }

   export const useRevisionStore = create<RevisionState>((set, get) => ({
     revisions: [],
     currentRevisionId: null,

     addRevision: (revision) =>
       set((state) => ({
         revisions: [...state.revisions, revision],
         currentRevisionId: revision.id,
       })),

     getRevision: (id) => {
       const state = get();
       return state.revisions.find((r) => r.id === id);
     },

     getCurrentRevision: () => {
       const state = get();
       return state.currentRevisionId
         ? state.revisions.find((r) => r.id === state.currentRevisionId)
         : undefined;
     },
   }));
   ```

3. Create revision tracking service
   ```typescript
   // src/renderer/services/graph/revisions.ts
   import { useGraphStore } from '../../state/graphState';
   import { useRevisionStore } from '../../state/revisionState';
   import { GraphRevision } from '../../types/revisions';

   export class RevisionService {
     createRevision(source: 'user' | 'ai' | 'import', description?: string): GraphRevision {
       const { nodes, edges } = useGraphStore.getState();
       const { currentRevisionId } = useRevisionStore.getState();

       const revision: GraphRevision = {
         id: `rev-${Date.now()}`,
         timestamp: Date.now(),
         nodes: JSON.parse(JSON.stringify(nodes)), // Deep copy
         edges: JSON.parse(JSON.stringify(edges)),
         parentRevisionId: currentRevisionId || undefined,
         description,
         source,
       };

       useRevisionStore.getState().addRevision(revision);
       return revision;
     }

     restoreRevision(revisionId: string): boolean {
       const revision = useRevisionStore.getState().getRevision(revisionId);
       
       if (!revision) {
         console.error(`Revision ${revisionId} not found`);
         return false;
       }

       useGraphStore.setState({
         nodes: JSON.parse(JSON.stringify(revision.nodes)),
         edges: JSON.parse(JSON.stringify(revision.edges)),
       });

       return true;
     }

     hasChangedSince(revisionId: string): boolean {
       const revision = useRevisionStore.getState().getRevision(revisionId);
       if (!revision) return true;

       const { nodes, edges } = useGraphStore.getState();
       
       return (
         JSON.stringify(nodes) !== JSON.stringify(revision.nodes) ||
         JSON.stringify(edges) !== JSON.stringify(revision.edges)
       );
     }
   }

   let revisionServiceInstance: RevisionService | null = null;

   export function getRevisionService(): RevisionService {
     if (!revisionServiceInstance) {
       revisionServiceInstance = new RevisionService();
     }
     return revisionServiceInstance;
   }
   ```

4. Update graph service to track revisions
   ```typescript
   // src/renderer/services/graph/graphService.ts (updated)
   import { getRevisionService } from './revisions';

   export class GraphService {
     private revisionService = getRevisionService();

     addNode(args: any): GraphNode {
       // Create revision BEFORE change
       this.revisionService.createRevision('ai', `Add ${args.nodeType} node`);

       // ... existing addNode code ...
       
       return node;
     }

     // Similar for other operations
   }
   ```

**Test command:**
```bash
npm run dev
# Add some nodes through chat
# Check that revisions are being created
```

**Acceptance:** Каждая операция создаёт revision, можно восстановить предыдущее состояние

---

### Task 5.2: Conflict detection

**Цель:** Detect conflicts между user edits и AI operations

**Шаги:**

1. Create action executor types
   ```typescript
   // src/renderer/types/actions.ts
   export interface GraphAction {
     id: string;
     type: 'add-node' | 'remove-node' | 'add-edge' | 'remove-edge' | 'update-node';
     timestamp: number;
     beforeRevisionId: string;
     afterRevisionId?: string;
     payload: any;
     source: 'user' | 'ai';
     status: 'pending' | 'applied' | 'failed' | 'conflict';
     error?: string;
   }
   ```

2. Create action executor
   ```typescript
   // src/renderer/services/actions/actionExecutor.ts
   import { GraphAction } from '../../types/actions';
   import { getRevisionService } from '../graph/revisions';

   export class ActionExecutor {
     private revisionService = getRevisionService();
     private actionQueue: GraphAction[] = [];
     private isExecuting = false;

     async queueAction(action: GraphAction): Promise<void> {
       this.actionQueue.push(action);
       
       if (!this.isExecuting) {
         await this.processQueue();
       }
     }

     private async processQueue(): Promise<void> {
       this.isExecuting = true;

       while (this.actionQueue.length > 0) {
         const action = this.actionQueue.shift()!;
         
         // Check for conflicts
         const hasConflict = this.revisionService.hasChangedSince(action.beforeRevisionId);
         
         if (hasConflict) {
           action.status = 'conflict';
           action.error = 'Graph state changed since action was queued';
           console.warn('Conflict detected:', action);
           
           // Notify user
           this.notifyConflict(action);
           continue;
         }

         try {
           // Apply action
           await this.executeAction(action);
           action.status = 'applied';
         } catch (error) {
           action.status = 'failed';
           action.error = (error as Error).message;
           console.error('Action failed:', error);
         }
       }

       this.isExecuting = false;
     }

     private async executeAction(action: GraphAction): Promise<void> {
       // Execute the actual graph operation
       // This will be implemented based on action.type and action.payload
       console.log('Executing action:', action);
     }

     private notifyConflict(action: GraphAction): void {
       // Show conflict notification to user
       console.warn('Conflict:', action);
       
       // Could show a toast/modal with options:
       // - Discard AI change
       // - Apply AI change anyway
       // - Merge (if possible)
     }

     pause(): void {
       this.isExecuting = false;
     }

     resume(): void {
       if (!this.isExecuting && this.actionQueue.length > 0) {
         this.processQueue();
       }
     }

     clearQueue(): void {
       this.actionQueue = [];
     }
   }

   let actionExecutorInstance: ActionExecutor | null = null;

   export function getActionExecutor(): ActionExecutor {
     if (!actionExecutorInstance) {
       actionExecutorInstance = new ActionExecutor();
     }
     return actionExecutorInstance;
   }
   ```

3. Integrate with graph operations
   ```typescript
   // Update tools to use action executor
   // src/renderer/services/llm/tools.ts (updated)
   import { getActionExecutor } from '../actions/actionExecutor';
   import { getRevisionService } from '../graph/revisions';

   export const graphTools = {
     addNode: tool({
       description: 'Add a new node to the ComfyUI workflow graph',
       inputSchema: AddNodeArgsSchema,
       execute: async (args) => {
         const revisionService = getRevisionService();
         const currentRevision = revisionService.createRevision('ai', 'Before add node');

         const action: GraphAction = {
           id: `action-${Date.now()}`,
           type: 'add-node',
           timestamp: Date.now(),
           beforeRevisionId: currentRevision.id,
           payload: args,
           source: 'ai',
           status: 'pending',
         };

         const executor = getActionExecutor();
         await executor.queueAction(action);

         if (action.status === 'conflict') {
           return {
             success: false,
             conflict: true,
             message: action.error,
           };
         }

         const node = graphService.addNode(args);
         action.afterRevisionId = revisionService.createRevision('ai', `Added ${args.nodeType}`).id;

         return {
           success: true,
           nodeId: node.id,
           message: `Added ${args.nodeType} node with ID ${node.id}`,
         };
       },
     }),
     // ... other tools similarly updated
   };
   ```

4. Add pause/resume UI controls
   ```typescript
   // Update ChatPanel to show pause button and conflict warnings
   // Show warning icon for conflicted messages
   ```

**Test command:**
```bash
npm run dev
# 1. Send message to AI to add a node
# 2. While AI is "thinking", manually delete a node
# 3. AI should detect conflict
```

**Acceptance:** Conflicts детектируются и сообщаются пользователю, не перезаписывают ручные изменения

---

## PHASE 6: ComfyUI JSON Import/Export

### Task 6.1: ComfyUI type definitions

**Цель:** Define types для ComfyUI JSON formats

**Шаги:**

1. Create ComfyUI types (already defined in design doc)
   ```typescript
   // src/renderer/types/comfyui.ts
   // Copy from design doc
   ```

2. Save test fixtures
   ```bash
   # Download sample ComfyUI workflows from official repo
   # or create minimal examples
   ```

**Acceptance:** Types defined, fixtures saved

---

### Task 6.2: Import service

**Цель:** Import ComfyUI workflow JSON

**Шаги:**

1. Create import service
   ```typescript
   // src/renderer/services/graph/comfyImport.ts
   import { ComfyUIWorkflow, ComfyUINode, ComfyUILink } from '../../types/comfyui';
   import { GraphNode, GraphEdge } from '../../types/graph';

   export interface ImportResult {
     nodes: GraphNode[];
     edges: GraphEdge[];
     warnings: string[];
     unknownNodeTypes: string[];
   }

   export class ComfyImportService {
     import(workflow: ComfyUIWorkflow): ImportResult {
       const warnings: string[] = [];
       const unknownNodeTypes = new Set<string>();

       // Convert nodes
       const nodes: GraphNode[] = workflow.nodes.map((comfyNode) => {
         const nodeType = comfyNode.type;
         
         // Check if node type is known (from MCP or hardcoded catalog)
         const isKnown = this.isKnownNodeType(nodeType);
         if (!isKnown) {
           unknownNodeTypes.add(nodeType);
           warnings.push(`Unknown node type: ${nodeType}`);
         }

         return {
           id: String(comfyNode.id),
           type: 'comfy',
           position: { x: comfyNode.pos[0], y: comfyNode.pos[1] },
           data: {
             comfyType: nodeType,
             title: comfyNode.properties?.title || nodeType,
             inputs: this.extractInputs(comfyNode),
             outputs: this.extractOutputs(comfyNode),
             parameters: this.extractParameters(comfyNode),
             // Preserve ALL original data
             comfyData: comfyNode,
           },
         };
       });

       // Convert links
       const edges: GraphEdge[] = workflow.links.map((link) => ({
         id: `edge-${link.id}`,
         source: String(link.origin_id),
         target: String(link.target_id),
         sourceHandle: `out-${link.origin_slot}`,
         targetHandle: `in-${link.target_slot}`,
         data: {
           dataType: link.type,
           comfyData: link,
         },
       }));

       return {
         nodes,
         edges,
         warnings,
         unknownNodeTypes: Array.from(unknownNodeTypes),
       };
     }

     private isKnownNodeType(type: string): boolean {
       // Hardcoded for now, will use MCP later
       const knownTypes = ['KSampler', 'LoadImage', 'SaveImage', 'VAEDecode', 'VAEEncode'];
       return knownTypes.includes(type);
     }

     private extractInputs(node: ComfyUINode) {
       // Extract from node.inputs or infer
       return node.inputs?.map((input, idx) => ({
         id: `in-${idx}`,
         name: input.name || `input_${idx}`,
         dataType: input.type || 'unknown',
         optional: false,
       })) || [];
     }

     private extractOutputs(node: ComfyUINode) {
       return node.outputs?.map((output, idx) => ({
         id: `out-${idx}`,
         name: output.name || `output_${idx}`,
         dataType: output.type || 'unknown',
         optional: false,
       })) || [];
     }

     private extractParameters(node: ComfyUINode) {
       return node.widgets_values || node.properties || {};
     }
   }

   export const comfyImportService = new ComfyImportService();
   ```

2. Add file import IPC
   ```typescript
   // src/main/ipc.ts
   import { ipcMain, dialog } from 'electron';
   import * as fs from 'fs';
   import { IPC_CHANNELS } from '../shared/ipc-channels';

   export function setupIPC() {
     ipcMain.handle(IPC_CHANNELS.FILE_IMPORT_WORKFLOW, async () => {
       const result = await dialog.showOpenDialog({
         filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
         properties: ['openFile'],
       });

       if (result.canceled || result.filePaths.length === 0) {
         return null;
       }

       const filePath = result.filePaths[0];
       const content = fs.readFileSync(filePath, 'utf-8');
       return JSON.parse(content);
     });
   }
   ```

3. Wire up import in renderer
   ```typescript
   // Add import button to App.tsx
   const handleImport = async () => {
     const workflow = await (window as any).electronAPI.importWorkflow();
     if (workflow) {
       const result = comfyImportService.import(workflow);
       useGraphStore.setState({ nodes: result.nodes, edges: result.edges });
       
       if (result.warnings.length > 0) {
         console.warn('Import warnings:', result.warnings);
         // Show warnings to user
       }
     }
   };
   ```

**Test command:**
```bash
npm run dev
# Click "Import" button
# Select a ComfyUI workflow JSON file
# Verify nodes appear on canvas
```

**Acceptance:** Может импортировать ComfyUI workflow JSON, nodes отображаются на canvas

---

### Task 6.3: Export service

**Цель:** Export graph to ComfyUI JSON

**Шаги:**

1. Create export service
   ```typescript
   // src/renderer/services/graph/comfyExport.ts
   import { ComfyUIWorkflow, ComfyUINode, ComfyUILink } from '../../types/comfyui';
   import { GraphNode, GraphEdge } from '../../types/graph';

   export class ComfyExportService {
     export(nodes: GraphNode[], edges: GraphEdge[]): ComfyUIWorkflow {
       // Convert internal nodes back to ComfyUI format
       const comfyNodes: ComfyUINode[] = nodes.map((node, index) => {
         // Restore original ComfyUI data if available
         const comfyData = node.data.comfyData as any;
         
         return {
           id: parseInt(node.id.replace('node-', ''), 10) || index + 1,
           type: node.data.comfyType,
           pos: [node.position.x, node.position.y],
           size: comfyData?.size || [200, 100],
           flags: comfyData?.flags || {},
           order: comfyData?.order || index,
           mode: comfyData?.mode || 0,
           outputs: node.data.outputs.map((output) => ({
             name: output.name,
             type: output.dataType,
             links: [], // Will be filled from edges
           })),
           inputs: node.data.inputs.map((input) => ({
             name: input.name,
             type: input.dataType,
             link: null, // Will be filled from edges
           })),
           properties: {
             ...comfyData?.properties,
             title: node.data.title,
           },
           widgets_values: Object.values(node.data.parameters),
           // Preserve any other original fields
           ...comfyData,
         };
       });

       // Convert edges to links
       const comfyLinks: ComfyUILink[] = edges.map((edge, index) => {
         const comfyData = edge.data?.comfyData as any;
         
         return {
           id: parseInt(edge.id.replace('edge-', ''), 10) || index + 1,
           origin_id: parseInt(edge.source.replace('node-', ''), 10),
           origin_slot: parseInt(edge.sourceHandle?.replace('out-', '') || '0', 10),
           target_id: parseInt(edge.target.replace('node-', ''), 10),
           target_slot: parseInt(edge.targetHandle?.replace('in-', '') || '0', 10),
           type: edge.data.dataType,
           // Preserve original data
           ...comfyData,
         };
       });

       return {
         version: '1.0',
         nodes: comfyNodes,
         links: comfyLinks,
         groups: [],
         config: {},
         extra: {},
       };
     }
   }

   export const comfyExportService = new ComfyExportService();
   ```

2. Add file export IPC
   ```typescript
   // src/main/ipc.ts (add export handler)
   ipcMain.handle(IPC_CHANNELS.FILE_EXPORT_WORKFLOW, async (event, workflow) => {
     const result = await dialog.showSaveDialog({
       filters: [{ name: 'ComfyUI Workflow', extensions: ['json'] }],
       defaultPath: 'workflow.json',
     });

     if (result.canceled || !result.filePath) {
       return false;
     }

     fs.writeFileSync(result.filePath, JSON.stringify(workflow, null, 2), 'utf-8');
     return true;
   });
   ```

3. Wire up export in renderer
   ```typescript
   // Add export button
   const handleExport = async () => {
     const { nodes, edges } = useGraphStore.getState();
     const workflow = comfyExportService.export(nodes, edges);
     const success = await (window as any).electronAPI.exportWorkflow(workflow);
     
     if (success) {
       console.log('Exported successfully');
     }
   };
   ```

**Test command:**
```bash
npm run dev
# Create some nodes
# Click "Export" button
# Save file
# Re-import file → verify roundtrip
```

**Acceptance:** Может экспортировать граф в ComfyUI JSON, roundtrip import→export→import сохраняет данные

---

## PHASE 7: MCP Client Integration

### Task 7.1: Mock MCP server для testing

**Цель:** Create mock MCP server для offline development

**Шаги:**

1. Create mock server
   ```typescript
   // src/renderer/services/mcp/mockServer.ts
   export interface MockMCPServer {
     listTools(): Promise<{ tools: Array<{ name: string; description: string; inputSchema: any }> }>;
     callTool(args: { name: string; arguments: any }): Promise<{ content: any[] }>;
     listResources(): Promise<{ resources: Array<{ uri: string; name: string }> }>;
     readResource(args: { uri: string }): Promise<{ contents: any[] }>;
   }

   export class MockComfyUIMCPServer implements MockMCPServer {
     private nodeTypes = {
       KSampler: {
         input_types: {
           model: { type: 'MODEL', optional: false },
           positive: { type: 'CONDITIONING', optional: false },
           negative: { type: 'CONDITIONING', optional: false },
           latent: { type: 'LATENT', optional: false },
         },
         output_types: ['LATENT'],
         category: 'sampling',
         description: 'KSampler node for generating images',
       },
       LoadImage: {
         input_types: {},
         output_types: ['IMAGE'],
         category: 'image',
         description: 'Load an image',
       },
       SaveImage: {
         input_types: {
           images: { type: 'IMAGE', optional: false },
         },
         output_types: [],
         category: 'image',
         description: 'Save an image',
       },
       VAEDecode: {
         input_types: {
           samples: { type: 'LATENT', optional: false },
           vae: { type: 'VAE', optional: false },
         },
         output_types: ['IMAGE'],
         category: 'latent',
       },
     };

     async listTools() {
       return {
         tools: [
           {
             name: 'get-node-info',
             description: 'Get information about a ComfyUI node type',
             inputSchema: {
               type: 'object',
               properties: {
                 node_type: { type: 'string' },
               },
               required: ['node_type'],
             },
           },
           {
             name: 'list-node-types',
             description: 'List all available ComfyUI node types',
             inputSchema: { type: 'object', properties: {} },
           },
         ],
       };
     }

     async callTool(args: { name: string; arguments: any }) {
       if (args.name === 'get-node-info') {
         const nodeType = args.arguments.node_type;
         const info = this.nodeTypes[nodeType as keyof typeof this.nodeTypes];
         
         if (!info) {
           return {
             content: [
               {
                 type: 'text',
                 text: JSON.stringify({ error: `Unknown node type: ${nodeType}` }),
               },
             ],
           };
         }

         return {
           content: [
             {
               type: 'text',
               text: JSON.stringify(info),
             },
           ],
         };
       }

       if (args.name === 'list-node-types') {
         return {
           content: [
             {
               type: 'text',
               text: JSON.stringify(Object.keys(this.nodeTypes)),
             },
           ],
         };
       }

       return { content: [] };
     }

     async listResources() {
       return {
         resources: [
           { uri: 'comfyui://nodes', name: 'Available Nodes' },
           { uri: 'comfyui://models', name: 'Available Models' },
         ],
       };
     }

     async readResource(args: { uri: string }) {
       if (args.uri === 'comfyui://nodes') {
         return {
           contents: [
             {
               uri: args.uri,
               mimeType: 'application/json',
               text: JSON.stringify(this.nodeTypes),
             },
           ],
         };
       }

       return { contents: [] };
     }
   }

   export const mockMCPServer = new MockComfyUIMCPServer();
   ```

**Acceptance:** Mock server возвращает node info

---

### Task 7.2: MCP client wrapper

**Цель:** Wrap official MCP client

**Шаги:**

1. Install MCP client
   ```bash
   npm install @modelcontextprotocol/client
   ```

2. Create MCP service
   ```typescript
   // src/renderer/services/mcp/mcpClient.ts
   import { Client, StdioClientTransport } from '@modelcontextprotocol/client';
   import { mockMCPServer } from './mockServer';

   export interface MCPConfig {
     mode: 'mock' | 'stdio' | 'http';
     command?: string;
     args?: string[];
     url?: string;
   }

   export class MCPService {
     private client: Client | null = null;
     private config: MCPConfig;
     private useMock: boolean;

     constructor(config: MCPConfig) {
       this.config = config;
       this.useMock = config.mode === 'mock';
     }

     async connect(): Promise<void> {
       if (this.useMock) {
         console.log('Using mock MCP server');
         return;
       }

       this.client = new Client({ name: 'comfyui-desktop', version: '1.0.0' });

       if (this.config.mode === 'stdio') {
         const transport = new StdioClientTransport({
           command: this.config.command!,
           args: this.config.args || [],
         });
         await this.client.connect(transport);
       }
       // Add HTTP transport when needed
     }

     async disconnect(): Promise<void> {
       if (this.client) {
         await this.client.close();
         this.client = null;
       }
     }

     async listTools() {
       if (this.useMock) {
         return mockMCPServer.listTools();
       }
       return this.client!.listTools();
     }

     async callTool(name: string, args: any) {
       if (this.useMock) {
         return mockMCPServer.callTool({ name, arguments: args });
       }
       return this.client!.callTool({ name, arguments: args });
     }

     async getNodeInfo(nodeType: string) {
       const result = await this.callTool('get-node-info', { node_type: nodeType });
       const text = result.content[0]?.text;
       return text ? JSON.parse(text) : null;
     }

     async listNodeTypes() {
       const result = await this.callTool('list-node-types', {});
       const text = result.content[0]?.text;
       return text ? JSON.parse(text) : [];
     }
   }

   let mcpServiceInstance: MCPService | null = null;

   export function getMCPService(config?: MCPConfig): MCPService {
     if (!mcpServiceInstance && config) {
       mcpServiceInstance = new MCPService(config);
     }
     return mcpServiceInstance!;
   }
   ```

3. Use MCP in graph service
   ```typescript
   // Update graphService to query MCP for node info
   private async inferInputs(nodeType: string) {
     try {
       const mcpService = getMCPService();
       const nodeInfo = await mcpService.getNodeInfo(nodeType);
       
       if (nodeInfo && nodeInfo.input_types) {
         return Object.entries(nodeInfo.input_types).map(([name, info]: [string, any], idx) => ({
           id: `in-${idx}`,
           name,
           dataType: info.type,
           optional: info.optional || false,
         }));
       }
     } catch (error) {
       console.warn('Failed to get node info from MCP:', error);
     }

     // Fallback to hardcoded
     return this.hardcodedInputs(nodeType);
   }
   ```

**Test command:**
```bash
npm run dev
# Try adding a node type
# Verify MCP is queried (mock mode)
```

**Acceptance:** MCP service подключается (mock mode), возвращает node info

---

## PHASE 8: Persistence Layer

### Task 8.1: Database setup

**Цель:** Setup SQLite database

**Шаги:**

1. Install better-sqlite3
   ```bash
   npm install better-sqlite3
   npm install --save-dev @types/better-sqlite3
   ```

2. Create database service
   ```typescript
   // src/main/database.ts
   import Database from 'better-sqlite3';
   import * as path from 'path';
   import { app } from 'electron';

   let db: Database.Database | null = null;

   export function initDatabase() {
     const dbPath = path.join(app.getPath('userData'), 'comfyui-desktop.db');
     db = new Database(dbPath);

     // Create tables
     db.exec(`
       CREATE TABLE IF NOT EXISTS projects (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         updated_at INTEGER NOT NULL,
         graph_data TEXT,
         metadata TEXT
       );

       CREATE TABLE IF NOT EXISTS chat_messages (
         id TEXT PRIMARY KEY,
         project_id TEXT NOT NULL,
         role TEXT NOT NULL,
         content TEXT NOT NULL,
         timestamp INTEGER NOT NULL,
         graph_revision_id TEXT,
         tool_calls TEXT,
         FOREIGN KEY (project_id) REFERENCES projects(id)
       );

       CREATE TABLE IF NOT EXISTS graph_revisions (
         id TEXT PRIMARY KEY,
         project_id TEXT NOT NULL,
         timestamp INTEGER NOT NULL,
         nodes TEXT NOT NULL,
         edges TEXT NOT NULL,
         parent_revision_id TEXT,
         description TEXT,
         source TEXT NOT NULL,
         FOREIGN KEY (project_id) REFERENCES projects(id)
       );

       CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id);
       CREATE INDEX IF NOT EXISTS idx_revisions_project ON graph_revisions(project_id);
     `);

     console.log('Database initialized at', dbPath);
   }

   export function getDatabase(): Database.Database {
     if (!db) {
       throw new Error('Database not initialized');
     }
     return db;
   }

   export function closeDatabase() {
     if (db) {
       db.close();
       db = null;
     }
   }
   ```

3. Update main process to initialize DB
   ```typescript
   // src/main/index.ts (updated)
   import { initDatabase, closeDatabase } from './database';

   app.whenReady().then(() => {
     initDatabase();
     createWindow();
   });

   app.on('quit', () => {
     closeDatabase();
   });
   ```

**Test command:**
```bash
npm run dev
# Check that DB file is created in userData directory
```

**Acceptance:** SQLite база создаётся, tables exist

---

### Task 8.2: Project persistence

**Цель:** Save/load projects

**Шаги:**

1. Create project store operations
   ```typescript
   // src/main/stores/projectStore.ts
   import { getDatabase } from '../database';

   export interface Project {
     id: string;
     name: string;
     created_at: number;
     updated_at: number;
     graph_data: { nodes: any[]; edges: any[] };
     metadata: Record<string, unknown>;
   }

   export class ProjectStore {
     save(project: Project): void {
       const db = getDatabase();
       const stmt = db.prepare(`
         INSERT OR REPLACE INTO projects (id, name, created_at, updated_at, graph_data, metadata)
         VALUES (?, ?, ?, ?, ?, ?)
       `);

       stmt.run(
         project.id,
         project.name,
         project.created_at,
         project.updated_at,
         JSON.stringify(project.graph_data),
         JSON.stringify(project.metadata)
       );
     }

     load(id: string): Project | null {
       const db = getDatabase();
       const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
       const row = stmt.get(id) as any;

       if (!row) return null;

       return {
         id: row.id,
         name: row.name,
         created_at: row.created_at,
         updated_at: row.updated_at,
         graph_data: JSON.parse(row.graph_data),
         metadata: JSON.parse(row.metadata),
       };
     }

     list(): Project[] {
       const db = getDatabase();
       const stmt = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
       const rows = stmt.all() as any[];

       return rows.map((row) => ({
         id: row.id,
         name: row.name,
         created_at: row.created_at,
         updated_at: row.updated_at,
         graph_data: JSON.parse(row.graph_data),
         metadata: JSON.parse(row.metadata),
       }));
     }

     delete(id: string): void {
       const db = getDatabase();
       const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
       stmt.run(id);
     }
   }

   export const projectStore = new ProjectStore();
   ```

2. Add IPC handlers
   ```typescript
   // src/main/ipc.ts (updated)
   import { projectStore } from './stores/projectStore';

   export function setupIPC() {
     // ... existing handlers ...

     ipcMain.handle(IPC_CHANNELS.DB_SAVE_PROJECT, async (event, project) => {
       projectStore.save(project);
       return { success: true };
     });

     ipcMain.handle(IPC_CHANNELS.DB_LOAD_PROJECT, async (event, id) => {
       return projectStore.load(id);
     });

     ipcMain.handle(IPC_CHANNELS.DB_LIST_PROJECTS, async () => {
       return projectStore.list();
     });
   }
   ```

3. Wire up in renderer
   ```typescript
   // Add project management UI
   // Auto-save on graph changes
   ```

**Test command:**
```bash
npm run dev
# Create a project with some nodes
# Close app
# Reopen app
# Verify project is restored
```

**Acceptance:** Projects сохраняются и восстанавливаются при перезапуске

---

## PHASE 9: Tests + Polish

### Task 9.1: Unit tests

**Цель:** Write unit tests для core services

**Шаги:**

1. Install Jest
   ```bash
   npm install --save-dev jest ts-jest @types/jest
   ```

2. Configure Jest
   ```json
   // jest.config.js
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'jsdom',
     roots: ['<rootDir>/tests'],
     moduleNameMapper: {
       '^@/(.*)$': '<rootDir>/src/$1',
     },
   };
   ```

3. Write tests
   ```typescript
   // tests/unit/graphService.test.ts
   import { GraphService } from '../../src/renderer/services/graph/graphService';

   describe('GraphService', () => {
     let service: GraphService;

     beforeEach(() => {
       service = new GraphService();
     });

     test('addNode creates a node', () => {
       const node = service.addNode({ nodeType: 'KSampler' });
       expect(node).toBeDefined();
       expect(node.data.comfyType).toBe('KSampler');
     });

     // More tests...
   });
   ```

4. Write tests для import/export roundtrip
   ```typescript
   // tests/integration/comfyRoundtrip.test.ts
   import { comfyImportService } from '../../src/renderer/services/graph/comfyImport';
   import { comfyExportService } from '../../src/renderer/services/graph/comfyExport';
   import * as fs from 'fs';

   describe('ComfyUI JSON roundtrip', () => {
     test('import and export preserves data', () => {
       const originalWorkflow = JSON.parse(
         fs.readFileSync('tests/fixtures/comfyui/sample-workflow.json', 'utf-8')
       );

       const importResult = comfyImportService.import(originalWorkflow);
       const exported = comfyExportService.export(importResult.nodes, importResult.edges);

       // Compare key fields
       expect(exported.nodes.length).toBe(originalWorkflow.nodes.length);
       expect(exported.links.length).toBe(originalWorkflow.links.length);
     });
   });
   ```

**Test command:**
```bash
npm test
```

**Acceptance:** Core tests pass

---

### Task 9.2: End-to-end scenario

**Цель:** Create deterministic E2E test

**Шаги:**

1. Create E2E test script
   ```typescript
   // tests/e2e/basicWorkflow.test.ts
   // Test: User asks AI to create a simple workflow
   // AI uses tools to add nodes and connect them
   // Result is exported and validated
   ```

2. Mock LLM responses
   ```typescript
   // Use deterministic mock responses instead of real LLM
   // Verify that tools are called correctly
   ```

**Acceptance:** E2E scenario проходит без реального LLM API key

---

### Task 9.3: Polish and documentation

**Цель:** Final polish

**Шаги:**

1. Add loading states
2. Error boundaries
3. Better styling (Tailwind CSS or basic CSS)
4. README with:
   - Installation instructions
   - How to run
   - How to configure LLM provider
   - How to configure MCP (mock vs real)
   - Architecture overview
5. Save screenshot artifacts
6. Create verification report

**Acceptance:** App выглядит прилично, документация complete

---

## Verification Commands

### Build
```bash
npm run build
```

### Type check
```bash
npm run type-check
```

### Tests
```bash
npm test
```

### Run app
```bash
npm run dev
```

### Manual verification scenarios

1. **Graph editing**
   - Add node manually → verify появляется
   - Delete node → verify удаляется
   - Connect nodes → verify edge создаётся

2. **Chat + LLM tools**
   - Send "Add a KSampler node" → verify LLM adds node via tool
   - Send "Connect node X to node Y" → verify connection created

3. **Conflict detection**
   - Start AI operation → manually edit graph → verify conflict detected

4. **Import/Export**
   - Import ComfyUI workflow → verify nodes appear
   - Export → re-import → verify roundtrip

5. **Persistence**
   - Create project → save → close app → reopen → verify restored

6. **MCP (mock mode)**
   - Ask about node types → verify mock returns data

## Implementation Progress Tracking

| Phase | Status | Notes |
|-------|--------|-------|
| 1.1 Project setup | ⏳ Not started | |
| 1.2 Electron main | ⏳ Not started | |
| 1.3 React renderer | ⏳ Not started | |
| 2.1 React Flow setup | ⏳ Not started | |
| 2.2 Graph state | ⏳ Not started | |
| 3.1 Chat UI | ⏳ Not started | |
| 3.2 LLM integration | ⏳ Not started | |
| 4.1 Graph tools | ⏳ Not started | |
| 5.1 Revision tracking | ⏳ Not started | |
| 5.2 Conflict detection | ⏳ Not started | |
| 6.1 ComfyUI types | ⏳ Not started | |
| 6.2 Import service | ⏳ Not started | |
| 6.3 Export service | ⏳ Not started | |
| 7.1 Mock MCP | ⏳ Not started | |
| 7.2 MCP client | ⏳ Not started | |
| 8.1 Database | ⏳ Not started | |
| 8.2 Project persistence | ⏳ Not started | |
| 9.1 Unit tests | ⏳ Not started | |
| 9.2 E2E tests | ⏳ Not started | |
| 9.3 Polish | ⏳ Not started | |

## Expected Deliverables

1. **Source code:**
   - `/workspace/` — полный исходный код
   - Все модули из плана реализованы

2. **Documentation:**
   - `/workspace/docs/superpowers/plans/2026-11-07-comfyui-desktop.md` — этот файл
   - `/workspace/docs/superpowers/specs/2026-11-07-comfyui-desktop-design.md` — design spec
   - `/workspace/README.md` — how to run и use
   - `/workspace/docs/decisions/` — ADRs

3. **Tests:**
   - Unit tests в `/workspace/tests/unit/`
   - Integration tests в `/workspace/tests/integration/`
   - Fixtures в `/workspace/tests/fixtures/`

4. **Artifacts:**
   - Screenshot приложения → `/opt/cursor/artifacts/app-screenshot.png`
   - Verification report → saved here and in artifacts

5. **Russian report:**
   - План: этот файл
   - Source repo/draft: link к Origin draft
   - Что работает vs не реализовано
   - Exact verification results
   - Linux packaging state
   - Limitations
   - Next steps

---

**Версия:** 1.0  
**Последнее обновление:** 2026-11-07  
**Estimated effort:** 9-10 дней работы для полного MVP  
**Target для этого run:** Максимально возможный прогресс через все phases
