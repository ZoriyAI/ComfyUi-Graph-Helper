/**
 * Checks the turn context the renderer sends with a chat message (intent, selected objects, language, viewport)
 * before main's agent turn uses it (main/agent/turn.ts). The renderer is not trusted: whatever does not match is
 * dropped field by field, so a bad value never fails the whole turn.
 */
import { z } from 'zod';
import type { AgentTurnContext } from '../contracts/agent';

/** One ObjectRef (contracts/objects.ts); the length caps only guard against absurd input. */
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

/**
 * Protective (IPC input): a selection is the person's own data, so the guard sits far past any real canvas;
 * select-all on a 10000-node graph still arrives whole.
 */
const SELECTION_CAP = 100_000;

/** The schema of AgentTurnContext; every field falls back to a default instead of failing. */
export const agentTurnContextSchema = z.object({
  intent: z.enum(['ask', 'build', 'chat']).default('chat').catch('chat'),
  objectRef: objectRef.optional().catch(undefined),
  // Each item is checked on its own: a bad ref is dropped, the rest of the selection stays.
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
