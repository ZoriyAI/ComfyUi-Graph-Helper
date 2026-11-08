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

export const agentTurnContextSchema = z.object({
  intent: z.enum(['ask', 'build', 'chat']).default('chat'),
  objectRef: objectRef.optional(),
  selection: z.array(objectRef).max(200).default([]),
  language: z.enum(['en', 'ru']).optional(),
});

/** Validates the renderer's turn context. Anything malformed falls back to a plain chat turn. */
export function parseTurnContext(input: unknown, language: 'en' | 'ru'): AgentTurnContext {
  const parsed = agentTurnContextSchema.safeParse(input ?? {});
  if (!parsed.success) return { intent: 'chat', selection: [], language };
  return { ...parsed.data, language: parsed.data.language ?? language };
}
