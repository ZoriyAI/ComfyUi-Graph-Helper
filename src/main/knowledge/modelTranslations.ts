/** Background translations of human model text. Raw headers, trigger words and filenames remain authoritative. */
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { ModelDetail, ModelTextTranslation } from '../../shared/contracts/knowledge';
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
export const modelTextHash = (fields: ModelTextFields) => createHash('sha256').update(JSON.stringify(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)))).digest('hex');
interface Task { directory: string; name: string; hash: string; fields: ModelTextFields }
export class ModelTranslations {
  private pending = new Map<string, Task>(); private running = false; private stopped = false;
  private controller: AbortController | null = null; private failures = new Map<string, number>();
  constructor(private readonly deps: { db: () => Database.Database; language: () => string; ready: () => boolean; translate: TranslateModelFields; now?: () => number }) {}
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
    const state: ModelTextTranslation['state'] = recentFailure && this.now() - recentFailure < 5 * 60_000 ? 'failed' : ready ? 'pending' : 'unavailable';
    if (state === 'pending' && !this.stopped) { this.pending.set(hash, { directory: detail.directory, name: detail.name, hash, fields }); void this.drain(); }
    return { ...detail, translation: { language: 'ru', state } };
  }
  /** All model folders, including LoRAs. Calls are deduplicated by actual prose; sync never waits for translation. */
  kick(): void {
    if (this.stopped || this.deps.language() !== 'ru' || !this.deps.ready()) return;
    const rows = this.deps.db().prepare('SELECT directory, name FROM model_catalog ORDER BY directory, name').all() as Array<{ directory: string; name: string }>;
    for (const row of rows) this.decorate(modelDetail(this.deps.db(), row.directory, row.name));
  }
  stop(): void { this.stopped = true; this.pending.clear(); this.controller?.abort(); }
  async idle(): Promise<void> { while (this.running) await new Promise((done) => setTimeout(done, 5)); }
  private async drain(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true; let consecutiveErrors = 0;
    try {
      while (this.pending.size && !this.stopped && this.deps.language() === 'ru' && this.deps.ready()) {
        const [hash, task] = this.pending.entries().next().value!; this.pending.delete(hash);
        if (this.cached(hash)) continue;
        this.controller = new AbortController(); const timer = setTimeout(() => this.controller?.abort(), 90_000); timer.unref?.();
        try {
          // Bounded chunks preserve the complete prose, including descriptions longer than one context budget.
          const translated: ModelTextFields = {};
          for (const [key, value] of Object.entries(task.fields)) {
            const chunks = value.match(/[\s\S]{1,5000}/g) ?? [];
            const result: string[] = [];
            for (const chunk of chunks) {
              if (this.stopped || this.controller.signal.aborted || this.deps.language() !== 'ru') throw Error('Translation cancelled');
              const response = await this.deps.translate({ text: chunk }, this.controller.signal);
              if (typeof response.text !== 'string' || !response.text.trim() || response.text.length > chunk.length * 8 + 2000) throw Error('Invalid translation');
              result.push(response.text);
            }
            translated[key] = result.join('');
          }
          if (this.stopped || this.controller.signal.aborted || this.deps.language() !== 'ru') continue;
          const current = modelDetail(this.deps.db(), task.directory, task.name);
          if (!current || modelTextHash(readableModelFields(current)) !== hash) continue;
          this.deps.db().prepare("INSERT INTO model_text_translations(source_hash, language, fields_json, updated_at) VALUES (?, 'ru', ?, ?) ON CONFLICT(source_hash, language) DO UPDATE SET fields_json=excluded.fields_json, updated_at=excluded.updated_at").run(hash, JSON.stringify(translated), this.now());
          this.failures.delete(hash); consecutiveErrors = 0;
        } catch { if (!this.stopped) { this.failures.set(hash, this.now()); consecutiveErrors += 1; } }
        finally { clearTimeout(timer); this.controller = null; }
        // A missing/unavailable provider must not make hundreds of failing paid calls.
        if (consecutiveErrors >= 3) { for (const pendingHash of this.pending.keys()) this.failures.set(pendingHash, this.now()); this.pending.clear(); break; }
      }
    } finally { this.running = false; }
  }
}
