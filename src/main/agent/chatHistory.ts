import type Database from 'better-sqlite3';
import { z } from 'zod';
import { redactSecrets } from '../../shared/agent/redact';
import { mainLLMService } from '../llmService';
import type { ChatRecord, ChatSaveResult } from '../../shared/contracts';

export const CHAT_CONTENT_CAP = 50_000;
const TOOL_CALLS_CAP = 200_000;
const HISTORY_LIMIT = 500;

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
 * Stores one chat message. Content over 50k characters is cut. Secret-shaped substrings (an sk- key, an api
 * key assignment, a bearer token) are replaced with [redacted] before the write, so the rest of the message is
 * kept. A message that contains the exact held LLM key or MCP token is refused outright.
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
  const content = redactSecrets(record.content.slice(0, CHAT_CONTENT_CAP));
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

function parseToolCalls(value: unknown): unknown[] | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The latest 500 messages of a project, oldest first. */
export function loadChatHistory(db: Database.Database, projectId: unknown): ChatRecord[] {
  if (typeof projectId !== 'string' || projectId === '') return [];
  const rows = db.prepare(`
    SELECT * FROM (
      SELECT id, project_id, role, content, timestamp, graph_revision_id, tool_calls, rowid AS seq
      FROM chat_messages WHERE project_id = ? ORDER BY timestamp DESC, seq DESC LIMIT ?
    ) ORDER BY timestamp ASC, seq ASC
  `).all(projectId, HISTORY_LIMIT) as Array<Record<string, unknown>>;
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
