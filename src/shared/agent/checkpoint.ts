/** A saved pause is a task to reconsider against the current graph, never a queue of tool calls to replay. */
import { z } from 'zod';
import { agentTurnContextSchema } from './turnContext';

export const TASK_TEXT_LIMIT = 100_000;
export const checkpointSchema = z.object({
  reason: z.enum(['step-limit', 'failure-streak', 'answer-limit', 'context-limit']),
  steps: z.number().int().min(0).max(1_000_000),
  failures: z.number().int().min(0).max(1_000_000).optional(),
  state: z.enum(['open', 'continued', 'stopped', 'closed']),
  context: agentTurnContextSchema.transform(value => ({ ...value, language: value.language ?? 'en' as const })).optional(),
  runId: z.string().min(1).max(200).optional(),
  graphKey: z.string().min(1).max(500).optional(),
  revisionId: z.string().max(200).optional(),
  task: z.string().max(TASK_TEXT_LIMIT).optional(),
  taskTruncated: z.boolean().optional(),
});

export type TaskCheckpoint = z.infer<typeof checkpointSchema>;
/** A corrupt saved card is dropped, while the conversation around it remains readable. */
export function readCheckpoint(input: unknown): TaskCheckpoint | undefined {
  try {
    const value = typeof input === 'string' ? JSON.parse(input) : input;
    const parsed = checkpointSchema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}
