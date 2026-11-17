/** Background translations of human model text. Raw headers, trigger words and filenames remain authoritative. */
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ModelDetail, ModelTextTranslation, ModelTranslationQueue, ModelTranslationControl } from '../../shared/contracts/knowledge';
import { textCarriesSecret } from '../../shared/config/draft';
import { modelDetail } from './repository';

export type ModelTextFields = Record<string, string>;
export type TranslateModelFields = (fields: ModelTextFields, signal: AbortSignal) => Promise<ModelTextFields>;
/** Only prose fields: never example prompts, trigger words, authors, file names or numeric training configuration. */
export function readableModelFields(detail: ModelDetail): ModelTextFields {
  const fields: ModelTextFields = {};
  const add = (key: string, value: unknown) => { if (typeof value === 'string' && value.trim() && /[A-Za-z]{3}/.test(value) && !textCarriesSecret(value)) fields[key] = value; };
  add('description', detail.description); add('notes', detail.notes.notes);
  add('web:summary', detail.web.found?.summary); add('web:notes', detail.web.found?.notes.notes);
  for (const [key, value] of Object.entries(detail.metadata)) {
    if (/(^|[._ -])(description|comment|notes|summary|instructions)([._ -]|$)/i.test(key) && !/(prompt|trigger|dataset|json|frequency)/i.test(key)) add(`metadata:${key}`, value);
  }
  return fields;
}
// A new translation policy must not silently keep older, lower-quality text as its result.
export const modelTextHash = (fields: ModelTextFields) => createHash('sha256').update('natural-ru-v2\n').update(JSON.stringify(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
interface Task { directory: string; name: string; hash: string; fields: ModelTextFields }
/** Keep words and identifiers whole; an oversized token stays in the original instead of being corrupted. */
export function modelTextChunks(text: string): string[] {
  const chunks: string[] = []; let remaining = text.trim();
  while (remaining.length > 5000) {
    let cut = remaining.lastIndexOf('\n', 5000);
    if (cut < 2500) cut = remaining.lastIndexOf(' ', 5000);
    if (cut < 1) throw Error('Description contains an oversized token');
    chunks.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
export class ModelTranslations {
  private pending = new Map<string, Task>(); private running = false; private stopped = false;
  private controller: AbortController | null = null; private failures = new Map<string, number>();
  private active: Task | null = null; private paused = false; private restartRequested = false;
  constructor(private readonly deps: { db: () => Database.Database; language: () => string; ready: () => boolean; translate: TranslateModelFields; now?: () => number }) {
    this.paused = (deps.db().prepare("SELECT value FROM sync_state WHERE key = 'model_translation_paused'").get() as { value: string } | undefined)?.value === '1';
  }
  private now = () => (this.deps.now?.() ?? Date.now());
  private cached(hash: string): ModelTextFields | null {
    const row = this.deps.db().prepare("SELECT fields_json FROM model_text_translations WHERE source_hash = ? AND language = 'ru'").get(hash) as { fields_json: string } | undefined;
    try { const value = row ? JSON.parse(row.fields_json) : null; return value && typeof value === 'object' && !Array.isArray(value) ? value : null; } catch { return null; }
  }
  decorate(detail: ModelDetail | null): ModelDetail | null {
    if (!detail || this.deps.language() !== 'ru') return detail;
    const fields = readableModelFields(detail); if (Object.keys(fields).length === 0) return detail;
    const hash = modelTextHash(fields); const cached = this.cached(hash);
    if (cached) return { ...detail, translation: { language: 'ru', state: 'ready', fields: cached } };
    const recentFailure = this.failures.get(hash); const ready = this.deps.ready();
    const state: ModelTextTranslation['state'] = this.paused ? 'paused' : recentFailure != null && this.now() - recentFailure < 5 * 60_000 ? 'failed' : ready ? 'pending' : 'unavailable';
    if (state === 'pending' && !this.stopped && this.active?.hash !== hash) { this.pending.set(hash, { directory: detail.directory, name: detail.name, hash, fields }); void this.drain(); }
    return { ...detail, translation: { language: 'ru', state } };
  }
  /** All model folders, including LoRAs. Calls are deduplicated by actual prose; sync never waits for translation. */
  kick(): void {
    if (this.stopped || this.paused || this.deps.language() !== 'ru' || !this.deps.ready()) return;
    const rows = this.deps.db().prepare('SELECT directory, name FROM model_catalog ORDER BY directory, name').all() as Array<{ directory: string; name: string }>;
    for (const row of rows) this.decorate(modelDetail(this.deps.db(), row.directory, row.name));
  }
  pause(): void { this.pending.clear(); this.controller?.abort(); }
  status(): ModelTranslationQueue {
    return {
      state: this.deps.language() !== 'ru' ? 'not-russian' : this.paused ? 'paused' : !this.deps.ready() ? 'unavailable' : this.running ? 'running' : 'idle',
      pending: this.pending.size, failed: [...this.failures.values()].filter(at => this.now() - at < 5 * 60_000).length,
      cached: (this.deps.db().prepare("SELECT COUNT(*) AS n FROM model_text_translations WHERE language='ru'").get() as { n: number }).n,
      active: this.active ? { directory: this.active.directory, name: this.active.name } : null,
    };
  }
  control(request: ModelTranslationControl): ModelTranslationQueue {
    if (request.action === 'pause' || request.action === 'resume') {
      this.paused = request.action === 'pause';
      this.deps.db().prepare("INSERT INTO sync_state(key,value) VALUES ('model_translation_paused',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(this.paused ? '1' : '0');
      if (this.paused) this.pause(); else { this.restartRequested = this.running; this.kick(); }
    } else {
      if (request.model) {
        const detail = modelDetail(this.deps.db(), request.model.directory, request.model.name);
        if (detail) {
          const hash = modelTextHash(readableModelFields(detail)); this.failures.delete(hash);
          this.deps.db().prepare("DELETE FROM model_text_translations WHERE source_hash=? AND language='ru'").run(hash);
          this.decorate(detail);
        }
      } else { this.failures.clear(); this.kick(); }
    }
    return this.status();
  }
  stop(): void { this.stopped = true; this.pause(); }
  async idle(): Promise<void> { while (this.running) await new Promise((done) => setTimeout(done, 5)); }
  private async drain(): Promise<void> {
    if (this.running || this.stopped || this.paused) return;
    this.running = true; let consecutiveErrors = 0;
    try {
      while (this.pending.size && !this.stopped && !this.paused && this.deps.language() === 'ru' && this.deps.ready()) {
        const [hash, task] = this.pending.entries().next().value!; this.pending.delete(hash);
        if (this.cached(hash)) continue;
        this.active = task; this.controller = new AbortController(); const controller = this.controller;
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90_000); timer.unref?.();
        try {
          // Bounded chunks preserve the complete prose, including descriptions longer than one context budget.
          const translated: ModelTextFields = {};
          const repeated = new Map<string, string>();
          for (const [key, value] of Object.entries(task.fields)) {
            if (repeated.has(value)) { translated[key] = repeated.get(value)!; continue; }
            const chunks = modelTextChunks(value);
            const result: string[] = [];
            for (const chunk of chunks) {
              if (this.stopped || this.controller.signal.aborted || this.deps.language() !== 'ru') throw Error('Translation cancelled');
              // Even an adapter that ignores cancellation must not block pause or app exit.
              const response = await new Promise<ModelTextFields>((resolve, reject) => {
                const abort = () => reject(new Error('Translation cancelled'));
                controller.signal.addEventListener('abort', abort, { once: true });
                void Promise.resolve().then(() => { controller.signal.throwIfAborted(); return this.deps.translate({ text: chunk }, controller.signal); })
                  .then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
              });
              if (typeof response.text !== 'string' || !response.text.trim() || response.text.length > chunk.length * 8 + 2000) throw Error('Invalid translation');
              result.push(response.text);
            }
            translated[key] = result.join('\n');
            repeated.set(value, translated[key]);
          }
          if (this.stopped || this.controller.signal.aborted || this.deps.language() !== 'ru') continue;
          const current = modelDetail(this.deps.db(), task.directory, task.name);
          if (!current || modelTextHash(readableModelFields(current)) !== hash) continue;
          this.deps.db().prepare("INSERT INTO model_text_translations(source_hash, language, fields_json, updated_at) VALUES (?, 'ru', ?, ?) ON CONFLICT(source_hash, language) DO UPDATE SET fields_json=excluded.fields_json, updated_at=excluded.updated_at").run(hash, JSON.stringify(translated), this.now());
          this.failures.delete(hash); consecutiveErrors = 0;
        } catch { if (!this.stopped && (timedOut || !controller.signal.aborted)) { this.failures.set(hash, this.now()); consecutiveErrors += 1; } }
        finally { clearTimeout(timer); this.controller = null; this.active = null; }
        // A missing/unavailable provider must not make hundreds of failing paid calls.
        if (consecutiveErrors >= 3) { for (const pendingHash of this.pending.keys()) this.failures.set(pendingHash, this.now()); this.pending.clear(); break; }
      }
    } finally { this.running = false; if (this.restartRequested) { this.restartRequested = false; this.kick(); } }
  }
}
