/** A compact observational report, without graph payloads, model prompts or undisclosed Studio identities. */
import { executionReason, executionStage, type ComfyExecutionSnapshot } from '../contracts/comfyExecution';

export function executionReport(snapshot: ComfyExecutionSnapshot): string {
  const guard = snapshot.guard.ok ? snapshot.guard.value : null;
  const matchingGuard = guard && (!snapshot.promptId || guard.promptId === snapshot.promptId) ? guard : null;
  return JSON.stringify({ schema: 'nodewise-comfy-diagnostic/v1', measuredAt: new Date(snapshot.measuredAt).toISOString(),
    stage: executionStage(snapshot), promptId: snapshot.promptId, runId: matchingGuard?.runId ?? null, attemptId: matchingGuard?.attemptId ?? null,
    identitiesSource: 'ComfyUI observations; Studio identities are unknown unless reported by its guard',
    queue: snapshot.queue.ok ? { runningCount: snapshot.queue.value.running.length, pendingCount: snapshot.queue.value.pending.length,
      running: snapshot.queue.value.running.slice(0, 20), pending: snapshot.queue.value.pending.slice(0, 20) } : snapshot.queue,
    guard, guardRead: snapshot.guard.ok ? 'ok' : snapshot.guard.error, guardMatchesPrompt: Boolean(matchingGuard), reason: matchingGuard ? executionReason(matchingGuard) : null,
    history: snapshot.history, hardware: snapshot.hardware ? { ...snapshot.hardware, origin: '[configured ComfyUI]' } : null,
    assistant: snapshot.assistant ? { origin: '[configured assistant]', status: snapshot.assistant.status.ok
      ? { ...snapshot.assistant.status, models: snapshot.assistant.status.models.slice(0, 20), residentCount: snapshot.assistant.status.models.length }
      : snapshot.assistant.status } : null,
    limits: 'Separate read-only observations. Other Ollama endpoints, process owners and Studio journal were not read. No automatic resource or execution action.',
    changedDuringRead: snapshot.changedDuringRead, changes: { workflow: false, model: false, resourceSettings: false, routes: false, submittedPrompts: 0 },
  }, null, 2);
}
