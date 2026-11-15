/**
 * The shared contracts in one import: the types and constants main, preload and the renderer exchange over IPC
 * (objects, knowledge, proposals, agent, revisions, MCP sign-in, model log, pickers, project file), plus the
 * helpers for subgraphs they need. Code may import from here or from the single file it needs.
 */
export * from './objects';
export * from './knowledge';
export * from './proposals';
export * from './agent';
export * from './agentTools';
export * from './revisions';
export * from './mcpAuth';
export * from './modelLog';
export {
  SUBGRAPH_INPUT_NODE_ID,
  SUBGRAPH_OUTPUT_NODE_ID,
  SUBGRAPH_INSTANCE_KIND,
  instancePorts,
  isSubgraphInstance,
  modelledSubgraphs,
  type GroupRecord,
  type SubgraphDefinition,
  type SubgraphIO,
  type SubgraphSlot,
} from '../graph/subgraphs';
export * from './pickers';
export * from './projectFile';
