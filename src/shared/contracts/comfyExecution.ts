/** Read-only execution evidence. Missing observations never mean an idle queue or a completed job. */
import { z } from 'zod';
import type { HardwareSnapshot } from './resources';
import type { LocalModelStatus } from './localModels';

export const executionId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const comfyExecutionRequest = z.object({ promptId: executionId.optional() }).strict();
export type ComfyExecutionRequest = z.infer<typeof comfyExecutionRequest>;
export type ExecutionRead<T> = { ok: true; value: T } | { ok: false; error: string };
export interface ExecutionGuard {
  installed: boolean; state: string; promptId: string | null; reason: string; reasonCode: string;
  checkedAt: number | null; budgets: Record<string, number>;
  runId: string | null; attemptId: string | null;
}
export interface ComfyExecutionSnapshot {
  measuredAt: number; origin: string | null; promptId: string | null;
  queue: ExecutionRead<{ pending: string[]; running: string[] }>;
  guard: ExecutionRead<ExecutionGuard>;
  history: ExecutionRead<{ found: boolean; completed: boolean; status: string; error: string }> | null;
  hardware: HardwareSnapshot | null;
  assistant: { origin: string; status: LocalModelStatus } | null;
  /** The HTTP observations are sequential/concurrent reads, not a transaction on the server. */
  changedDuringRead: boolean;
}
export type ExecutionStage = 'unconfigured' | 'changed' | 'unavailable' | 'running' | 'pending' | 'completed' | 'failed' | 'unknown' | 'idle';
export type ExecutionReason = 'vram' | 'ram' | 'lease' | 'foreign' | 'endpoint' | 'ollama' | 'host' | 'guard' | 'none' | 'unknown';

export function executionStage(snapshot: ComfyExecutionSnapshot): ExecutionStage {
  if (!snapshot.origin) return 'unconfigured';
  if (snapshot.changedDuringRead) return 'changed';
  if (!snapshot.queue.ok) return 'unavailable';
  const { promptId, queue, history } = snapshot;
  if (promptId) {
    if (queue.value.running.includes(promptId)) return 'running';
    if (queue.value.pending.includes(promptId)) return 'pending';
    if (history?.ok && history.value.found) {
      if (history.value.status === 'error') return 'failed';
      if (history.value.completed && history.value.status === 'success') return 'completed';
    }
    // Missing history can mean retention, another server, pre-submit admission or a moving queue.
    return 'unknown';
  }
  if (queue.value.running.length) return 'running';
  if (queue.value.pending.length) return 'pending';
  return 'idle';
}

export function executionReason(guard: ExecutionGuard): ExecutionReason {
  if (!guard.installed) return 'unknown';
  if (['idle', 'graphics'].includes(guard.state)) return 'none';
  if (!['waiting_resource', 'blocked_admission'].includes(guard.state)) return 'unknown';
  const known: Record<string, ExecutionReason> = {
    VRAM_CAPACITY_WAIT: 'vram', RAM_CAPACITY_WAIT: 'ram', GPU_LEASE_BUSY: 'lease',
    FOREIGN_GPU_COMPUTE_BUSY: 'foreign', HOST_PRESSURE_WAIT: 'host',
  };
  if (Object.hasOwn(known, guard.reasonCode)) return known[guard.reasonCode];
  if (/ECONNREFUSED|Connection refused|Errno 111/i.test(guard.reason)) return 'endpoint';
  if (/Ollama.*(?:loaded models|resident|externally used model)/i.test(guard.reason)) return 'ollama';
  return 'guard';
}
