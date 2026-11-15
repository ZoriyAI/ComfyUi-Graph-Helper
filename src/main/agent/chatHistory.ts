/**
 * The chat's stored messages: save one, load a project's messages page by page, clear them. The renderer's chat
 * (services/llm/chatService.ts) and Settings ▸ Privacy reach it through ipc/agentIpc.ts; agent/interrupted.ts
 * writes its own line through saveChatMessage. Every write is checked for the held key and token and redacted,
 * because the database is a plain file in the profile folder.
 */
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { redactSecrets } from '../../shared/agent/redact';
import { mainLLMService } from '../llmService';
import type { ChatRecord, ChatSaveResult } from '../../shared/contracts';

/**
 * Protective (one SQLite row): a message longer than this is stored with a visible "[… N characters not stored]"
 * tail instead of being cut silently. A million characters is far past any typed message or model answer.
 */
export const CHAT_CONTENT_CAP = 1_000_000;
/** Protective (one SQLite row): tool calls larger than this are refused with an error the chat logs. */
const TOOL_CALLS_CAP = 5_000_000;

/** The shape a message must have to be stored; the renderer's input is not trusted. */
const chatRecordSchema = z.object({
  id: z.string().min(1).max(200),
  projectId: z.string().min(1).max(200),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.number().int().nonnegative(),
  graphRevisionId: z.string().max(200).nullable(),
  toolCalls: z.array(z.unknown()).nullable(),
});

export type { ChatSaveResult } from '../../shared/contracts';

/** True when the exact held LLM key or MCP token is in the text. */
export type HeldSecretCheck = (text: string) => boolean;

/**
 * Stores one chat message. Content over a million characters is stored with a marker saying how much was left out.
 * Secret-shaped substrings (an sk- key, an api key assignment, a bearer token) are replaced with [redacted] before
 * the write, so the rest of the message is kept. A message that contains the exact held LLM key or MCP token is
 * refused outright.
 */
export function saveChatMessage(
  db: Database.Database,
  input: unknown,
  heldSecret: HeldSecretCheck = (text) => mainLLMService.containsHeldSecret(text),
): ChatSaveResult {
  const parsed = chatRecordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Chat message does not match the schema.' };
  const record = parsed.data;
  if (heldSecret(record.content)) return { ok: false, error: 'Chat message contains the held key or token and was not stored.' };
  const content = redactSecrets(record.content.length > CHAT_CONTENT_CAP
    ? `${record.content.slice(0, CHAT_CONTENT_CAP)}\n[… ${record.content.length - CHAT_CONTENT_CAP} characters not stored]`
    : record.content);
  let toolCalls: string | null = null;
  if (record.toolCalls) {
    try {
      toolCalls = JSON.stringify(record.toolCalls);
    } catch {
      return { ok: false, error: 'Tool calls could not be serialized.' };
    }
    if (toolCalls.length > TOOL_CALLS_CAP) return { ok: false, error: 'Tool calls are too large to store.' };
    if (heldSecret(toolCalls)) return { ok: false, error: 'Tool calls contain the held key or token and were not stored.' };
    toolCalls = redactSecrets(toolCalls);
    // Redaction works on the text, so it could in theory break the JSON; such a record is refused, not stored broken.
    try {
      JSON.parse(toolCalls);
    } catch {
      return { ok: false, error: 'Tool calls could not be stored after redaction.' };
    }
  }
  try {
    db.prepare(`
      INSERT OR REPLACE INTO chat_messages (id, project_id, role, content, timestamp, graph_revision_id, tool_calls)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.projectId,
      record.role,
      content,
      record.timestamp,
      record.graphRevisionId,
      toolCalls,
    );
  } catch {
    return { ok: false, error: 'Chat message could not be stored.' };
  }
  return { ok: true };
}

/** The stored tool calls as an array, or null when there are none or the text does not parse. */
function parseToolCalls(value: unknown): unknown[] | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Which page of the chat to load; without it every message is returned. */
export interface ChatPageRequest {
  /** Most messages to return; the newest of them. */
  limit?: number;
  /** Only messages older than this one (the oldest message the chat already shows). */
  beforeId?: string;
}

/**
 * Stored messages of a project, oldest first. With a page request: the newest `limit` messages before `beforeId`
 * (nothing is ever deleted; a long chat loads in pages instead of all at once).
 */
export function loadChatHistory(db: Database.Database, projectId: unknown, page?: unknown): ChatRecord[] {
  if (typeof projectId !== 'string' || projectId === '') return [];
  const request = page && typeof page === 'object' ? page as ChatPageRequest : null;
  const limit = request && typeof request.limit === 'number' && Number.isFinite(request.limit) ? Math.max(1, Math.min(2000, Math.floor(request.limit))) : null;
  const before = request && typeof request.beforeId === 'string' && request.beforeId.length <= 200 ? request.beforeId : null;
  const anchor = before
    ? db.prepare('SELECT timestamp, rowid AS seq FROM chat_messages WHERE project_id = ? AND id = ?').get(projectId, before) as { timestamp: number; seq: number } | undefined
    : undefined;
  // An unknown anchor (a message cleared meanwhile) gives an empty page rather than the whole chat again.
  if (before && !anchor) return [];
  // No page asked: every message in order. A page: the newest `limit` before the anchor, read newest first, then
  // turned back to oldest first. rowid breaks ties between messages with the same timestamp.
  const rows = (limit === null && !anchor
    ? db.prepare(`
    SELECT * FROM (
      SELECT id, project_id, role, content, timestamp, graph_revision_id, tool_calls, rowid AS seq
      FROM chat_messages WHERE project_id = ?
    ) ORDER BY timestamp ASC, seq ASC
  `).all(projectId)
    : db.prepare(`
    SELECT id, project_id, role, content, timestamp, graph_revision_id, tool_calls, rowid AS seq
    FROM chat_messages
    WHERE project_id = ? AND (? IS NULL OR timestamp < ? OR (timestamp = ? AND rowid < ?))
    ORDER BY timestamp DESC, seq DESC LIMIT ?
  `).all(projectId, anchor ? 1 : null, anchor?.timestamp ?? 0, anchor?.timestamp ?? 0, anchor?.seq ?? 0, limit ?? 2000).reverse()) as Array<Record<string, unknown>>;
  return rows.flatMap((row) => {
    const role = row.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') return [];
    return [{
      id: String(row.id),
      projectId: String(row.project_id),
      role,
      content: String(row.content ?? ''),
      timestamp: Number(row.timestamp),
      graphRevisionId: typeof row.graph_revision_id === 'string' ? row.graph_revision_id : null,
      toolCalls: parseToolCalls(row.tool_calls),
    }];
  });
}

/** Preferences ▸ Privacy ▸ Clear chat history: removes every stored message of one project. */
export function clearChatHistory(db: Database.Database, projectId: unknown): { ok: true; removed: number } | { ok: false; error: string } {
  if (typeof projectId !== 'string' || projectId === '' || projectId.length > 200) return { ok: false, error: 'Chat history could not be cleared.' };
  try {
    const result = db.prepare('DELETE FROM chat_messages WHERE project_id = ?').run(projectId);
    return { ok: true, removed: result.changes };
  } catch {
    return { ok: false, error: 'Chat history could not be cleared.' };
  }
}
