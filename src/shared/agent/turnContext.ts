import { z } from 'zod';
import type { AgentTurnContext } from '../contracts/agent';

const objectRef = z.object({
  kind: z.enum(['node', 'port', 'edge', 'subgraph', 'group', 'nodeClass', 'model', 'process']),
  id: z.string().max(500),
  nodeId: z.string().max(200).optional(),
  portName: z.string().max(200).optional(),
  direction: z.enum(['input', 'output']).optional(),
  classType: z.string().max(200).optional(),
  directory: z.string().max(200).optional(),
  name: z.string().max(500).optional(),
});

const SELECTION_CAP = 200;

export const agentTurnContextSchema = z.object({
  intent: z.enum(['ask', 'build', 'chat']).default('chat').catch('chat'),
  objectRef: objectRef.optional().catch(undefined),
  // Each item is checked on its own: a bad ref is dropped, the rest of the selection stays (at most 200).
  selection: z.array(z.unknown()).default([]).catch([]).transform((items) => items.flatMap((item) => {
    const parsed = objectRef.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  }).slice(0, SELECTION_CAP)),
  language: z.enum(['en', 'ru']).optional().catch(undefined),
  viewport: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    zoom: z.number().finite().positive(),
    width: z.number().finite().nonnegative().optional(),
    height: z.number().finite().nonnegative().optional(),
  }).optional().catch(undefined),
});

/** Validates the renderer's turn context. Anything malformed falls back to a plain chat turn. */
export function parseTurnContext(input: unknown, language: 'en' | 'ru'): AgentTurnContext {
  const parsed = agentTurnContextSchema.safeParse(input ?? {});
  if (!parsed.success) return { intent: 'chat', selection: [], language };
  return { ...parsed.data, language: parsed.data.language ?? language };
}
