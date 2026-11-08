import type { GraphMutation } from './types';

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length > max) return null;
  return value;
}

/** Map a model tool call onto a graph command. Tool text is stored as data. */
export function mutationFromTool(name: string, args: Record<string, unknown> | undefined): GraphMutation | null {
  const input = args ?? {};
  if (name === 'addNode' && typeof input.nodeType === 'string') {
    return {
      type: 'add-node',
      nodeType: input.nodeType,
      title: typeof input.title === 'string' ? input.title : undefined,
      x: typeof input.x === 'number' ? input.x : undefined,
      y: typeof input.y === 'number' ? input.y : undefined,
      parameters: input.parameters && typeof input.parameters === 'object' && !Array.isArray(input.parameters)
        ? input.parameters as Record<string, unknown>
        : undefined,
    };
  }
  if (name === 'annotateNode' && typeof input.nodeId === 'string' && typeof input.annotation === 'string') {
    return { type: 'annotate-node', nodeId: input.nodeId, annotation: input.annotation };
  }
  if (name === 'setComponentDocumentation') {
    const purpose = text(input.purpose, 20000);
    const usage = text(input.usage, 20000);
    if ((input.ownerKind !== 'node' && input.ownerKind !== 'subgraph') || typeof input.ownerId !== 'string' || purpose == null || usage == null) {
      return null;
    }
    return {
      type: 'set-component',
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      purpose,
      usage,
    };
  }
  if (name === 'setProcess') {
    const title = text(input.title, 500);
    const notes = text(input.notes, 20000);
    if (title == null || notes == null) return null;
    return { type: 'set-process', title, notes };
  }
  return null;
}
