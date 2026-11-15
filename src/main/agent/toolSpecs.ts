/**
 * JSON-schema specs (description and parameters) for the tools that run in main: what the model reads about each
 * tool. Used by tools.ts and lessonDraftTool.ts to define the tools. Build-tool specs are not here: they come
 * from the renderer (shared/commands/toolSpecs.ts), and buildTools.ts takes them as RendererToolSpec.
 */
import type { AgentKnowledgeTool, AgentProposalTool, AgentReadTool } from '../../shared/contracts/agentTools';
import { FETCH_PAGE_BYTE_CAP, FETCH_PAGE_TEXT_CAP, GRAPH_PAGE_DEFAULT, megabytes } from '../../shared/agent/limits';

/** One tool as the model sees it: what it does and the JSON schema of its arguments. */
export interface AgentToolSpec {
  description: string;
  parameters: Record<string, unknown>;
}

// The value lists the schemas offer; they follow the kinds and families the knowledge base knows.
const OBJECT_KINDS = ['node', 'port', 'edge', 'subgraph', 'group', 'nodeClass', 'model', 'process'];
const BASE_FAMILIES = [
  'sd15', 'sd2', 'sdxl', 'pony', 'illustrious', 'sd3', 'flux1', 'flux2', 'chroma', 'qwen-image', 'wan2.1', 'wan2.2',
  'ltx2', 'hunyuan', 'zimage', 'krea', 'kolors', 'pixart', 'auraflow', 'cascade', 'unknown',
];
const MODEL_KINDS = [
  'checkpoint', 'lora', 'vae', 'controlnet', 'upscale', 'clip', 'clip_vision', 'unet', 'text_encoder', 'embedding',
  'style', 'ipadapter', 'other',
];

/** The `note` argument every propose* tool takes. */
const note = { type: 'string', maxLength: 500, description: 'One short sentence shown beside the ghost: why this step. Stored as data.' };

/** An object on the canvas or in the catalog an explanation belongs to. */
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

/** Every main-process tool by name. The descriptions are the model's only manual, so they state limits and paging. */
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
  draftLesson: {
    description: [
      'Draft a lesson for the Lessons panel: the person builds a graph by hand while each step is checked on the canvas. Use it when the person asks for a lesson (from the current graph, or "teach me X with what I have installed"). Read the graph and the installed node classes first; every class you name must be installed.',
      'The draft is checked and tried from an empty canvas before the person sees it, then shown as a card they keep or discard; nothing is saved without them. If the result is an error, fix what it names and call again.',
      'Format of `lesson`: id (lower-case words joined by hyphens); texts.en and/or texts.ru = { title, result (one line: what the person ends up with), steps: { <stepId>: { title, body } } } with a title and body for EVERY step; steps = ordered list of { id, read?: true, roles?, links?, fields? }.',
      'The first step is { id: "intro", read: true } and explains the goal. A step that does something brings nodes as roles [{ role: "sampler", classes: ["KSampler"] }] (each role once, before anything names it), links [{ from: role, output: output name or data type, to: role, input: input name }], and fields [{ role, field, test }].',
      'Tests: { kind: "chosen" } (a file chosen, a text written), { kind: "equals", value }, { kind: "between", min, max, prefer } (prefer is the number the text names and "Do this for me" sets), { kind: "text", minChars }, { kind: "differs" | "same", role, field }. In bodies write {role} where the node name belongs, field names in backticks, and give the same numbers the tests set.',
      'Steps the person answers in the panel (one kind per step, never mixed with roles, links or fields): checklist [{ id, optional?, run? }] for things done outside the app (run: true marks the tick that says the workflow was run in ComfyUI), with texts.<lang>.steps.<id>.items = { <itemId>: { label, how? } }; rubric [{ id, levels: 2 to 4 level ids from low to high, pass? }] with criteria = { <id>: { title, levels: { <levelId>: words }, tryNext? } }; quiz [{ id, choices, answer }] (1 to 5 questions) with questions = { <id>: { text, choices: { <choiceId>: words }, explain } }. A checklist or canvas step may carry transfer: true (a task the person does without "Do this for me"). The app never runs a workflow or judges a picture: a tick or a score is the person\'s own word, so say so in the words.',
      'Content rules (0.9.0): lessons teach technique. Adults (18+) may learn any lawful adult content, with the consent of everyone involved; set adult: true for such a lesson. Never minors or anyone who looks like one, real people in explicit content, sexual violence, animals in explicit content, or anything unlawful. Write no explicit text: no scene descriptions, no explicit example prompts, no explicit tag lists.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        lesson: {
          type: 'object',
          description: 'The lesson document.',
          properties: {
            id: { type: 'string', maxLength: 64 },
            adult: { type: 'boolean' },
            texts: { type: 'object', description: 'en and/or ru: { title, result, steps: { stepId: { title, body } } }' },
            steps: {
              type: 'array',
              maxItems: 100,
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  read: { type: 'boolean' },
                  roles: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, classes: { type: 'array', items: { type: 'string' } } }, required: ['role', 'classes'] } },
                  links: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, output: { type: 'string' }, to: { type: 'string' }, input: { type: 'string' } }, required: ['from', 'output', 'to', 'input'] } },
                  fields: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, field: { type: 'string' }, test: { type: 'object' } }, required: ['role', 'field', 'test'] } },
                  checklist: { type: 'array', maxItems: 12, items: { type: 'object', properties: { id: { type: 'string' }, optional: { type: 'boolean' }, run: { type: 'boolean' } }, required: ['id'] } },
                  rubric: { type: 'array', maxItems: 8, items: { type: 'object', properties: { id: { type: 'string' }, levels: { type: 'array', items: { type: 'string' } }, pass: { type: 'string' } }, required: ['id', 'levels'] } },
                  quiz: { type: 'array', maxItems: 5, items: { type: 'object', properties: { id: { type: 'string' }, choices: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' } }, required: ['id', 'choices', 'answer'] } },
                  transfer: { type: 'boolean' },
                },
                required: ['id'],
              },
            },
          },
          required: ['id', 'texts', 'steps'],
        },
      },
      required: ['lesson'],
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
