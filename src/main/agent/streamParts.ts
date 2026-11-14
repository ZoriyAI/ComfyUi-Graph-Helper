/**
 * What of an AI SDK fullStream part reaches the renderer, and the loop guard on failed tool results.
 * Only the fields the chat uses are forwarded: provider metadata, raw request and response bodies, and
 * error objects (which can echo a request) stay in main. Error messages are redacted.
 */

import { classifyTurnError } from '../../shared/agent/turnError';

const FORWARDED = ['id', 'text', 'toolCallId', 'toolName', 'input', 'output', 'finishReason'] as const;
/** Protective: provider errors can echo a request; 500 characters (with "…") is enough to say what went wrong. */
const ERROR_CAP = 500;

export type Redact = (text: string) => string;

/** A plain, redacted message for any thrown value or stream error. */
export function errorMessage(error: unknown, redact: Redact, fallback = 'The assistant could not complete the request.'): string {
  let message = '';
  if (typeof error === 'string') message = error;
  else if (error instanceof Error) message = error.message;
  else if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') message = (error as { message: string }).message;
  message = message.trim();
  if (!message) return fallback;
  const clipped = message.length > ERROR_CAP ? `${message.slice(0, ERROR_CAP)}…` : message;
  return redact(clipped);
}

/** The renderer-facing copy of one fullStream part. */
export function forwardPart(part: { type: string } & Record<string, unknown>, redact: Redact): { type: string; content: Record<string, unknown> } {
  const content: Record<string, unknown> = { type: part.type };
  for (const key of FORWARDED) {
    if (part[key] !== undefined) content[key] = part[key];
  }
  if (part.error !== undefined) {
    // The chat says the kind in plain words; the server's own words stay a short redacted `details`.
    content.error = part.type === 'error'
      ? { message: errorMessage(part.error, redact, 'Unknown error'), ...classifyTurnError(part.error, redact) }
      : { message: errorMessage(part.error, redact, 'Unknown error') };
  }
  return { type: part.type, content };
}

function failed(output: unknown): boolean {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return false;
  const record = output as { success?: unknown; conflict?: unknown };
  return record.success === false || record.conflict === true;
}

/** Tool outcomes of every step in order: true for a failure or conflict, false for a success. */
export function toolOutcomes(steps: ReadonlyArray<{ content?: ReadonlyArray<unknown> }>): boolean[] {
  const outcomes: boolean[] = [];
  for (const step of steps) {
    for (const part of step.content ?? []) {
      if (!part || typeof part !== 'object') continue;
      const { type, output } = part as { type?: unknown; output?: unknown };
      if (type === 'tool-error') outcomes.push(true);
      else if (type === 'tool-result') outcomes.push(failed(output));
    }
  }
  return outcomes;
}

/** Stops the loop after `limit` failed or conflicted tool results in a row. */
export function failureStreakReached(limit: number) {
  return ({ steps }: { steps: ReadonlyArray<{ content?: ReadonlyArray<unknown> }> }): boolean => {
    const outcomes = toolOutcomes(steps);
    let streak = 0;
    for (let index = outcomes.length - 1; index >= 0 && outcomes[index]; index -= 1) streak += 1;
    return streak >= limit;
  };
}
