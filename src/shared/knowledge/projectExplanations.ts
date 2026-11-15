/**
 * The `explanations` block of a native project file (`extensions.explanations`): every explanation that belongs to
 * an object of the project's graph. The engine never reads it; main/knowledge/projectExplanations.ts writes it on
 * save and reads it on open, main/commands/commit.ts keeps it with each commit, and the renderer's knowledge state
 * uses isGraphOwnerKind. Its own version: a block this app does not understand is left out, never refused.
 *
 *   { "version": 1, "items": [ { "owner": ObjectRef, "aspect", "text", "provenance", "sourceUrl", "createdBy",
 *                                 "createdAt", "revisionId" } ] }
 *
 * An object inside a subgraph definition carries the definition's id in `owner.subgraphId`.
 */
import { z } from 'zod';
import type { Explanation } from '../contracts/knowledge';
import type { ObjectKind, ObjectRef } from '../contracts/objects';
import { EXPLANATION_ASPECTS, objectRefSchema, ownerIsComplete, PROVENANCES } from './schemas';

/** The key of the block under the project file's `extensions`, and its format version. */
export const EXPLANATIONS_EXTENSION = 'explanations';
export const EXPLANATIONS_BLOCK_VERSION = 1;
/** More than any real project holds; a file with more is cut, not refused. */
export const EXPLANATIONS_BLOCK_MAX = 20000;

/**
 * Owners that are objects of one graph: they travel with the project file and are scoped by the graph. Every other
 * kind (a node class, a model file, a link type, a family) is knowledge of the app, kept once for every project.
 */
export const GRAPH_OWNER_KINDS: readonly ObjectKind[] = ['node', 'port', 'edge', 'group', 'subgraph', 'process'];

/** Whether an owner kind belongs to the graph (and so to the project file) rather than to the app. */
export function isGraphOwnerKind(kind: string): boolean {
  return (GRAPH_OWNER_KINDS as readonly string[]).includes(kind);
}

/** An explanation as the project file holds it: no id and no project, which the file itself implies. */
export type ProjectExplanation = Pick<Explanation, 'owner' | 'aspect' | 'text' | 'provenance' | 'sourceUrl' | 'createdBy' | 'createdAt' | 'revisionId'>;

/** The block as written into the file. */
export interface ExplanationsBlock {
  version: typeof EXPLANATIONS_BLOCK_VERSION;
  items: ProjectExplanation[];
}

// http(s) only, as in schemas.ts: a source link is opened from the renderer.
const sourceUrl = z.string().max(2000).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
});

const itemSchema = z.object({
  owner: objectRefSchema.refine((owner) => isGraphOwnerKind(owner.kind) && ownerIsComplete(owner)),
  aspect: z.enum(EXPLANATION_ASPECTS),
  text: z.string().min(1).max(20000),
  provenance: z.enum(PROVENANCES),
  sourceUrl: sourceUrl.nullable().optional(),
  createdBy: z.enum(['ai', 'user', 'sync', 'seed', 'file']),
  createdAt: z.number().finite().nonnegative().optional(),
  revisionId: z.string().min(1).max(200).nullable().optional(),
});

/** The block to write for these explanations, with only the fields the file format names. */
export function explanationsBlock(items: ProjectExplanation[]): ExplanationsBlock {
  return {
    version: EXPLANATIONS_BLOCK_VERSION,
    items: items.map((item) => ({
      owner: item.owner,
      aspect: item.aspect,
      text: item.text,
      provenance: item.provenance,
      sourceUrl: item.sourceUrl,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      revisionId: item.revisionId,
    })),
  };
}

/**
 * What a project file's extensions say about explanations. Nothing here can refuse a project: a missing block is
 * none, an unknown version or a malformed block is skipped whole, a malformed item is skipped alone.
 */
export function readExplanationsBlock(extensions: unknown): { items: ProjectExplanation[]; skipped: number; unreadable: boolean } {
  const none = { items: [], skipped: 0, unreadable: false };
  if (!extensions || typeof extensions !== 'object' || Array.isArray(extensions)) return none;
  const block = (extensions as Record<string, unknown>)[EXPLANATIONS_EXTENSION];
  if (block === undefined) return none;
  if (!block || typeof block !== 'object' || Array.isArray(block)) return { ...none, unreadable: true };
  const record = block as Record<string, unknown>;
  if (record.version !== EXPLANATIONS_BLOCK_VERSION || !Array.isArray(record.items)) return { ...none, unreadable: true };
  const items: ProjectExplanation[] = [];
  let skipped = 0;
  for (const raw of record.items.slice(0, EXPLANATIONS_BLOCK_MAX)) {
    const parsed = itemSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const value = parsed.data;
    items.push({
      owner: value.owner as ObjectRef,
      aspect: value.aspect,
      text: value.text,
      provenance: value.provenance,
      sourceUrl: value.sourceUrl ?? null,
      createdBy: value.createdBy,
      createdAt: value.createdAt ?? 0,
      revisionId: value.revisionId ?? null,
    });
  }
  skipped += Math.max(0, record.items.length - EXPLANATIONS_BLOCK_MAX);
  return { items, skipped, unreadable: false };
}
