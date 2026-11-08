/**
 * A reference to one thing a person can point at in the app.
 * Used by explanations, the context menu question, agent context, and proposals.
 */
export type ObjectKind = 'node' | 'port' | 'edge' | 'subgraph' | 'group' | 'nodeClass' | 'model' | 'process';

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
}

export function objectKey(ref: ObjectRef): string {
  if (ref.kind === 'port') return `port:${ref.nodeId ?? ''}:${ref.direction ?? ''}:${ref.portName ?? ref.id}`;
  return `${ref.kind}:${ref.id}`;
}
