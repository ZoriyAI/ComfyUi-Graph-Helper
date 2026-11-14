import * as fs from 'fs';
import * as path from 'path';
import { format } from 'util';
import { redactSecrets } from '../shared/config/draft';

/**
 * The main-process log: `<userData>/logs/main.log`, appended line by line, rotated at 5 MB into main.log.1 and
 * main.log.2 (three files in all). Every line passes through redactSecrets and any extra redactor (the held
 * provider key and MCP token), so a key that reaches a log call is never written. Pure Node: no Electron import,
 * so the IPC guard and tests can use it.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export const LOG_FILE = 'main.log';
export const LOG_MAX_BYTES = 5 * 1024 * 1024;
/** main.log plus this many rotated files. */
export const LOG_ROTATED_FILES = 2;
/** One line never exceeds this; a runaway message is clipped. */
const LINE_CAP = 8000;

interface LogState {
  dir: string;
  file: string;
  size: number;
  maxBytes: number;
  rotated: number;
  mirror: boolean;
}

type ConsoleMethod = (...args: unknown[]) => void;

let state: LogState | null = null;
const extraRedactors: Array<(text: string) => string> = [];
/** The console methods as they were before routeConsole, so mirroring and fallback never recurse. */
const original: Record<LogLevel, ConsoleMethod> = {
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
/** Lines logged before initLog (or when the file cannot be written), kept for the diagnostics tail. */
const memory: string[] = [];
const MEMORY_LINES = 400;

export interface LogOptions {
  dir: string;
  /** Also print to stdout/stderr (development and unpackaged runs). */
  mirror?: boolean;
  maxBytes?: number;
  rotated?: number;
}

/** Opens (creates) the log folder. Safe to call again with another folder (tests). */
export function initLog(options: LogOptions): void {
  const file = path.join(options.dir, LOG_FILE);
  let size = 0;
  try {
    fs.mkdirSync(options.dir, { recursive: true, mode: 0o700 });
    size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  } catch {
    size = 0;
  }
  state = {
    dir: options.dir,
    file,
    size,
    maxBytes: options.maxBytes ?? LOG_MAX_BYTES,
    rotated: options.rotated ?? LOG_ROTATED_FILES,
    mirror: options.mirror ?? true,
  };
}

/** Closes the logger (tests); later lines go to memory and the console only. */
export function resetLog(): void {
  state = null;
  memory.length = 0;
  extraRedactors.length = 0;
}

export function logsDir(): string | null {
  return state?.dir ?? null;
}

/** Adds a redactor applied after redactSecrets (e.g. exact match on the held key). */
export function addLogRedactor(redactor: (text: string) => string): void {
  extraRedactors.push(redactor);
}

/** The redaction every log line and diagnostics report gets. */
export function redactForLog(text: string): string {
  let result = redactSecrets(text);
  for (const redactor of extraRedactors) {
    try {
      result = redactor(result);
    } catch {
      // A broken redactor must not stop logging; the heuristic pass already ran.
    }
  }
  return result;
}

function formatArgs(args: unknown[]): string {
  const parts = args.map((value) => (value instanceof Error ? (value.stack || `${value.name}: ${value.message}`) : value));
  try {
    return format(...(parts as [unknown, ...unknown[]]));
  } catch {
    return parts.map((part) => String(part)).join(' ');
  }
}

function rotate(current: LogState): void {
  const name = (index: number) => (index === 0 ? current.file : `${current.file}.${index}`);
  try {
    if (current.rotated <= 0) {
      fs.rmSync(current.file, { force: true });
    } else {
      fs.rmSync(name(current.rotated), { force: true });
      for (let index = current.rotated - 1; index >= 0; index -= 1) {
        if (fs.existsSync(name(index))) fs.renameSync(name(index), name(index + 1));
      }
    }
  } catch {
    // Rotation failed (read-only folder, file in use): keep appending to the same file.
  }
  current.size = 0;
}

function remember(line: string): void {
  memory.push(line);
  if (memory.length > MEMORY_LINES) memory.splice(0, memory.length - MEMORY_LINES);
}

/** Writes one redacted line. Never throws. */
export function writeLog(level: LogLevel, ...args: unknown[]): void {
  let text: string;
  try {
    text = redactForLog(formatArgs(args));
  } catch {
    text = '[log line could not be formatted]';
  }
  if (text.length > LINE_CAP) text = `${text.slice(0, LINE_CAP)}…`;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${text}\n`;
  remember(line.trimEnd());
  const current = state;
  if (current?.mirror !== false) {
    try {
      original[level](text);
    } catch {
      // stdout closed (EPIPE): the file still gets the line.
    }
  }
  if (!current) return;
  const bytes = Buffer.byteLength(line);
  try {
    if (current.size > 0 && current.size + bytes > current.maxBytes) rotate(current);
    fs.appendFileSync(current.file, line, { mode: 0o600 });
    current.size += bytes;
  } catch {
    // Disk full or folder gone: the line stays in memory for the diagnostics tail.
  }
}

export const log = {
  info: (...args: unknown[]) => writeLog('info', ...args),
  warn: (...args: unknown[]) => writeLog('warn', ...args),
  error: (...args: unknown[]) => writeLog('error', ...args),
};

let routed = false;

/** console.log/info/warn/error in main go through the log (and still reach stdout when mirroring). */
export function routeConsole(): void {
  if (routed) return;
  routed = true;
  console.log = (...args: unknown[]) => writeLog('info', ...args);
  console.info = (...args: unknown[]) => writeLog('info', ...args);
  console.warn = (...args: unknown[]) => writeLog('warn', ...args);
  console.error = (...args: unknown[]) => writeLog('error', ...args);
}

/** The last `count` lines of main.log (falling back to lines held in memory). Already redacted when written. */
export function readLogTail(count = 200): string[] {
  const current = state;
  if (current) {
    try {
      const lines: string[] = [];
      // The current file first, then older ones while the tail is still short (just rotated).
      const files = [current.file, ...Array.from({ length: current.rotated }, (_, index) => `${current.file}.${index + 1}`)];
      for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const text = readTail(file, 512 * 1024);
        const found = text.split('\n').filter((line) => line !== '');
        lines.unshift(...found);
        if (lines.length >= count) break;
      }
      return lines.slice(-count).map((line) => redactForLog(line));
    } catch {
      // Fall through to memory.
    }
  }
  return memory.slice(-count);
}

function readTail(file: string, maxBytes: number): string {
  const size = fs.statSync(file).size;
  const start = Math.max(0, size - maxBytes);
  const handle = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(size - start);
    fs.readSync(handle, buffer, 0, buffer.length, start);
    const text = buffer.toString('utf8');
    // Drop a partial first line when the read started mid-file.
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    fs.closeSync(handle);
  }
}
