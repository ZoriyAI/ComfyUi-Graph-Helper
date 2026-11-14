import type { ModelNotes } from '../knowledge/sidecar';
import type { PackInfo } from '../knowledge/packInfo';
import type { WebError, WebFound, WebStatus } from '../knowledge/webLookup';
import type { PromptNoteKind } from '../prompt/inspect';
import type { ObjectRef } from './objects';

export type { PromptNoteKind } from '../prompt/inspect';

export type { ExamplePrompt, ModelNotes } from '../knowledge/sidecar';
export type { PackInfo } from '../knowledge/packInfo';
export type { WebError, WebFound, WebSource, WebStatus } from '../knowledge/webLookup';

/** Normalised base-model families. 'unknown' when nothing proved it. */
export type BaseModelFamily =
  | 'sd15' | 'sd2' | 'sdxl' | 'pony' | 'illustrious' | 'sd3' | 'flux1' | 'flux2' | 'chroma'
  | 'qwen-image' | 'wan2.1' | 'wan2.2' | 'ltx2' | 'hunyuan' | 'zimage' | 'krea' | 'kolors' | 'pixart' | 'auraflow'
  | 'cascade' | 'unknown';

export type ModelKind =
  | 'checkpoint' | 'lora' | 'vae' | 'controlnet' | 'upscale' | 'clip' | 'clip_vision' | 'unet' | 'text_encoder'
  | 'embedding' | 'style' | 'ipadapter' | 'other';

export type Evidence = 'metadata' | 'sidecar' | 'filename' | 'web' | 'none';

export interface NodeClassSummary {
  classType: string;
  displayName: string;
  category: string;
  pack: string;
  /** True when inputs and outputs are known from object_info. */
  detailed: boolean;
}

/** How a widget input is edited. 'other' is a widget this app does not draw (image upload, colour, curve…). */
export type FieldKind = 'combo' | 'int' | 'float' | 'string' | 'boolean' | 'other';

/**
 * What a control needs to edit one widget input, read from object_info (see shared/catalog/fieldSpec.ts).
 * Absent on rows stored before field metadata existed: controls then fall back to the JS type of the value.
 */
export interface FieldSpec {
  kind: FieldKind;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  multiline?: boolean;
  multiSelect?: boolean;
  tooltip?: string;
  default?: unknown;
  /** Start mode of the control-after-generate slot (fixed | increment | decrement | randomize), when there is one. */
  control?: string;
  /**
   * The options are files of the person's model catalog (most options matched a stored model): the field is a
   * model picker. The catalog folder they were found in.
   */
  modelDirectory?: string;
}

export interface NodeClassInput {
  name: string;
  type: string;
  widget: boolean;
  required: boolean;
  /** Only on widget inputs. */
  spec?: FieldSpec;
  /** object_info tooltip, on sockets too. */
  tooltip?: string;
}

/** Ask for the model files a model field can take, with their fit to the checkpoint upstream. */
export interface FieldModelsRequest {
  projectId: string;
  nodeId: string;
  input: string;
}

/**
 * 'fits': the same family as the reference. 'related': another family of the same lineage, which loads but was made
 * for the other one (a Pony LoRA on an SDXL checkpoint). 'differs': a family that does not load on the reference.
 * 'unknown': the family of one of the two is not known.
 */
export type ModelFit = 'fits' | 'related' | 'differs' | 'unknown';

export interface FieldModelOption {
  /** The option exactly as ComfyUI lists it (the value to store). */
  value: string;
  directory: string;
  kind: ModelKind;
  baseModel: BaseModelFamily;
  sizeBytes: number | null;
  fit: ModelFit;
}

export interface FieldModelsResult {
  /** False when the options are not model files the catalog knows: the field stays a plain list. */
  models: boolean;
  /** The model the fit is measured against: the checkpoint upstream (or, for a checkpoint field, a LoRA downstream). */
  reference: { nodeId: string; name: string; baseModel: BaseModelFamily } | null;
  /** Fitting first, then related, unknown, and families that do not load last; by name inside each group. */
  options: FieldModelOption[];
}

export interface NodeClassDetail extends NodeClassSummary {
  description: string;
  inputs: NodeClassInput[];
  outputs: Array<{ name: string; type: string }>;
  widgetOrder: string[];
  widgetOrderReliable: boolean;
  outputNode: boolean;
  syncedAt: number | null;
  /**
   * What the class's pack says about itself in its own files (pyproject.toml, README), when they were read.
   * Absent for a class of ComfyUI itself and for a pack nobody read yet.
   */
  packInfo?: PackInfo | null;
}

export interface ModelSummary {
  directory: string;
  name: string;
  kind: ModelKind;
  baseModel: BaseModelFamily;
  sizeBytes: number | null;
  /** True when metadata enrichment ran for this file. */
  enriched: boolean;
  /** The name its author gave the model, from the description file next to it; empty when it has none. */
  title: string;
  /**
   * A preview lies next to the file: a still or a short clip. When none does, the sample picture found on the
   * internet for it at the person's request, if there is one.
   */
  preview: 'image' | 'video' | null;
  /**
   * The description marks the model, or the rating of its preview, as adult content; for a preview from the
   * internet, what the site says about it.
   */
  mature: boolean;
}

/**
 * What the internet said about a model file, asked only when the person said so: per file in its card, or for all
 * files at sync when Settings ▸ Privacy allows it.
 */
export interface ModelWebInfo {
  /** null: never asked. */
  status: WebStatus | null;
  checkedAt: number | null;
  error: WebError | null;
  found: WebFound | null;
}

/** The answer to "find it on the internet" from the card: the card as it is now, or why the step failed. */
export type ModelLookupResult =
  | { ok: true; detail: ModelDetail | null }
  | { ok: false; error: WebError; detail: ModelDetail | null };

/** The bytes of a model's preview, as read from the file next to it. */
export interface ModelPreview {
  kind: 'image' | 'video';
  mime: string;
  bytes: Uint8Array;
}

export interface ModelDetail extends ModelSummary {
  baseModelEvidence: Evidence;
  triggerWords: string[];
  description: string;
  sourceUrl: string | null;
  /** Raw embedded safetensors header fields, strings only. */
  metadata: Record<string, string>;
  /** What the description file next to the model says beyond the facts above: tags, usage, examples, notes. */
  notes: ModelNotes;
  rootPath: string | null;
  /** The file's SHA-256: from the description next to it, or made on the server at the person's request. */
  sha256: string | null;
  syncedAt: number | null;
  enrichedAt: number | null;
  /** What the internet said about the file. */
  web: ModelWebInfo;
  /** The description next to the file came from Civitai: asking Civitai again would tell nothing new. */
  civitaiKnown: boolean;
}

export type ExplanationAspect = 'what' | 'why' | 'connect' | 'next' | 'risk';
export type Provenance = 'fact' | 'inference' | 'web' | 'user';

export interface Explanation {
  id: string;
  /** null = knowledge about a class or model, shared across projects. */
  projectId: string | null;
  owner: ObjectRef;
  aspect: ExplanationAspect;
  text: string;
  provenance: Provenance;
  sourceUrl: string | null;
  /** Graph revision the explanation was written against; null for global knowledge. */
  revisionId: string | null;
  /** 'seed': built-in teaching knowledge written by the app itself (src/main/knowledge/seedCore.ts). */
  createdBy: 'ai' | 'user' | 'sync' | 'seed';
  createdAt: number;
}

export type ExplanationInput = Omit<Explanation, 'id' | 'createdAt'>;

/**
 * Something worth saying about a description (a prompt) in the graph. Advice, not an error: the graph runs, but
 * not the way the person expects.
 */
export interface PromptNote {
  kind: PromptNoteKind;
  /** The node the note is about: the node that holds the text, or the LoRA loader whose words are missing. */
  nodeId: string;
  classType: string;
  /** The piece of text the note is about, or the phrases; empty where the sentence needs none. */
  found: string;
  /** Numbers a sentence needs: counts of parentheses, a token estimate, the cfg. */
  numbers?: Record<string, number>;
  /** The sampler the text reaches, where the note is about the two together. */
  samplerId?: string;
  /** For a LoRA's missing words: the file and the words. */
  model?: string;
  words?: string[];
}

export interface GraphCheckReport {
  ok: boolean;
  missingNodes: Array<{ nodeId: string; classType: string }>;
  missingModels: Array<{ nodeId: string; directory: string; name: string }>;
  typeMismatches: Array<{ edgeId: string; source: string; target: string; sourceType: string; targetType: string }>;
  baseModelMismatches: Array<{ nodeId: string; model: string; modelBase: BaseModelFamily; otherNodeId: string; otherModel: string; otherBase: BaseModelFamily }>;
  unconnectedRequiredInputs: Array<{ nodeId: string; input: string; type: string }>;
  unknownNodeTypes: string[];
  /**
   * Widgets with no value and no catalog default: export would write null there and ComfyUI would refuse the
   * workflow. Optional so reports written before it existed still read; absent means none.
   */
  unsetWidgets?: Array<{ nodeId: string; classType: string; name: string }>;
  /** Directed loops that ComfyUI cannot execute. */
  cycles?: Array<{ nodeIds: string[] }>;
  /** Links whose source or target no longer exists on the same canvas level. */
  brokenEdges?: Array<{ edgeId: string; source: string; target: string }>;
  /** Widget values that contradict the installed node's own object_info. */
  invalidParameters?: Array<{
    nodeId: string;
    classType: string;
    name: string;
    reason: 'type' | 'range' | 'choice';
    expected: string;
    found: string;
  }>;
  /**
   * Advice about the descriptions in the graph (see PromptNote). Never part of `ok`: a graph with such notes
   * still saves and runs. Optional so reports written before it existed still read.
   */
  promptNotes?: PromptNote[];
}

export interface SyncStatus {
  /** Source-aware catalog facts revision, advanced only after accepted writes. */
  catalogRevision?: number;
  state: 'never' | 'idle' | 'running' | 'error';
  lastSyncAt: number | null;
  lastError: string | null;
  mcpUrl: string;
  tokenHeld: boolean;
  /** A browser sign-in (OAuth) is held for the MCP URL's origin. Optional for older callers. */
  signedIn?: boolean;
  auto: { enabled: boolean; intervalMinutes: number };
  counts: { nodeClasses: number; detailedClasses: number; packs: number; models: number; enrichedModels: number };
  /**
   * While a run is in flight: its phase ('connect', 'catalog', 'enrich'). After a successful listing, while model
   * metadata is still being read in the background, phase 'enrichment' with state 'idle'.
   */
  progress: { phase: string; done: number; total: number } | null;
  /** When the next automatic run is due (ms since epoch); null when auto sync is off. Optional for older callers. */
  nextRunAt?: number | null;
  /** The first run after startup is scheduled and has not started yet ("Starting…"). */
  startupPending?: boolean;
  /** When the last run started, and how long it took (listing plus the first metadata batch). */
  lastRunAt?: number | null;
  lastRunDurationMs?: number | null;
  /**
   * Non-fatal problems of the last successful run, as fixed English sentences (translated like lastError):
   * ComfyUI not reachable for node ports, an MCP catalog section that could not be read completely.
   */
  warnings?: string[];
  /** Model files in the enrichment scope, and how many of them carry metadata. */
  metadata?: { done: number; total: number };
  /** Background metadata reading was paused by the person; it resumes with the next run. */
  enrichmentPaused?: boolean;
  /** How the last successful run authenticated: the manual token, the browser sign-in, or nothing (the server needs none). */
  authMode?: 'token' | 'oauth' | 'anonymous' | null;
  /**
   * How the person chose to reach the server in Settings ▸ Connection ('' = not chosen yet). The hints name the
   * fix for that choice instead of listing every way in. Optional for older callers.
   */
  authChoice?: '' | 'none' | 'token' | 'oauth';
  /** The MCP address the library was last read from (null before this was recorded). Optional for older callers. */
  libraryUrl?: string | null;
  /**
   * The library was read from another MCP or ComfyUI address than the one now in Settings: it is not "up to date"
   * until the new address is read. Optional for older callers.
   */
  libraryElsewhere?: boolean;
  /** Settings ▸ Connection ▸ ComfyUI address ('' when not set). Optional for older callers. */
  comfyOrigin?: string;
  /**
   * What the library was last read from: ComfyUI's own address ('comfy'), an MCP server ('mcp'), or an MCP server
   * for the models and ComfyUI for the nodes ('mcp+comfy'). Null before the first read. Optional for older callers.
   */
  librarySource?: 'comfy' | 'mcp' | 'mcp+comfy' | null;
  /**
   * The kind of MCP server of the last read (main/mcp/profiles.ts): a full catalog, a model list, a checkpoint list,
   * or 'unknown' (of no kind the app reads). Null when no MCP server was read. Optional for older callers.
   */
  mcpProfile?: 'catalog' | 'modelList' | 'checkpointList' | 'unknown' | null;
}

/**
 * Settings ▸ Connection ▸ "Read through MCP": the result of the ordinary sync it runs. Counts are the library's after
 * the run; `continuing` while model files are still read in the background; errors and warnings are the sync's fixed
 * sentences (translated like SyncStatus.lastError).
 */
export type McpReadOutcome =
  | { ok: true; nodes: number; packs: number; models: number; done: number; total: number; continuing: boolean; warnings: string[]; at: number | null }
  | { ok: false; error: string };

/** The guard before a node class is added (main/knowledge/nodeClassGuard.ts). */
export type NodeClassVerdict =
  | { ok: true; known: boolean; portsKnown: boolean; warning?: string }
  | { ok: false; error: string; suggestions: string[] };

export interface SearchNodesRequest { query: string; category?: string; limit?: number }
export interface SearchModelsRequest { query: string; directory?: string; baseModel?: BaseModelFamily; kind?: ModelKind; limit?: number }
export interface ListExplanationsRequest { projectId?: string | null; owner?: ObjectRef }

/** Catalog totals for the agent prompt and the status bar. byFamily is grouped by kind and base family. */
export interface CatalogCounts {
  nodeClasses: number;
  detailedClasses: number;
  packs: number;
  models: number;
  enrichedModels: number;
  byKind: Array<{ kind: ModelKind; count: number }>;
  byFamily: Array<{ kind: ModelKind; baseModel: BaseModelFamily; count: number }>;
}
