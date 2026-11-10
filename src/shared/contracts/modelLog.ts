/**
 * The model conversation log as the renderer sees it: summaries of recorded turns, never their bodies.
 * Main keeps the files (src/main/trace/modelTrace.ts) and writes exports through a system save dialog.
 */
export interface ModelLogTurn {
  id: string;
  startedAt: number;
  provider: string;
  model: string;
  /** Origin of the server the turn talked to. */
  baseUrl: string;
  intent: string;
  /** 'ok', 'paused', 'cancelled', 'error', or 'unfinished'. */
  outcome: string;
  steps: number;
  toolCalls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  error: string | null;
  bytes: number;
  /** First words of the person's message. */
  question: string;
}

export interface ModelLogList {
  /** Settings ▸ Privacy: the log is being kept. */
  enabled: boolean;
  turns: ModelLogTurn[];
  files: number;
  bytes: number;
  folder: string | null;
}

/** Which turns to save: explicit ids, the newest one, today's, or all that are kept. */
export type ModelLogExportRequest = { ids: string[] } | { scope: 'last' | 'today' | 'all' };

export type ModelLogExportResult =
  | { ok: true; path: string; bytes: number; turns: number }
  | { ok: false; canceled?: boolean; error?: string };
