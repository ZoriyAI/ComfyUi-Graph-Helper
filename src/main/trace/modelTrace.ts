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
 *   The folder, each record and each saved file are readable by the owner only.
 * - It is bounded: one text is capped, one turn is capped, the folder is capped by size and by count.
 * Pure Node (no Electron import), so tests can drive it.
 *
 * Who uses it: main/index.ts configures it at start; agent/turn.ts, agent/buildTools.ts, llmService.ts and
 * llm/localContextStore.ts record turns; ipc/agentIpc.ts and ipc/diagnosticsIpc.ts serve the log window
 * (list, read, copy report, export, clear).
 */
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { createTranslator } from '../../shared/i18n';

/** Hides secrets in a text before it is written (main/index.ts passes the app's redactor). */
export type Redact = (text: string) => string;

/** One captured text (a prompt, a body): longer ones are cut and say how long they were. */
export const TEXT_CAP = 2_000_000;
/** One turn file stops taking bodies past this size; the turn's end is still written. */
export const TURN_CAP_BYTES = 30 * 1024 * 1024;
/** The folder keeps at most this much, oldest turns removed first. */
export const FOLDER_CAP_BYTES = 150 * 1024 * 1024;
/** The folder keeps at most this many turn files. */
export const FOLDER_CAP_FILES = 300;
/** The subfolder of the log folder that holds the turn files. */
export const TRACE_FOLDER = 'model';
const FILE_PREFIX = 'turn-';
const FILE_SUFFIX = '.jsonl';
/** Response headers worth keeping: ids for the provider's support, rate limits, timing. Never a credential. */
const RESPONSE_HEADERS = /^(content-type|x-request-id|request-id|retry-after|openai-processing-ms|x-ratelimit-.*|anthropic-ratelimit-.*)$/i;

/** Setup for the log; the optional caps and clock exist so tests can use small numbers and a fixed time. */
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
  /** How the recorded request travels (the proxy-aware fetch in the app); Node's fetch when absent. */
  transport?: typeof fetch;
}

/** What the first line of a turn file says about the turn: who answered it and in which mode. */
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

/** One row of the log window's list of turns, read from the first and last lines of a file. */
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

/** One line of a turn file: `t` is milliseconds since the turn started, `type` names the event. */
export type TraceEvent = { t: number; type: string } & Record<string, unknown>;

/** The active setup, with defaults filled in; null until configureModelTrace runs (the log is then off). */
let config: (Required<Pick<TraceConfig, 'dir' | 'redact' | 'enabled'>> & {
  now: () => number;
  folderCapBytes: number;
  folderCapFiles: number;
  turnCapBytes: number;
  textCap: number;
  transport?: typeof fetch;
}) | null = null;

/** Sets up the log; called once by main/index.ts, and by tests with a temporary folder. */
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
    ...(options.transport ? { transport: options.transport } : {}),
  };
}

/** The folder turns are written to, or null before configuration. */
export function traceDir(): string | null {
  return config?.dir ?? null;
}

/** The file of a turn id, or null when the id is not one this log makes (so no path can be smuggled in). */
function fileOf(id: string): string | null {
  if (!config || !/^[0-9A-Za-z-]{8,64}$/.test(id)) return null;
  return path.join(config.dir, `${FILE_PREFIX}${id}${FILE_SUFFIX}`);
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** A turn id: the UTC start time, so names sort by time, plus a random tail so two turns in a second differ. */
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

/** The turn files in the folder, oldest first, with their sizes. */
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

/** The parts of an error worth keeping (name, message, HTTP status, server body, network code), all redacted. */
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

  /** Redacts a text and cuts it at the text cap, saying how long it was. */
  private clip(value: string): string {
    const cap = this.options.textCap;
    const redacted = this.options.redact(value);
    return redacted.length > cap ? `${redacted.slice(0, cap)}…[cut: ${redacted.length} characters in all]` : redacted;
  }

  /** A value for the file: strings clipped, objects redacted through their JSON text. */
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

  /** Appends one line. `body` marks a large event that is dropped once the turn passed its size cap. */
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
      // Owner only: a record holds the person's prompts and graph values.
      fs.appendFileSync(this.file, line, { mode: 0o600 });
      this.bytes += Buffer.byteLength(line);
    } catch {
      // A full disk or a removed folder must not break the conversation.
    }
  }

  /** What the model was given at the start of the turn: the system text, the dialog and the tools on offer. */
  prompt(input: { system: string; messages: Array<{ role: string; content: string }>; tools: Array<{ name: string; description?: string }> }): void {
    const latest = [...input.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    // The person's words, without the data block the app puts in front of them (agent/prompt.ts withTurnData).
    const close = latest.startsWith('<data from="app">') ? latest.lastIndexOf('</data>\n\n') : -1;
    const question = close >= 0 ? latest.slice(close + '</data>\n\n'.length) : latest;
    // A small line of its own, before the large prompt, so a list of turns can show it without reading bodies.
    this.write('question', { text: this.clip(question).slice(0, 300) });
    this.write('prompt', {
      systemChars: input.system.length,
      system: this.clip(input.system),
      messages: input.messages.map((message) => ({ role: message.role, content: this.clip(message.content) })),
      tools: input.tools.map((tool) => ({ name: tool.name, descriptionChars: tool.description?.length ?? 0 })),
    }, true);
  }

  /** Writes the reasoning and text gathered since the last flush as one line each. */
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
        // The app's tools report failure in their result object, not by throwing; a conflict counts as a failure too.
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

  /**
   * A small fact about the turn that is not a stream part: the context window the server loaded the model with,
   * how large the request was, a notice shown to the person. `data` must hold no free text from the person.
   */
  note(type: string, data: Record<string, unknown>): void {
    this.write(type, { step: this.step, ...data });
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
    // The AI SDK sends JSON text bodies; any other body kind is noted as absent rather than read.
    const body = typeof init?.body === 'string' ? init.body : null;
    // A request belongs to the step about to start: the start-step part arrives only after the request is sent.
    this.write('wire-request', { step: this.step + 1, method: init?.method ?? 'GET', url, bodyChars: body?.length ?? null, body: body === null ? null : this.clip(body) }, true);
    let response: Response;
    try {
      response = await (this.options.transport ?? fetch)(input, init);
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
    // 1.5 s at most: a body still streaming after that is not worth holding the end of the turn for.
    await Promise.race([Promise.allSettled(this.pending), new Promise((resolve) => setTimeout(resolve, 1500))]);
    const ms = this.options.now() - this.started;
    this.write('turn-end', {
      // A turn whose stream reported an error is not "ok", whatever the caller concluded.
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

/**
 * Whether lines about turns (which provider, how many steps, how a turn ended) may go to the app's own log
 * (logs/main.log). With "Keep the log" off nothing about turns is written anywhere. Before the log is set
 * up (unit tests, early start) the answer is yes.
 */
export function turnLinesAllowed(): boolean {
  if (!config) return true;
  try {
    return config.enabled();
  } catch {
    return false;
  }
}

/** console.log for a line about a turn: only while the conversation log is kept. */
export function turnLog(...args: unknown[]): void {
  if (turnLinesAllowed()) console.log(...args);
}

/** Starts recording a turn, or returns null when the log is off or not set up. Never throws. */
export function startTurnTrace(meta: TurnMeta): TurnTrace | null {
  if (!config) return null;
  try {
    if (!config.enabled()) return null;
    // Owner only, whatever the profile folder allows: records hold the person's prompts and graph values.
    fs.mkdirSync(config.dir, { recursive: true, mode: 0o700 });
    const trace = new TurnTrace(config, meta);
    // Pruned at every turn start, so the folder never grows past its caps by more than the turn being written.
    prune(trace.file);
    return trace;
  } catch {
    return null;
  }
}

/** The events of a piece of a turn file, one per line; partial or broken lines are skipped. */
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

/** The first `bytes` bytes of a file, so a list never reads whole bodies. */
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

/** The last `bytes` bytes of a file of `size` bytes; the first line may be cut, and parseLines skips it. */
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
export function exportTurnTraces(
  ids: string[],
  target: string,
  header: Record<string, unknown>,
  /** Applied to every line before it is written: the profile folder and the home folder are not the reader's business. */
  scrub: (text: string) => string = (text) => text,
): { bytes: number; turns: number } {
  // The saved file is the person's to send; until then only they can read it.
  const out = fs.openSync(target, 'w', 0o600);
  let bytes = 0;
  let turns = 0;
  try {
    const first = scrub(`${JSON.stringify({ type: 'bundle', exportedAt: new Date().toISOString(), turns: ids.length, ...header })}\n`);
    fs.writeSync(out, first);
    bytes += Buffer.byteLength(first);
    for (const id of ids) {
      const file = fileOf(id);
      if (!file) continue;
      try {
        const content = Buffer.from(scrub(fs.readFileSync(file, 'utf8')), 'utf8');
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

/** The interface languages the copied report can be written in. */
type ReportLanguage = 'ru' | 'en';

/** The words of the copied report, in the interface language (catalog modelLog.report). */
function reportWords(language: ReportLanguage) {
  const t = createTranslator(language);
  const words = Object.fromEntries(REPORT_KEYS.map((key) => [key, t(`modelLog.report.${key}`)])) as Record<(typeof REPORT_KEYS)[number], string>;
  return { ...words, more: (n: number) => t('modelLog.report.more', { count: n }) };
}

/** Every key under modelLog.report in the catalog that the report uses. */
const REPORT_KEYS = ['turn', 'model', 'mode', 'language', 'stepLimit', 'app', 'system', 'started', 'outcome', 'steps', 'toolCalls', 'tokensIn', 'out', 'time', 'ms', 'error', 'unfinished', 'given', 'systemText', 'chars', 'messages', 'tools', 'toolList', 'systemStart', 'dialog', 'stepsTitle', 'step', 'reasoning', 'modelText', 'call', 'result', 'failed', 'ok', 'toolError', 'stepEnd', 'tokensStep', 'firstToken', 'served', 'errorBold', 'network', 'request', 'counted', 'compact', 'budgetPaused', 'budgetTrimmed', 'noWindow', 'need', 'tokens', 'window', 'cut', 'tight', 'fits', 'truncated', 'abort', 'requests', 'answer', 'footer'] as const;

/** A value as text cut to `cap` characters, with a note of how many more there were. */
function cut(value: unknown, cap: number, w: ReturnType<typeof reportWords> = reportWords('ru')): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? '';
  return text.length > cap ? `${text.slice(0, cap)}… ${w.more(text.length - cap)}` : text;
}

/** A recorded value named in the interface language with the words the log window uses; unknown values stay as they are. */
function catalogWord(language: ReportLanguage, group: 'intent' | 'outcome', value: unknown): string {
  const raw = String(value ?? '');
  if (!raw) return '—';
  const key = group === 'intent'
    ? `modelLog.intent.${['ask', 'build', 'chat'].includes(raw) ? raw : 'other'}`
    : `modelLog.outcome.${raw}`;
  const text = createTranslator(language)(key);
  return text && text !== key ? text : raw;
}

/**
 * A short report of one turn for pasting into a chat: what was asked, what the model was given (sizes and the
 * start of the system text), each step with its text, tool calls and results cut to readable lengths, errors in
 * full, tokens and timings. The whole detail stays in the exported file. It is written in the interface language.
 */
export function turnReport(events: TraceEvent[], language: ReportLanguage = 'ru'): string {
  const w = reportWords(language === 'en' ? 'en' : 'ru');
  const c = (value: unknown, cap: number) => cut(value, cap, w);
  const start = events.find((event) => event.type === 'turn-start');
  const prompt = events.find((event) => event.type === 'prompt');
  const end = [...events].reverse().find((event) => event.type === 'turn-end');
  const lines: string[] = [];
  lines.push(`# ${w.turn} ${String(start?.id ?? '')}`);
  lines.push(`- ${w.model}: ${String(start?.provider ?? '')} / ${String(start?.model ?? '')}${start?.baseUrl ? ` (${String(start.baseUrl)})` : ''}`);
  lines.push(`- ${w.mode}: ${catalogWord(language, 'intent', start?.intent)}, ${w.language}: ${String(start?.language ?? '—')}, ${w.stepLimit}: ${String(start?.maxSteps ?? '—')}`);
  lines.push(`- ${w.app}: ${String(start?.app ?? '—')}, ${w.system}: ${String(start?.platform ?? '—')}, ${w.started}: ${String(start?.startedAt ?? '')}`);
  if (end) {
    lines.push(`- ${w.outcome}: ${catalogWord(language, 'outcome', end.outcome)}; ${w.steps}: ${String(end.steps)}; ${w.toolCalls}: ${String(end.toolCalls)}; ${w.tokensIn} ${String(end.inputTokens ?? '—')}, ${w.out} ${String(end.outputTokens ?? '—')}; ${w.time}: ${String(end.ms)} ${w.ms}`);
    if (end.error) lines.push(`- ${w.error}: ${String(end.error)}`);
  } else {
    lines.push(w.unfinished);
  }
  if (prompt) {
    const tools = Array.isArray(prompt.tools) ? (prompt.tools as Array<{ name?: string }>).map((tool) => tool.name).filter(Boolean) : [];
    const messages = Array.isArray(prompt.messages) ? prompt.messages as Array<{ role?: string; content?: string }> : [];
    lines.push('', `## ${w.given}`);
    lines.push(`- ${w.systemText}: ${String(prompt.systemChars ?? 0)} ${w.chars}; ${w.messages}: ${messages.length}; ${w.tools}: ${tools.length}`);
    lines.push(`- ${w.toolList}: ${tools.join(', ') || '—'}`);
    lines.push('', `### ${w.systemStart}`, '```', c(prompt.system, 3000), '```');
    lines.push('', `### ${w.dialog}`);
    // The last eight messages: the start of a long dialog says little about why this turn went wrong.
    for (const message of messages.slice(-8)) lines.push(`**${String(message.role)}:** ${c(message.content ?? '', 1500)}`, '');
  }
  lines.push(`## ${w.stepsTitle}`);
  for (const event of events) {
    if (event.type === 'step-start') lines.push('', `### ${w.step} ${String(event.step)}`);
    else if (event.type === 'reasoning') lines.push(`_${w.reasoning}:_ ${c(event.text, 800)}`);
    else if (event.type === 'text') lines.push(`**${w.modelText}:** ${c(event.text, 2000)}`);
    else if (event.type === 'tool-call') lines.push(`- ${w.call} \`${String(event.name)}\`: \`${c(event.input, 700)}\``);
    else if (event.type === 'tool-result') lines.push(`  - ${w.result} ${event.ok === false ? w.failed : w.ok}: \`${c(event.output, 700)}\``);
    else if (event.type === 'tool-error') lines.push(`  - ${w.toolError}: \`${c(event.error, 1500)}\``);
    else if (event.type === 'step-finish') {
      const usage = event.usage as { input?: unknown; output?: unknown } | null;
      lines.push(`- ${w.stepEnd}: ${String(event.finishReason ?? '—')}; ${w.tokensStep} ${String(usage?.input ?? '—')}, ${w.out} ${String(usage?.output ?? '—')}; ${String(event.ms ?? '—')} ${w.ms}, ${w.firstToken} ${String(event.firstTokenMs ?? '—')} ${w.ms}${event.servedModel ? `; ${w.served} ${String(event.servedModel)}` : ''}`);
    } else if (event.type === 'error') {
      lines.push(`- **${w.errorBold}**${event.status ? ` HTTP ${String(event.status)}` : ''}: ${c(event.message ?? '', 3000)}`);
      if (event.responseBody) lines.push('```', c(event.responseBody, 3000), '```');
    } else if (event.type === 'wire-error') lines.push(`- **${w.network}**: ${c(event.message ?? event.code ?? '', 1000)} (${String(event.url ?? '')})`);
    // A 'context' note (written by llmService.ts) tells whether the request fit the local model's context window.
    else if (event.type === 'context') {
      const size = event.requestChars === undefined ? '' : `${w.request} ${String(event.requestChars)} ${w.chars}, `;
      const counted = typeof event.counted === 'number' ? `; ${w.counted} ${String(event.counted)}` : '';
      const mode = event.compact ? `; ${w.compact}` : '';
      if (event.window === null) {
        lines.push(`- **${w.noWindow}**; ${size}${w.need} ${String(event.needed)} ${w.tokens}${counted}${mode}`);
      } else {
        const state = event.state === 'cut' ? w.cut : event.state === 'tight' ? w.tight : w.fits;
        lines.push(`- **${w.window}: ${String(event.window)} ${w.tokens}**; ${size}${w.need} ${String(event.needed)} ${w.tokens}${counted}: ${state}${mode}`);
      }
    } else if (event.type === 'context-budget') {
      lines.push(`- **${event.state === 'paused' ? w.budgetPaused : w.budgetTrimmed}**; ${w.window}: ${String(event.window ?? '—')} ${w.tokens}`);
    } else if (event.type === 'truncated') lines.push(`- _${w.truncated}: ${String(event.reason)}_`);
    else if (event.type === 'abort') lines.push(w.abort);
  }
  const wire = events.filter((event) => event.type === 'wire-response');
  if (wire.length > 0) {
    lines.push('', `## ${w.requests}`);
    for (const event of wire) lines.push(`- ${String(event.url)} → HTTP ${String(event.status)}, ${String(event.ms)} ${w.ms}, ${w.answer} ${String(event.bodyChars)} ${w.chars}`);
  }
  lines.push('', w.footer);
  return lines.join('\n');
}
