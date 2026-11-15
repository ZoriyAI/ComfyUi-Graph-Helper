/**
 * A reference to one thing a person can point at in the app.
 * Used by explanations, the context menu question, agent context, and proposals.
 * objectKey tells apart objects with the same id on different levels (the main canvas and a subgraph).
 */

/**
 * What kind of thing a ref points at.
 * 'linkType': a ComfyUI data type such as MODEL or LATENT (id = the type name).
 * 'family': a base-model family such as sdxl or flux1 (id = the BaseModelFamily value).
 */
export type ObjectKind = 'node' | 'port' | 'edge' | 'subgraph' | 'group' | 'nodeClass' | 'model' | 'process' | 'linkType' | 'family';

/** One object, by kind and id; ports and models need the extra fields to be found. */
export interface ObjectRef {
  kind: ObjectKind;
  /** Stable id: node id, edge id, subgraph definition id, group id, class type, "directory/name" for a model, "process". */
  id: string;
  /** For kind 'port': the node that owns the port. */
  nodeId?: string;
  /** For kind 'port': the handle name as React Flow and the catalog know it. */
  portName?: string;
  direction?: 'input' | 'output';
  /** For kind 'node' | 'nodeClass': the ComfyUI class type. */
  classType?: string;
  /** For kind 'model'. */
  directory?: string;
  name?: string;
  /**
   * For a node, port or link inside a subgraph definition: that definition's id. Node numbers inside a definition
   * repeat the numbers of the main canvas, so the definition is part of who the object is. Absent on the main canvas.
   */
  subgraphId?: string;
}

/** Kinds whose objects live inside a subgraph definition when they carry `subgraphId`. */
const SCOPED_KINDS: ReadonlySet<ObjectKind> = new Set(['node', 'port', 'edge']);

/** The definition an object lives in, or '' for the main canvas (and for every kind that is not drawn inside one). */
export function objectScope(ref: ObjectRef): string {
  return SCOPED_KINDS.has(ref.kind) && ref.subgraphId ? ref.subgraphId : '';
}

/** The ref as it is inside the given definition (null: the main canvas). Other kinds are returned unchanged. */
export function inSubgraph(ref: ObjectRef, subgraphId: string | null | undefined): ObjectRef {
  if (!SCOPED_KINDS.has(ref.kind)) return ref;
  if (!subgraphId) {
    if (ref.subgraphId === undefined) return ref;
    const { subgraphId: _drop, ...rest } = ref;
    void _drop;
    return rest;
  }
  return ref.subgraphId === subgraphId ? ref : { ...ref, subgraphId };
}

/** The key of the object within its own level (no definition). */
export function levelKey(ref: ObjectRef): string {
  if (ref.kind === 'port') return `port:${ref.nodeId ?? ''}:${ref.direction ?? ''}:${ref.portName ?? ref.id}`;
  return `${ref.kind}:${ref.id}`;
}

/** A key that tells apart node 3 of the main canvas from node 3 inside a subgraph definition. */
export function objectKey(ref: ObjectRef): string {
  const scope = objectScope(ref);
  return scope ? `${levelKey(ref)}@${scope}` : levelKey(ref);
}
