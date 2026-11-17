/** Native admission and job identity regression cases. All HTTP replies below are explicit in-memory fixtures. */
import { describe, expect, it } from 'vitest';
import { collectComfyExecution, executionGuard, executionHistory, executionQueue } from '../../src/main/comfy/execution';
import { comfyExecutionRequest, executionReason, executionStage } from '../../src/shared/contracts/comfyExecution';
import { executionReport } from '../../src/shared/journey/executionReport';
import { COMFY_ROUTES } from '../../src/main/comfy/gate';
import { comfyErrorNotes } from '../../src/shared/knowledge/sets/foundations';

const origin = 'http://127.0.0.1:28001';
function fixture(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ path: string; method: string; body: unknown }> = [];
  const replies: Record<string, unknown> = {
    '/queue': { queue_pending: [[0, 'prompt-1', { privateGraph: 'not part of the report' }]], queue_running: [] },
    '/reference_studio/ollama/status': { installed: true, state: 'waiting_resource', prompt_id: 'prompt-1',
      reason_code: 'NATIVE_RESOURCE_AUTHORITY_WAIT', reason: '<urlopen error [Errno 111] Connection refused>', checked_at_ms: 1234,
      budgets: { vram_required_bytes: 123, vram_available_bytes: 456, ram_floor_bytes: 789 } },
    '/system_stats': { system: { ram_total: 1000, ram_free: 800 }, devices: [{ name: 'fixture GPU', type: 'cuda', vram_total: 600, vram_free: 500 }] },
    '/history/prompt-1': {}, '/api/ps': { models: [] }, ...overrides,
  };
  const fetchImpl = (async (url, init) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, method: init?.method ?? 'GET', body: init?.body });
    return Object.hasOwn(replies, path) ? new Response(JSON.stringify(replies[path])) : new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('ComfyUI execution observations', () => {
  it('keeps the accepted prompt pending and explains refusal without calling it a VRAM shortage', async () => {
    const f = fixture();
    const result = await collectComfyExecution(origin, { promptId: 'prompt-1' }, f.fetchImpl, `${origin}/v1`);
    expect(executionStage(result)).toBe('pending');
    expect(result.guard.ok && executionReason(result.guard.value)).toBe('endpoint');
    expect(result.assistant?.status).toMatchObject({ ok: true, models: [] });
    const report = JSON.parse(executionReport(result));
    expect(report).toMatchObject({ promptId: 'prompt-1', runId: null, attemptId: null, changes: { submittedPrompts: 0, workflow: false, resourceSettings: false } });
    expect(report.guard.budgets).toEqual({ vram_required_bytes: 123, vram_available_bytes: 456, ram_floor_bytes: 789 });
    expect(executionReport(result)).not.toContain('privateGraph');
    if (result.guard.ok) {
      result.guard.value.promptId = 'another-prompt'; result.guard.value.runId = 'another-run';
      expect(JSON.parse(executionReport(result))).toMatchObject({ runId: null, attemptId: null, reason: null, guardMatchesPrompt: false });
    }
    expect(f.calls.every(call => call.method === 'GET' && call.body === undefined)).toBe(true);
    expect(f.calls.map(call => call.path).sort()).toEqual(['/api/ps', '/history/prompt-1', '/queue', '/reference_studio/ollama/status', '/system_stats'].sort());
  });

  it('distinguishes native running, terminal success/error and missing history', async () => {
    const running = fixture({ '/queue': { queue_pending: [], queue_running: [[0, 'prompt-1', {}]] } });
    expect(executionStage(await collectComfyExecution(origin, { promptId: 'prompt-1' }, running.fetchImpl))).toBe('running');
    for (const status of ['success', 'error']) {
      const f = fixture({ '/queue': { queue_pending: [], queue_running: [] }, '/history/prompt-1': { 'prompt-1': {
        status: { completed: true, status_str: status, messages: [['execution_error', { exception_message: 'fixture failure' }]] },
      } } });
      expect(executionStage(await collectComfyExecution(origin, { promptId: 'prompt-1' }, f.fetchImpl))).toBe(status === 'success' ? 'completed' : 'failed');
    }
    const empty = fixture({ '/queue': { queue_pending: [], queue_running: [] } });
    expect(executionStage(await collectComfyExecution(origin, { promptId: 'prompt-1' }, empty.fetchImpl))).toBe('unknown');
    expect(executionStage(await collectComfyExecution(origin, {}, empty.fetchImpl))).toBe('idle');
  });

  it('does not turn missing or malformed observations into idle or completion', async () => {
    expect(executionQueue({})).toBeNull();
    expect(executionQueue({ queue_pending: [null], queue_running: [] })).toBeNull();
    expect(executionHistory({ 'prompt-1': { status: { completed: true } } }, 'prompt-1')).toBeNull();
    const f = fixture({ '/queue': { queue_pending: null }, '/api/ps': { models: [null] }, '/system_stats': { system: {}, devices: [null, 2, []] } });
    const result = await collectComfyExecution(origin, {}, f.fetchImpl, `${origin}/v1`);
    expect(executionStage(result)).toBe('unavailable');
    expect(result.assistant?.status.ok).toBe(false);
    expect(result.hardware?.devices).toEqual([]);
    result.changedDuringRead = true;
    expect(executionStage(result)).toBe('changed');
    const absent = fixture();
    expect(executionStage(await collectComfyExecution('', {}, absent.fetchImpl))).toBe('unconfigured');
    expect(absent.calls).toEqual([]);
  });

  it('keeps each explicit guard diagnosis separate and unknown codes explicit', () => {
    for (const [code, reason] of Object.entries({ VRAM_CAPACITY_WAIT: 'vram', RAM_CAPACITY_WAIT: 'ram', GPU_LEASE_BUSY: 'lease', FOREIGN_GPU_COMPUTE_BUSY: 'foreign', NATIVE_RESOURCE_AUTHORITY_WAIT: 'guard' })) {
      const guard = executionGuard({ installed: true, state: 'waiting_resource', reason_code: code })!;
      expect(executionReason(guard)).toBe(reason);
      expect(comfyErrorNotes(code, 'ru').length).toBeGreaterThan(0);
      expect(comfyErrorNotes(code, 'en').length).toBeGreaterThan(0);
    }
    expect(executionReason(executionGuard({ installed: true, state: 'idle', reason_code: 'VRAM_CAPACITY_WAIT' })!)).toBe('none');
    expect(executionReason(executionGuard({ installed: false, state: 'not_installed' })!)).toBe('unknown');
    expect(executionReason(executionGuard({ installed: true, state: 'future_state' })!)).toBe('unknown');
    expect(comfyErrorNotes('MCP: Not connected', 'ru').some(note => note.id === 'mcp-child-lost')).toBe(true);
  });

  it('never accepts a route, arbitrary address or forged prompt path from the window', () => {
    for (const value of ['../queue', '/prompt', 'a?clear=1', 'a/b', 'a%2fb', '', 'x'.repeat(129)]) {
      expect(() => COMFY_ROUTES.promptHistory(value)).toThrow();
      expect(comfyExecutionRequest.safeParse({ promptId: value }).success).toBe(false);
    }
    expect(comfyExecutionRequest.safeParse({ origin: 'http://another.test', promptId: 'valid' }).success).toBe(false);
  });
});
