import type { AgentKnowledgeTool, AgentProposalTool, AgentReadTool } from '../../shared/contracts/agentTools';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP, GRAPH_PAGE_DEFAULT, megabytes } from '../../shared/agent/limits';

/**
 * JSON-schema specs for the tools that run in main. Build-tool specs still come from the renderer.
 * The renderer can render tool cards from these shapes.
 */
export interface AgentToolSpec {
  description: string;
  parameters: Record<string, unknown>;
}

const OBJECT_KINDS = ['node', 'port', 'edge', 'subgraph', 'group', 'nodeClass', 'model', 'process'];
const BASE_FAMILIES = [
  'sd15', 'sd2', 'sdxl', 'pony', 'illustrious', 'sd3', 'flux1', 'flux2', 'chroma', 'qwen-image', 'wan2.1', 'wan2.2',
  'ltx2', 'hunyuan', 'zimage', 'krea', 'kolors', 'pixart', 'auraflow', 'cascade', 'unknown',
];
const MODEL_KINDS = [
  'checkpoint', 'lora', 'vae', 'controlnet', 'upscale', 'clip', 'clip_vision', 'unet', 'text_encoder', 'embedding',
  'style', 'ipadapter', 'other',
];

const note = { type: 'string', maxLength: 500, description: 'One short sentence shown beside the ghost: why this step. Stored as data.' };

export const OBJECT_REF_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: OBJECT_KINDS },
    id: { type: 'string', description: 'Node id, edge id, subgraph id, group id, class type, "directory/name" for a model, or "process".' },
    nodeId: { type: 'string', description: 'For a port: the node that owns it.' },
    portName: { type: 'string', description: 'For a port: the handle name.' },
    direction: { type: 'string', enum: ['input', 'output'] },
    classType: { type: 'string' },
    directory: { type: 'string' },
    name: { type: 'string' },
  },
  required: ['kind', 'id'],
};

export const MAIN_TOOL_SPECS: Record<AgentReadTool | AgentKnowledgeTool | AgentProposalTool, AgentToolSpec> = {
  getGraph: {
    description: `Read the current graph: node ids, class types, titles, ports with their handles (in-N / out-N), every connection that touches the listed nodes, every widget value in full (values that look like secrets are [redacted]), positions, sizes, groups and subgraphs. Pages of ${GRAPH_PAGE_DEFAULT} nodes by default (any larger limit is allowed): when nextOffset is not null, call again with that offset until it is null; or pass ids to read specific nodes.`,
    parameters: {
      type: 'object',
      properties: {
        offset: { type: 'integer', minimum: 0, description: 'First node of the page in graph order (default 0).' },
        limit: { type: 'integer', minimum: 1, description: `Nodes per page (default ${GRAPH_PAGE_DEFAULT}, no maximum).` },
        ids: { type: 'array', items: { type: 'string' }, description: 'Only these node ids and the connections that touch them.' },
      },
    },
  },
  searchNodeTypes: {
    description: 'Search node classes installed in this person\'s ComfyUI by name, display name, or category. 20 results by default; more: true means more match (pass a larger limit).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for, e.g. "sampler" or "upscale".' },
        category: { type: 'string', description: 'Optional category prefix, e.g. "sampling".' },
        limit: { type: 'integer', minimum: 1, description: 'Results to return (default 20, no maximum).' },
      },
      required: ['query'],
    },
  },
  describeNodeType: {
    description: 'Inputs, outputs, widgets, and description of one installed node class. Each input and output carries its handle (in-N / out-N, in socket order) for connectNodes and proposeConnection.',
    parameters: {
      type: 'object',
      properties: { classType: { type: 'string', description: 'Exact ComfyUI class type, e.g. "KSampler".' } },
      required: ['classType'],
    },
  },
  findInstalledModels: {
    description: 'Search model files on this person\'s disk (checkpoints, LoRAs, VAEs, …) with their base-model family. 20 results by default; more: true means more match (pass a larger limit).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words in the file name. Empty lists by filter only.' },
        directory: { type: 'string', description: 'ComfyUI models directory, e.g. "loras" or "checkpoints".' },
        baseModel: { type: 'string', enum: BASE_FAMILIES },
        kind: { type: 'string', enum: MODEL_KINDS },
        limit: { type: 'integer', minimum: 1, description: 'Results to return (default 20, no maximum).' },
      },
      required: ['query'],
    },
  },
  describeModel: {
    description: 'Details of one model file: base family and how it was established, trigger words, description, source.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Models directory, e.g. "loras".' },
        name: { type: 'string', description: 'File name inside that directory.' },
      },
      required: ['directory', 'name'],
    },
  },
  checkGraph: {
    description: 'Check the current graph against the catalog: missing nodes or models, type and base-model mismatches, unconnected required inputs. Never runs anything.',
    parameters: { type: 'object', properties: {} },
  },
  searchWeb: {
    description: 'Search the public web. Use when the catalog cannot answer; say in the reply that the answer came from the web and give the link.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', maxLength: 400 } },
      required: ['query'],
    },
  },
  fetchPage: {
    description: `Read one public web page as plain text. Protective limits: at most ${megabytes(FETCH_PAGE_BYTE_CAP)} of the page is downloaded and at most ${FETCH_PAGE_TEXT_CAP} characters of its text are returned; past either, the result says truncated: true. Only http(s) public addresses.`,
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'http(s) address' } },
      required: ['url'],
    },
  },
  explain: {
    description: 'Save a short explanation to an object so the person finds it in the inspector later. Mark provenance honestly: fact (catalog or metadata), inference (your reasoning), web (with sourceUrl).',
    parameters: {
      type: 'object',
      properties: {
        owner: OBJECT_REF_SCHEMA,
        aspect: { type: 'string', enum: ['what', 'why', 'connect', 'next', 'risk'] },
        text: { type: 'string', maxLength: 8000 },
        provenance: { type: 'string', enum: ['fact', 'inference', 'web'] },
        sourceUrl: { type: 'string', description: 'Required when provenance is web.' },
      },
      required: ['owner', 'aspect', 'text', 'provenance'],
    },
  },
  proposeNode: {
    description: 'Suggest a node as a ghost. It enters the graph only if the person accepts it.',
    parameters: {
      type: 'object',
      properties: {
        nodeType: { type: 'string', description: 'Installed class type' },
        title: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        parameters: { type: 'object', description: 'Widget values by name' },
        note,
      },
      required: ['nodeType', 'note'],
    },
  },
  proposeConnection: {
    description: 'Suggest a connection as a dashed ghost link between two existing nodes.',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source node id' },
        sourceHandle: { type: 'string', description: 'Output slot index as a string, e.g. "0"' },
        target: { type: 'string', description: 'Target node id' },
        targetHandle: { type: 'string', description: 'Input slot index as a string, e.g. "0"' },
        note,
      },
      required: ['source', 'sourceHandle', 'target', 'targetHandle', 'note'],
    },
  },
  proposeParameter: {
    description: 'Suggest a widget value on an existing node.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        key: { type: 'string', description: 'Widget name' },
        value: { description: 'New value' },
        widgetIndex: { type: 'integer', minimum: 0 },
        note,
      },
      required: ['nodeId', 'key', 'value', 'note'],
    },
  },
  proposeSubgraph: {
    description: 'Suggest grouping existing nodes into a named subgraph with its inputs and outputs.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        nodeIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
        inputs: { type: 'array', items: { type: 'object' }, description: 'Subgraph inputs (name, type, nodeId, handle)' },
        outputs: { type: 'array', items: { type: 'object' }, description: 'Subgraph outputs (name, type, nodeId, handle)' },
        note,
      },
      required: ['name', 'nodeIds', 'note'],
    },
  },
};
