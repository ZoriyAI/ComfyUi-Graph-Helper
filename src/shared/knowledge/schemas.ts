import { z } from 'zod';
import type { BaseModelFamily, ExplanationAspect, ModelKind, Provenance } from '../contracts/knowledge';
import type { ObjectKind } from '../contracts/objects';

/** Every value of the contract unions, so zod and the type stay in step (a missing member fails type-check). */
export const BASE_MODEL_FAMILIES = [
  'sd15', 'sd2', 'sdxl', 'pony', 'illustrious', 'sd3', 'flux1', 'flux2', 'chroma', 'qwen-image', 'wan2.1', 'wan2.2',
  'ltx2', 'hunyuan', 'zimage', 'krea', 'kolors', 'pixart', 'auraflow', 'cascade', 'unknown',
] as const satisfies readonly BaseModelFamily[];
export const MODEL_KINDS = [
  'checkpoint', 'lora', 'vae', 'controlnet', 'upscale', 'clip', 'clip_vision', 'unet', 'text_encoder', 'embedding',
  'style', 'ipadapter', 'other',
] as const satisfies readonly ModelKind[];
export const EXPLANATION_ASPECTS = ['what', 'why', 'connect', 'next', 'risk'] as const satisfies readonly ExplanationAspect[];
export const PROVENANCES = ['fact', 'inference', 'web', 'user'] as const satisfies readonly Provenance[];
export const OBJECT_KINDS = [
  'node', 'port', 'edge', 'subgraph', 'group', 'nodeClass', 'model', 'process', 'linkType', 'family',
] as const satisfies readonly ObjectKind[];

type Exhaustive<All, Listed extends readonly unknown[]> = [All] extends [Listed[number]] ? true : never;
// Compile-time guard: adding a member to a contract union without listing it here breaks type-check.
const exhaustive: [
  Exhaustive<BaseModelFamily, typeof BASE_MODEL_FAMILIES>,
  Exhaustive<ModelKind, typeof MODEL_KINDS>,
  Exhaustive<ExplanationAspect, typeof EXPLANATION_ASPECTS>,
  Exhaustive<Provenance, typeof PROVENANCES>,
  Exhaustive<ObjectKind, typeof OBJECT_KINDS>,
] = [true, true, true, true, true];
void exhaustive;

const shortText = z.string().max(500);

export const objectRefSchema = z.object({
  kind: z.enum(OBJECT_KINDS),
  id: z.string().min(1).max(500),
  nodeId: shortText.optional(),
  portName: shortText.optional(),
  direction: z.enum(['input', 'output']).optional(),
  classType: shortText.optional(),
  directory: shortText.optional(),
  name: shortText.optional(),
});

/** The agent prompt builder lists the whole catalog, so a search may ask for up to this many rows. */
export const SEARCH_LIMIT_MAX = 10000;
export const SEARCH_LIMIT_DEFAULT = 30;
const limitSchema = z.number().int().min(1).max(SEARCH_LIMIT_MAX).optional();

export const searchNodesSchema = z.object({
  query: z.string().max(200),
  category: z.string().max(200).optional(),
  limit: limitSchema,
});

export const searchModelsSchema = z.object({
  query: z.string().max(200),
  directory: z.string().max(200).optional(),
  baseModel: z.enum(BASE_MODEL_FAMILIES).optional(),
  kind: z.enum(MODEL_KINDS).optional(),
  limit: limitSchema,
});

export const modelKeySchema = z.object({ directory: z.string().min(1).max(200), name: z.string().min(1).max(1000) });

export const listExplanationsSchema = z.object({
  projectId: z.string().min(1).max(200).nullable().optional(),
  owner: objectRefSchema.optional(),
});

/** http(s) only: a source link is shown to the person and opened from the renderer. */
const sourceUrlSchema = z.string().max(2000).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}, 'Source URL must be http or https.');

export const explanationInputSchema = z.object({
  projectId: z.string().min(1).max(200).nullable(),
  owner: objectRefSchema,
  aspect: z.enum(EXPLANATION_ASPECTS),
  text: z.string().min(1).max(20000),
  provenance: z.enum(PROVENANCES),
  sourceUrl: sourceUrlSchema.nullable(),
  revisionId: z.string().min(1).max(200).nullable(),
  createdBy: z.enum(['ai', 'user', 'sync', 'seed']),
});

/** A port owner names its node, side, and port; without them the note cannot be shown on the port. */
export function ownerIsComplete(owner: { kind: string; nodeId?: string; direction?: string; portName?: string }): boolean {
  if (owner.kind !== 'port') return true;
  return Boolean(owner.nodeId) && Boolean(owner.direction) && Boolean(owner.portName);
}

/** The renderer's save: the same shape, with a port owner that names its node, side, and port. */
export const userExplanationInputSchema = explanationInputSchema.refine((input) => ownerIsComplete(input.owner), {
  message: 'A port owner needs nodeId, direction, and portName.',
  path: ['owner'],
});

export const projectIdSchema = z.string().min(1).max(200);
export const classTypeSchema = z.string().min(1).max(500);

export const SYNC_INTERVAL_DEFAULT_MINUTES = 30;
export const SYNC_INTERVAL_MIN_MINUTES = 5;
export const SYNC_INTERVAL_MAX_MINUTES = 24 * 60;

export const setAutoSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(SYNC_INTERVAL_MIN_MINUTES).max(SYNC_INTERVAL_MAX_MINUTES),
});
