import type Database from 'better-sqlite3';
import type {
  Explanation,
  ExplanationInput,
  ModelDetail,
  ModelSummary,
  NodeClassDetail,
  NodeClassSummary,
  Proposal,
  ProposalInput,
} from '../../../src/shared/contracts';
import type { KnowledgeApi, ProposalApi } from '../../../src/main/agent/tools';

export const NODE_CLASSES: NodeClassSummary[] = [
  { classType: 'KSampler', displayName: 'KSampler', category: 'sampling', pack: 'core', detailed: true },
  { classType: 'CheckpointLoaderSimple', displayName: 'Load Checkpoint', category: 'loaders', pack: 'core', detailed: true },
  { classType: 'FancyNode', displayName: 'Fancy', category: 'custom', pack: 'fancy-pack', detailed: false },
];

export const MODELS: ModelSummary[] = [
  { directory: 'checkpoints', name: 'juggernautXL.safetensors', kind: 'checkpoint', baseModel: 'sdxl', sizeBytes: 1, enriched: true },
  { directory: 'checkpoints', name: 'flux1-dev.safetensors', kind: 'checkpoint', baseModel: 'flux1', sizeBytes: 1, enriched: true },
  { directory: 'loras', name: 'portrait_detail_sdxl.safetensors', kind: 'lora', baseModel: 'sdxl', sizeBytes: 1, enriched: true },
  { directory: 'loras', name: 'portrait_flux.safetensors', kind: 'lora', baseModel: 'flux1', sizeBytes: 1, enriched: false },
  { directory: 'loras', name: 'anime_lines.safetensors', kind: 'lora', baseModel: 'illustrious', sizeBytes: 1, enriched: false },
];

export function fakeKnowledge(): KnowledgeApi & { saved: ExplanationInput[] } {
  const saved: ExplanationInput[] = [];
  return {
    saved,
    searchNodeClasses: (_db: Database.Database, request) => NODE_CLASSES
      .filter((item) => item.classType.toLowerCase().includes(request.query.toLowerCase()))
      .slice(0, request.limit ?? 50),
    nodeClassDetail: (_db, classType): NodeClassDetail | null => classType !== 'KSampler' ? null : {
      ...NODE_CLASSES[0],
      description: 'Denoises a latent.',
      inputs: [{ name: 'model', type: 'MODEL', widget: false, required: true }, { name: 'seed', type: 'INT', widget: true, required: true }],
      outputs: [{ name: 'LATENT', type: 'LATENT' }],
      widgetOrder: ['seed'],
      widgetOrderReliable: true,
      outputNode: false,
      syncedAt: 1,
    },
    searchModels: (_db, request) => MODELS
      .filter((item) => item.name.toLowerCase().includes(request.query.toLowerCase()))
      .filter((item) => !request.kind || item.kind === request.kind)
      .filter((item) => !request.directory || item.directory === request.directory)
      .slice(0, request.limit ?? 50),
    modelDetail: (_db, directory, name): ModelDetail | null => {
      const found = MODELS.find((item) => item.directory === directory && item.name === name);
      return found ? { ...found, baseModelEvidence: 'metadata', triggerWords: ['ptdetail'], description: '', sourceUrl: null, metadata: {}, rootPath: null, sha256: null, syncedAt: 1, enrichedAt: 1 } : null;
    },
    saveExplanation: (_db, input): Explanation => {
      saved.push(input);
      return { ...input, id: `exp-${saved.length}`, createdAt: 1 };
    },
    checkGraph: () => ({
      ok: true, missingNodes: [], missingModels: [], typeMismatches: [], baseModelMismatches: [], unconnectedRequiredInputs: [], unknownNodeTypes: [],
    }),
  };
}

/** Every function throws like the unimplemented KB stub. */
export function throwingKnowledge(): KnowledgeApi {
  const fail = () => { throw new Error('knowledge: not implemented yet'); };
  return { searchNodeClasses: fail, nodeClassDetail: fail, searchModels: fail, modelDetail: fail, saveExplanation: fail, checkGraph: fail };
}

export function fakeProposals(): ProposalApi & { created: Proposal[] } {
  const created: Proposal[] = [];
  return {
    created,
    createProposal: (_db, input: ProposalInput): Proposal => {
      const proposal: Proposal = { ...input, id: `prop-${created.length + 1}`, status: 'proposed', createdAt: 1, resolvedAt: null };
      created.push(proposal);
      return proposal;
    },
    listProposals: (_db, projectId, status) => created.filter((item) => item.projectId === projectId && (!status || item.status === status)),
  };
}
