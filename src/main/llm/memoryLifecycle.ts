/** Tracks the assistant's local models and bounds cancellation, pause, unload and shutdown cleanup. */
import { controlLocalModel } from './localModels';
import { ollamaOrigin } from './modelList';
import type { AssistantMemoryState } from '../../shared/contracts/localModels';

/** Own requests and the models they used. Never stops a shared server or unloads unrelated models. */
export class AssistantMemoryLifecycle {
  private used = new Map<string, { baseURL: string; model: string }>();
  private controller = new AbortController();
  private stoppers = new Set<() => void | Promise<void>>();
  private pending: Promise<AssistantMemoryState> | null = null;
  private state: AssistantMemoryState = { phase: 'active', paused: false, models: [] };

  constructor(private readonly transport: typeof fetch = (...args) => globalThis.fetch(...args), private readonly timeoutMs = 15_000) {}

  status(): AssistantMemoryState {
    return { ...this.state, models: this.state.phase === 'active'
      ? [...this.used.values()].map(item => ({ name: item.model, released: false }))
      : this.state.models.map(item => ({ ...item })) };
  }
  isPaused(): boolean { return this.state.paused; }
  onStop(stop: () => void | Promise<void>): () => void {
    this.stoppers.add(stop);
    return () => { this.stoppers.delete(stop); };
  }
  track(config: { provider: string; baseURL?: string; model: string }): void {
    const origin = config.baseURL && ollamaOrigin(config.baseURL);
    if (this.isPaused() || config.provider !== 'local' || !origin || !config.model.trim()) return;
    this.used.set(`${origin}\n${config.model.trim()}`, { baseURL: config.baseURL!, model: config.model.trim() });
  }
  /** Captures this generation's signal; an old SDK client cannot resume work after a release. */
  fetch(base: typeof fetch = this.transport): typeof fetch {
    const lifetime = this.controller.signal;
    return (input, init) => {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      const combined = signal ? AbortSignal.any([lifetime, signal]) : lifetime;
      combined.throwIfAborted();
      return base(input, { ...init, signal: combined });
    };
  }
  /** Only an explicit user action resumes the assistant; background consumers must check isPaused/sendBlock. */
  resume(): AssistantMemoryState {
    if (this.pending) return this.status();
    if (this.controller.signal.aborted) this.controller = new AbortController();
    this.state = { phase: 'active', paused: false, models: [] };
    return this.status();
  }
  release(): Promise<AssistantMemoryState> {
    if (this.pending) return this.pending;
    this.state = { phase: 'releasing', paused: true, models: [...this.used.values()].map(item => ({ name: item.model, released: false })) };
    this.controller.abort();
    this.pending = this.releaseNow().finally(() => { this.pending = null; });
    return this.pending;
  }
  private async releaseNow(): Promise<AssistantMemoryState> {
    const deadline = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>(resolve => {
      timer = setTimeout(() => { deadline.abort(); resolve('timeout'); }, this.timeoutMs);
      timer.unref?.();
    });
    try {
      const stopped = await Promise.race([Promise.allSettled([...this.stoppers].map(stop => Promise.resolve().then(stop))), timeout]);
      if (stopped === 'timeout' || stopped.some(result => result.status === 'rejected')) {
        this.state = { ...this.state, phase: 'partial', error: 'stop-failed' };
        return this.status();
      }
      const boundedFetch: typeof fetch = (input, init) => {
        const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
        const combined = signal ? AbortSignal.any([deadline.signal, signal]) : deadline.signal;
        combined.throwIfAborted();
        return this.transport(input, { ...init, signal: combined });
      };
      const models: AssistantMemoryState['models'] = [];
      for (const [key, item] of this.used) {
        const result = await Promise.race([controlLocalModel(item.baseURL, item.model, 'unload', boundedFetch, true), timeout]);
        const released = result !== 'timeout' && result.ok;
        models.push({ name: item.model, released });
        if (released) this.used.delete(key);
      }
      this.state = { phase: models.some(item => !item.released) ? 'partial' : 'released', paused: true, models };
      return this.status();
    } catch {
      this.state = { ...this.state, phase: 'partial', paused: true };
      return this.status();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export const assistantMemory = new AssistantMemoryLifecycle();
