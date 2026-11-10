import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * The model conversation log: what the app sent to a model (local or cloud) and what came back, one file per
 * turn under `<logs>/model/`, one JSON object per line. It exists so a person can hand a failed or odd answer to
 * someone who will read it: the prompt, every step's text, every tool call with its result, errors with the
 * server's own words, token counts and timings, and the exact request and response bodies on the wire.
 *
 * Rules it keeps:
 * - Every string passes through the redactor (heuristics plus the exact held keys and the MCP token); request
 *   headers are never recorded, so no credential is written even when the redactor would miss one.
 * - It stays on this computer. Nothing here sends anything; export is a file the person saves themselves.
 * - It is bounded: one text is capped, one turn is capped, the folder is capped by size and by count.
 * Pure Node (no Electron import), so tests can drive it.
 */

export type Redact = (text: string) => string;

/** One captured text (a prompt, a body): longer ones are cut and say how long they were. */
export const TEXT_CAP = 2_000_000;
/** One turn file stops taking bodies past this size; the turn's end is still written. */
export const TURN_CAP_BYTES = 30 * 1024 * 1024;
/** The folder keeps at most this much, oldest turns removed first. */
export const FOLDER_CAP_BYTES = 150 * 1024 * 1024;
export const FOLDER_CAP_FILES = 300;
export const TRACE_FOLDER = 'model';
const FILE_PREFIX = 'turn-';
const FILE_SUFFIX = '.jsonl';
/** Response headers worth keeping: ids for the provider's support, rate limits, timing. Never a credential. */
const RESPONSE_HEADERS = /^(content-type|x-request-id|request-id|retry-after|openai-processing-ms|x-ratelimit-.*|anthropic-ratelimit-.*)$/i;

export interface TraceConfig {
  /** The log folder (`<userData>/logs`); turns go into its `model` subfolder. */
  dir: string;
  redact: Redact;
  /** Read at every turn start: Settings ▸ Privacy ▸ "Keep a log of the conversation with the model". */
  enabled: () => boolean;
  now?: () => number;
  folderCapBytes?: number;
  folderCapFiles?: number;
  turnCapBytes?: number;
  textCap?: number;
}

export interface TurnMeta {
  provider: string;
  model: string;
  /** Origin of the server the turn talked to, without credentials, path or query. */
  baseUrl: string;
  intent?: string;
  language?: string;
  runId?: string;
  projectId?: string;
  maxSteps?: number;
  app?: string;
  platform?: string;
}

export interface TraceSummary {
  id: string;
  startedAt: number;
  provider: string;
  model: string;
  baseUrl: string;
  intent: string;
  /** 'ok', 'paused', 'cancelled', 'error', or 'unfinished' when the turn never wrote its end. */
  outcome: string;
  steps: number;
  toolCalls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  error: string | null;
  bytes: number;
  /** First words of the person's message, for telling turns apart in a list. */
  question: string;
}

export type TraceEvent = { t: number; type: string } & Record<string, unknown>;

let config: (Required<Pick<TraceConfig, 'dir' | 'redact' | 'enabled'>> & {
  now: () => number;
  folderCapBytes: number;
  folderCapFiles: number;
  turnCapBytes: number;
  textCap: number;
}) | null = null;

export function configureModelTrace(options: TraceConfig): void {
  config = {
    dir: path.join(options.dir, TRACE_FOLDER),
    redact: options.redact,
    enabled: options.enabled,
    now: options.now ?? (() => Date.now()),
    folderCapBytes: options.folderCapBytes ?? FOLDER_CAP_BYTES,
    folderCapFiles: options.folderCapFiles ?? FOLDER_CAP_FILES,
    turnCapBytes: options.turnCapBytes ?? TURN_CAP_BYTES,
    textCap: options.textCap ?? TEXT_CAP,
  };
}

/** The folder turns are written to, or null before configuration. */
export function traceDir(): string | null {
  return config?.dir ?? null;
}

function fileOf(id: string): string | null {
  if (!config || !/^[0-9A-Za-z-]{8,64}$/.test(id)) return null;
  return path.join(config.dir, `${FILE_PREFIX}${id}${FILE_SUFFIX}`);
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

function newId(now: number): string {
  const date = new Date(now);
  const stamp = `${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}-${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}`;
  return `${stamp}-${randomBytes(3).toString('hex')}`;
}

/** Origin only: a base URL can carry a path, a query or userinfo that say more than the log needs. */
export function originOf(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function turnFiles(dir: string): Array<{ name: string; file: string; bytes: number; mtime: number }> {
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const rows: Array<{ name: string; file: string; bytes: number; mtime: number }> = [];
  for (const name of names) {
    if (!name.startsWith(FILE_PREFIX) || !name.endsWith(FILE_SUFFIX)) continue;
    const file = path.join(dir, name);
    try {
      const stat = fs.statSync(file);
      if (stat.isFile()) rows.push({ name, file, bytes: stat.size, mtime: stat.mtimeMs });
    } catch {
      // Removed meanwhile.
    }
  }
  // Names start with a UTC timestamp, so name order is time order.
  return rows.sort((left, right) => (left.name < right.name ? -1 : 1));
}

/** Removes the oldest turns until the folder fits its caps. `keep` is never removed (the turn being written). */
function prune(keep: string | null): void {
  if (!config) return;
  const rows = turnFiles(config.dir);
  let bytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  let count = rows.length;
  for (const row of rows) {
    if (bytes <= config.folderCapBytes && count <= config.folderCapFiles) break;
    if (row.file === keep) continue;
    try {
      fs.unlinkSync(row.file);
      bytes -= row.bytes;
      count -= 1;
    } catch {
      // Still open elsewhere; the next turn tries again.
    }
  }
}

function errorFields(error: unknown, redact: Redact, cap: number): Record<string, unknown> {
  if (!error || typeof error !== 'object') return { message: redact(String(error ?? '')).slice(0, cap) };
  const record = error as Record<string, unknown>;
  const fields: Record<string, unknown> = {};
  if (typeof record.name === 'string') fields.name = record.name;
  if (typeof record.message === 'string') fields.message = redact(record.message).slice(0, cap);
  if (typeof record.statusCode === 'number') fields.status = record.statusCode;
  // The provider's own error body says what a fixed sentence cannot ("model does not support tools").
  if (typeof record.responseBody === 'string') fields.responseBody = redact(record.responseBody).slice(0, cap);
  const cause = record.cause;
  if (cause && typeof cause === 'object') {
    const inner = cause as Record<string, unknown>;
    if (typeof inner.code === 'string') fields.code = inner.code;
    if (typeof inner.message === 'string') fields.cause = redact(inner.message).slice(0, 1000);
  }
  return fields;
}

/** One turn being recorded. Every method is safe to call after the file failed: logging never breaks a turn. */
export class TurnTrace {
  readonly id: string;
  readonly file: string;
  private readonly started: number;
  private bytes = 0;
  private full = false;
  private ended = false;
  private step = 0;
  private stepStarted = 0;
  private firstTokenAt: number | null = null;
  private text = '';
  private reasoning = '';
  private steps = 0;
  private toolCalls = 0;
  private inputTokens: number | null = null;
  private outputTokens: number | null = null;
  private lastError: string | null = null;
  private pending: Array<Promise<void>> = [];

  constructor(private readonly options: NonNullable<typeof config>, meta: TurnMeta) {
    this.started = options.now();
    this.id = newId(this.started);
    this.file = path.join(options.dir, `${FILE_PREFIX}${this.id}${FILE_SUFFIX}`);
    this.write('turn-start', { id: this.id, startedAt: new Date(this.started).toISOString(), ...meta, baseUrl: originOf(meta.baseUrl) || meta.baseUrl });
  }

  private clip(value: string): string {
    const cap = this.options.textCap;
    const redacted = this.options.redact(value);
    return redacted.length > cap ? `${redacted.slice(0, cap)}…[cut: ${redacted.length} characters in all]` : redacted;
  }

  private safe(value: unknown): unknown {
    if (typeof value === 'string') return this.clip(value);
    if (value === undefined) return undefined;
    try {
      const json = JSON.stringify(value);
      if (json === undefined) return undefined;
      const clipped = this.clip(json);
      // Kept as structured data when it survived whole, as text when it had to be cut.
      return clipped === json ? JSON.parse(clipped) : clipped;
    } catch {
      return '[unserializable]';
    }
  }

  private write(type: string, data: Record<string, unknown>, body = false): void {
    if (this.ended && type !== 'turn-end') return;
    // Past the cap the turn keeps its small events and drops bodies, so the end is always readable.
    if (body && (this.full || this.bytes > this.options.turnCapBytes)) {
      if (!this.full) {
        this.full = true;
        this.write('truncated', { reason: 'turn size cap reached; later bodies are not recorded' });
      }
      return;
    }
    try {
      const line = `${JSON.stringify({ t: this.options.now() - this.started, type, ...data })}\n`;
      fs.appendFileSync(this.file, line);
      this.bytes += Buffer.byteLength(line);
    } catch {
      // A full disk or a removed folder must not break the conversation.
    }
  }

  /** What the model was given at the start of the turn: the system text, the dialog and the tools on offer. */
  prompt(input: { system: string; messages: Array<{ role: string; content: string }>; tools: Array<{ name: string; description?: string }> }): void {
    const question = [...input.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    // A small line of its own, before the large prompt, so a list of turns can show it without reading bodies.
    this.write('question', { text: this.clip(question).slice(0, 300) });
    this.write('prompt', {
      systemChars: input.system.length,
      system: this.clip(input.system),
      messages: input.messages.map((message) => ({ role: message.role, content: this.clip(message.content) })),
      tools: input.tools.map((tool) => ({ name: tool.name, descriptionChars: tool.description?.length ?? 0 })),
    }, true);
  }

  private flushText(): void {
    if (this.reasoning !== '') {
      this.write('reasoning', { step: this.step, text: this.clip(this.reasoning) }, true);
      this.reasoning = '';
    }
    if (this.text !== '') {
      this.write('text', { step: this.step, text: this.clip(this.text) }, true);
      this.text = '';
    }
  }

  /** One part of the AI SDK's full stream. Deltas are gathered and written once per step. */
  part(part: { type: string } & Record<string, unknown>): void {
    const now = this.options.now();
    switch (part.type) {
      case 'start-step':
        this.step += 1;
        this.steps = this.step;
        this.stepStarted = now;
        this.firstTokenAt = null;
        this.write('step-start', { step: this.step });
        break;
      case 'text-delta':
        if (typeof part.text === 'string') {
          if (this.firstTokenAt === null) this.firstTokenAt = now;
          this.text += part.text;
        }
        break;
      case 'reasoning-delta':
        if (typeof part.text === 'string') {
          if (this.firstTokenAt === null) this.firstTokenAt = now;
          this.reasoning += part.text;
        }
        break;
      case 'tool-call':
        this.flushText();
        this.toolCalls += 1;
        if (this.firstTokenAt === null) this.firstTokenAt = now;
        this.write('tool-call', { step: this.step, id: part.toolCallId, name: part.toolName, input: this.safe(part.input) }, true);
        break;
      case 'tool-result': {
        const output = part.output as { success?: unknown; conflict?: unknown } | undefined;
        const failed = Boolean(output && typeof output === 'object' && (output.success === false || output.conflict === true));
        this.write('tool-result', { step: this.step, id: part.toolCallId, name: part.toolName, ok: !failed, output: this.safe(part.output) }, true);
        break;
      }
      case 'tool-error':
        this.write('tool-error', { step: this.step, id: part.toolCallId, name: part.toolName, error: errorFields(part.error, this.options.redact, 4000) });
        break;
      case 'finish-step': {
        this.flushText();
        const usage = part.usage as { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
        if (typeof usage?.inputTokens === 'number') this.inputTokens = (this.inputTokens ?? 0) + usage.inputTokens;
        if (typeof usage?.outputTokens === 'number') this.outputTokens = (this.outputTokens ?? 0) + usage.outputTokens;
        const response = part.response as { id?: unknown; modelId?: unknown } | undefined;
        this.write('step-finish', {
          step: this.step,
          finishReason: part.finishReason,
          usage: usage ? { input: usage.inputTokens ?? null, output: usage.outputTokens ?? null, total: usage.totalTokens ?? null } : null,
          ms: this.stepStarted ? now - this.stepStarted : null,
          firstTokenMs: this.firstTokenAt !== null && this.stepStarted ? this.firstTokenAt - this.stepStarted : null,
          responseId: typeof response?.id === 'string' ? response.id : undefined,
          servedModel: typeof response?.modelId === 'string' ? response.modelId : undefined,
        });
        break;
      }
      case 'error': {
        this.flushText();
        const fields = errorFields(part.error, this.options.redact, 4000);
        this.lastError = typeof fields.message === 'string' ? fields.message : 'error';
        this.write('error', { step: this.step, ...fields });
        break;
      }
      case 'abort':
        this.flushText();
        this.write('abort', { step: this.step });
        break;
      default:
        break;
    }
  }

  /** An error thrown outside the stream (before the first step, or by the transport). */
  fail(error: unknown): void {
    this.flushText();
    const fields = errorFields(error, this.options.redact, 4000);
    this.lastError = typeof fields.message === 'string' ? fields.message : 'error';
    this.write('error', { step: this.step, ...fields });
  }

  /**
   * A fetch that records the request and the response on the wire for this turn. Request headers are never
   * recorded (that is where keys travel); the URL keeps origin and path only. The response is read from a clone,
   * so the caller's stream is untouched.
   */
  readonly fetch: typeof fetch = async (input, init) => {
    const started = this.options.now();
    let url = '';
    try {
      const parsed = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url);
      url = `${parsed.origin}${parsed.pathname}`;
    } catch {
      url = '';
    }
    const body = typeof init?.body === 'string' ? init.body : null;
    this.write('wire-request', { step: this.step + 1, method: init?.method ?? 'GET', url, bodyChars: body?.length ?? null, body: body === null ? null : this.clip(body) }, true);
    let response: Response;
    try {
      response = await fetch(input, init);
    } catch (error) {
      this.write('wire-error', { url, ms: this.options.now() - started, ...errorFields(error, this.options.redact, 2000) });
      throw error;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (RESPONSE_HEADERS.test(name)) headers[name] = value;
    });
    let copy: Response | null = null;
    try {
      copy = response.clone();
    } catch {
      copy = null;
    }
    const record = async () => {
      let text = '';
      let chars = 0;
      let cut = false;
      try {
        const reader = copy?.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const piece = decoder.decode(value, { stream: true });
            chars += piece.length;
            // Past the cap the copy is still drained (an unread branch would buffer), but no longer kept.
            if (text.length < this.options.textCap) text += piece;
            else cut = true;
          }
        }
      } catch {
        cut = true;
      }
      this.write('wire-response', {
        url,
        status: response.status,
        headers,
        ms: this.options.now() - started,
        bodyChars: chars,
        ...(cut ? { incomplete: true } : {}),
        body: this.clip(text),
      }, true);
    };
    const done = record();
    this.pending.push(done);
    return response;
  };

  /** Ends the turn. Waits briefly for response bodies still being copied so they land before the end line. */
  async finish(outcome: 'ok' | 'paused' | 'cancelled' | 'error', extra: Record<string, unknown> = {}): Promise<void> {
    if (this.ended) return;
    this.flushText();
    await Promise.race([Promise.allSettled(this.pending), new Promise((resolve) => setTimeout(resolve, 1500))]);
    const ms = this.options.now() - this.started;
    this.write('turn-end', {
      outcome: this.lastError && outcome === 'ok' ? 'error' : outcome,
      steps: this.steps,
      toolCalls: this.toolCalls,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      ms,
      error: this.lastError,
      ...extra,
    });
    this.ended = true;
  }
}

/** Starts recording a turn, or returns null when the log is off or not set up. Never throws. */
export function startTurnTrace(meta: TurnMeta): TurnTrace | null {
  if (!config) return null;
  try {
    if (!config.enabled()) return null;
    fs.mkdirSync(config.dir, { recursive: true });
    const trace = new TurnTrace(config, meta);
    prune(trace.file);
    return trace;
  } catch {
    return null;
  }
}

function parseLines(text: string): TraceEvent[] {
  const events: TraceEvent[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      const parsed = JSON.parse(line) as TraceEvent;
      if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') events.push(parsed);
    } catch {
      // A line cut by a crash is skipped.
    }
  }
  return events;
}

/** Every event of a turn, or null when there is no such turn. */
export function readTurnTrace(id: string): TraceEvent[] | null {
  const file = fileOf(id);
  if (!file) return null;
  try {
    return parseLines(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readHead(file: string, bytes: number): string {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const read = fs.readSync(fd, buffer, 0, bytes, 0);
    return buffer.subarray(0, read).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function readTail(file: string, size: number, bytes: number): string {
  const fd = fs.openSync(file, 'r');
  try {
    const length = Math.min(bytes, size);
    const buffer = Buffer.alloc(length);
    const read = fs.readSync(fd, buffer, 0, length, size - length);
    return buffer.subarray(0, read).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** The newest turns first, described from the first and the last lines of each file (bodies are not read). */
export function listTurnTraces(limit = 100): TraceSummary[] {
  if (!config) return [];
  const rows = turnFiles(config.dir).reverse().slice(0, limit);
  const out: TraceSummary[] = [];
  for (const row of rows) {
    try {
      // The start and the question are the first two short lines; the end is the last one.
      const firstLines = parseLines(readHead(row.file, 16 * 1024).split('\n').slice(0, 2).join('\n'));
      const head = firstLines[0];
      if (!head || head.type !== 'turn-start') continue;
      const asked = firstLines[1]?.type === 'question' ? String(firstLines[1].text ?? '').slice(0, 120) : '';
      const tailEvents = parseLines(readTail(row.file, row.bytes, 16 * 1024));
      const end = [...tailEvents].reverse().find((event) => event.type === 'turn-end');
      out.push({
        id: String(head.id ?? row.name.slice(FILE_PREFIX.length, -FILE_SUFFIX.length)),
        startedAt: Date.parse(String(head.startedAt ?? '')) || row.mtime,
        provider: String(head.provider ?? ''),
        model: String(head.model ?? ''),
        baseUrl: String(head.baseUrl ?? ''),
        intent: String(head.intent ?? ''),
        outcome: end ? String(end.outcome ?? 'ok') : 'unfinished',
        steps: typeof end?.steps === 'number' ? end.steps : 0,
        toolCalls: typeof end?.toolCalls === 'number' ? end.toolCalls : 0,
        inputTokens: typeof end?.inputTokens === 'number' ? end.inputTokens : null,
        outputTokens: typeof end?.outputTokens === 'number' ? end.outputTokens : null,
        durationMs: typeof end?.ms === 'number' ? end.ms : null,
        error: typeof end?.error === 'string' ? end.error : null,
        bytes: row.bytes,
        question: asked,
      });
    } catch {
      // An unreadable file is not listed.
    }
  }
  return out;
}

/** How much the log holds right now. */
export function traceUsage(): { files: number; bytes: number } {
  if (!config) return { files: 0, bytes: 0 };
  const rows = turnFiles(config.dir);
  return { files: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0) };
}

/** Removes every recorded turn. Returns how many files went. */
export function clearTurnTraces(): number {
  if (!config) return 0;
  let removed = 0;
  for (const row of turnFiles(config.dir)) {
    try {
      fs.unlinkSync(row.file);
      removed += 1;
    } catch {
      // Left for the next clear.
    }
  }
  return removed;
}

/**
 * Writes the chosen turns into one file a person can send: a first line with what the reader needs to know about
 * the app (versions, settings without secrets, the tail of the main log), then every turn's lines as recorded.
 * Returns the bytes written.
 */
export function exportTurnTraces(ids: string[], target: string, header: Record<string, unknown>): { bytes: number; turns: number } {
  const out = fs.openSync(target, 'w');
  let bytes = 0;
  let turns = 0;
  try {
    const first = `${JSON.stringify({ type: 'bundle', exportedAt: new Date().toISOString(), turns: ids.length, ...header })}\n`;
    fs.writeSync(out, first);
    bytes += Buffer.byteLength(first);
    for (const id of ids) {
      const file = fileOf(id);
      if (!file) continue;
      try {
        const content = fs.readFileSync(file);
        fs.writeSync(out, content);
        bytes += content.length;
        turns += 1;
      } catch {
        // A turn removed meanwhile is skipped.
      }
    }
  } finally {
    fs.closeSync(out);
  }
  return { bytes, turns };
}

function cut(value: unknown, cap: number): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return text.length > cap ? `${text.slice(0, cap)}… [ещё ${text.length - cap} симв.]` : text;
}

/**
 * A short report of one turn for pasting into a chat: what was asked, what the model was given (sizes and the
 * start of the system text), each step with its text, tool calls and results cut to readable lengths, errors in
 * full, tokens and timings. The whole detail stays in the exported file.
 */
export function turnReport(events: TraceEvent[]): string {
  const start = events.find((event) => event.type === 'turn-start');
  const prompt = events.find((event) => event.type === 'prompt');
  const end = [...events].reverse().find((event) => event.type === 'turn-end');
  const lines: string[] = [];
  lines.push(`# Ход ${String(start?.id ?? '')}`);
  lines.push(`- Модель: ${String(start?.provider ?? '')} / ${String(start?.model ?? '')}${start?.baseUrl ? ` (${String(start.baseUrl)})` : ''}`);
  lines.push(`- Режим: ${String(start?.intent ?? '—')}, язык: ${String(start?.language ?? '—')}, лимит шагов: ${String(start?.maxSteps ?? '—')}`);
  lines.push(`- Приложение: ${String(start?.app ?? '—')}, система: ${String(start?.platform ?? '—')}, начало: ${String(start?.startedAt ?? '')}`);
  if (end) {
    lines.push(`- Итог: ${String(end.outcome)}; шагов: ${String(end.steps)}; вызовов инструментов: ${String(end.toolCalls)}; токены: вход ${String(end.inputTokens ?? '—')}, выход ${String(end.outputTokens ?? '—')}; время: ${String(end.ms)} мс`);
    if (end.error) lines.push(`- Ошибка: ${String(end.error)}`);
  } else {
    lines.push('- Итог: ход не завершён (нет записи конца)');
  }
  if (prompt) {
    const tools = Array.isArray(prompt.tools) ? (prompt.tools as Array<{ name?: string }>).map((tool) => tool.name).filter(Boolean) : [];
    const messages = Array.isArray(prompt.messages) ? prompt.messages as Array<{ role?: string; content?: string }> : [];
    lines.push('', '## Что получила модель');
    lines.push(`- Системный текст: ${String(prompt.systemChars ?? 0)} симв.; сообщений в диалоге: ${messages.length}; инструментов: ${tools.length}`);
    lines.push(`- Инструменты: ${tools.join(', ') || '—'}`);
    lines.push('', '### Начало системного текста', '```', cut(prompt.system, 3000), '```');
    lines.push('', '### Диалог');
    for (const message of messages.slice(-8)) lines.push(`**${String(message.role)}:** ${cut(message.content ?? '', 1500)}`, '');
  }
  lines.push('## Шаги');
  for (const event of events) {
    if (event.type === 'step-start') lines.push('', `### Шаг ${String(event.step)}`);
    else if (event.type === 'reasoning') lines.push(`_рассуждение:_ ${cut(event.text, 800)}`);
    else if (event.type === 'text') lines.push(`**текст модели:** ${cut(event.text, 2000)}`);
    else if (event.type === 'tool-call') lines.push(`- вызов \`${String(event.name)}\`: \`${cut(event.input, 700)}\``);
    else if (event.type === 'tool-result') lines.push(`  - результат ${event.ok === false ? 'С ОШИБКОЙ' : 'ок'}: \`${cut(event.output, 700)}\``);
    else if (event.type === 'tool-error') lines.push(`  - ошибка инструмента: \`${cut(event.error, 1500)}\``);
    else if (event.type === 'step-finish') {
      const usage = event.usage as { input?: unknown; output?: unknown } | null;
      lines.push(`- конец шага: ${String(event.finishReason ?? '—')}; токены вход ${String(usage?.input ?? '—')}, выход ${String(usage?.output ?? '—')}; ${String(event.ms ?? '—')} мс, первый токен через ${String(event.firstTokenMs ?? '—')} мс${event.servedModel ? `; ответила модель ${String(event.servedModel)}` : ''}`);
    } else if (event.type === 'error') {
      lines.push(`- **ошибка**${event.status ? ` HTTP ${String(event.status)}` : ''}: ${cut(event.message ?? '', 3000)}`);
      if (event.responseBody) lines.push('```', cut(event.responseBody, 3000), '```');
    } else if (event.type === 'wire-error') lines.push(`- **сеть**: ${cut(event.message ?? event.code ?? '', 1000)} (${String(event.url ?? '')})`);
    else if (event.type === 'truncated') lines.push(`- _журнал обрезан: ${String(event.reason)}_`);
    else if (event.type === 'abort') lines.push('- остановлено человеком');
  }
  const wire = events.filter((event) => event.type === 'wire-response');
  if (wire.length > 0) {
    lines.push('', '## Запросы к серверу');
    for (const event of wire) lines.push(`- ${String(event.url)} → HTTP ${String(event.status)}, ${String(event.ms)} мс, ответ ${String(event.bodyChars)} симв.`);
  }
  lines.push('', '_Полные запросы и ответы — в файле журнала этого хода._');
  return lines.join('\n');
}
