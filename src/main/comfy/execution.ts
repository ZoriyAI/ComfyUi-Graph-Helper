/** Bounded GET-only diagnosis of the configured ComfyUI. Never submits, retries or changes an existing job. */
import type Database from 'better-sqlite3';
import { comfyExecutionRequest, executionId, type ComfyExecutionRequest, type ComfyExecutionSnapshot, type ExecutionGuard, type ExecutionRead } from '../../shared/contracts/comfyExecution';
import { readSettings } from '../settings/repository';
import { reportedComfyUrl } from '../mcp/sync';
import { redactForLog } from '../log';
import { COMFY_ROUTES, comfyGet, comfyOriginOf, type ComfyAnswer } from './gate';
import { hardwareOf } from './hardware';
import { localModelStatus } from '../llm/localModels';
import { ollamaOrigin } from '../llm/modelList';

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, max = 1200): string => typeof value === 'string' ? redactForLog(value.slice(0, max)) : '';
const id = (value: unknown): string | null => { const result = executionId.safeParse(value); return result.success ? result.data : null; };
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const unread = <T>(error: string): ExecutionRead<T> => ({ ok: false, error });

function parsed<T>(answer: ComfyAnswer, parse: (value: unknown) => T | null): ExecutionRead<T> {
  if (!answer.ok) return unread(answer.error);
  const value = 'json' in answer ? parse(answer.json) : null;
  return value === null ? unread('shape') : { ok: true, value };
}

export function executionQueue(value: unknown): { pending: string[]; running: string[] } | null {
  const row = record(value);
  const list = (value: unknown): string[] | null => {
    if (!Array.isArray(value) || value.length > 1000) return null;
    const ids = value.map(item => Array.isArray(item) ? id(item[1]) : null);
    return ids.every((item): item is string => item !== null) ? ids : null;
  };
  const pending = list(row?.queue_pending), running = list(row?.queue_running);
  return pending && running ? { pending, running } : null;
}

export function executionGuard(value: unknown): ExecutionGuard | null {
  const row = record(value);
  if (!row || typeof row.installed !== 'boolean' || typeof row.state !== 'string') return null;
  const budgets = Object.fromEntries(Object.entries(record(row.budgets) ?? {}).slice(0, 32)
    .filter(([key, value]) => /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(key) && number(value) !== null)) as Record<string, number>;
  return { installed: row.installed, state: text(row.state, 80), promptId: id(row.prompt_id),
    reason: text(row.reason), reasonCode: text(row.reason_code, 120), checkedAt: number(row.checked_at_ms), budgets,
    runId: id(row.run_id), attemptId: id(row.attempt_id) };
}

export function executionHistory(value: unknown, promptId: string) {
  const root = record(value);
  if (!root) return null;
  if (!Object.hasOwn(root, promptId)) return { found: false, completed: false, status: '', error: '' };
  const item = record(root[promptId]), status = record(item?.status);
  if (!item || !status || typeof status.status_str !== 'string' || typeof status.completed !== 'boolean') return null;
  const messages = Array.isArray(status.messages) ? status.messages : [];
  const failure = messages.find(entry => Array.isArray(entry) && entry[0] === 'execution_error');
  return { found: true, completed: status.completed, status: text(status.status_str, 80),
    error: text(Array.isArray(failure) ? record(failure[1])?.exception_message : '') };
}

/** Origin comes from saved settings, never from a renderer request or an address in server error text. */
export async function collectComfyExecution(originText: string, request: ComfyExecutionRequest, fetchImpl: typeof fetch, assistantBase = ''): Promise<ComfyExecutionSnapshot> {
  const origin = comfyOriginOf(originText);
  const snapshot: ComfyExecutionSnapshot = { measuredAt: Date.now(), origin: origin?.origin ?? null,
    promptId: request.promptId ?? null, queue: unread('unconfigured'), guard: unread('unconfigured'), history: null,
    hardware: null, assistant: null, changedDuringRead: false };
  if (!origin) return snapshot;
  const assistantOrigin = assistantBase && ollamaOrigin(assistantBase);
  const [queue, guard, stats, assistant] = await Promise.all([
    comfyGet(origin, COMFY_ROUTES.queue(), fetchImpl),
    comfyGet(origin, COMFY_ROUTES.executionGuard(), fetchImpl),
    comfyGet(origin, { ...COMFY_ROUTES.systemStats(), timeoutMs: 5000 }, fetchImpl),
    assistantOrigin ? localModelStatus(assistantBase, fetchImpl) : Promise.resolve(null),
  ]);
  snapshot.queue = parsed(queue, executionQueue);
  snapshot.guard = parsed(guard, executionGuard);
  snapshot.hardware = stats.ok && 'json' in stats ? hardwareOf(origin.origin, stats.json) : null;
  snapshot.assistant = assistant && assistantOrigin ? { origin: assistantOrigin, status: assistant } : null;
  if (request.promptId) {
    const answer = await comfyGet(origin, COMFY_ROUTES.promptHistory(request.promptId), fetchImpl);
    snapshot.history = parsed(answer, value => executionHistory(value, request.promptId!));
  }
  snapshot.measuredAt = Date.now();
  return snapshot;
}

export async function readComfyExecution(db: Database.Database, input: unknown, fetchImpl: typeof fetch): Promise<ComfyExecutionSnapshot> {
  const request = comfyExecutionRequest.parse(input ?? {});
  const configuration = () => {
    const settings = readSettings(db);
    if (settings.source === 'corrupt') return { origin: '', assistant: '' };
    return { origin: settings.values.comfyOrigin || reportedComfyUrl(db) || '',
      assistant: settings.values.provider === 'local' ? settings.values.baseURL : settings.preferences?.providers.local.baseURL ?? '' };
  };
  const before = configuration();
  const snapshot = await collectComfyExecution(before.origin, request, fetchImpl, before.assistant);
  if (JSON.stringify(configuration()) !== JSON.stringify(before)) {
    snapshot.changedDuringRead = true;
    snapshot.queue = unread('changed'); snapshot.guard = unread('changed'); snapshot.history = null;
    snapshot.hardware = null; snapshot.assistant = null;
  }
  return snapshot;
}
