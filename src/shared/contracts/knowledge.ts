import type { ObjectRef } from './objects';

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

export interface NodeClassDetail extends NodeClassSummary {
  description: string;
  inputs: Array<{ name: string; type: string; widget: boolean; required: boolean }>;
  outputs: Array<{ name: string; type: string }>;
  widgetOrder: string[];
  widgetOrderReliable: boolean;
  outputNode: boolean;
  syncedAt: number | null;
}

export interface ModelSummary {
  directory: string;
  name: string;
  kind: ModelKind;
  baseModel: BaseModelFamily;
  sizeBytes: number | null;
  /** True when metadata enrichment ran for this file. */
  enriched: boolean;
}

export interface ModelDetail extends ModelSummary {
  baseModelEvidence: Evidence;
  triggerWords: string[];
  description: string;
  sourceUrl: string | null;
  /** Raw embedded safetensors header fields, strings only. */
  metadata: Record<string, string>;
  rootPath: string | null;
  sha256: string | null;
  syncedAt: number | null;
  enrichedAt: number | null;
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
  createdBy: 'ai' | 'user' | 'sync';
  createdAt: number;
}

export type ExplanationInput = Omit<Explanation, 'id' | 'createdAt'>;

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
}

export interface SyncStatus {
  state: 'never' | 'idle' | 'running' | 'error';
  lastSyncAt: number | null;
  lastError: string | null;
  mcpUrl: string;
  tokenHeld: boolean;
  /** A browser sign-in (OAuth) is held for the MCP URL's origin. Optional for older callers. */
  signedIn?: boolean;
  auto: { enabled: boolean; intervalMinutes: number };
  counts: { nodeClasses: number; detailedClasses: number; packs: number; models: number; enrichedModels: number };
  progress: { phase: string; done: number; total: number } | null;
}

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
