import { AGENT_BUILD_TOOLS, AGENT_KNOWLEDGE_TOOLS, AGENT_PROPOSAL_TOOLS, AGENT_READ_TOOLS, type ObjectRef } from '../../../shared/contracts';
import { redactDiagnostic } from '../../../shared/i18n';
import type { ToolCall } from '../../types/chat';
import { INTERRUPTED_ERROR, isRecord } from '../../services/llm/chatModel';

/** Pure helpers that turn a tool call into what its card shows. */

const KNOWN = new Set<string>([...AGENT_READ_TOOLS, ...AGENT_KNOWLEDGE_TOOLS, ...AGENT_PROPOSAL_TOOLS, ...AGENT_BUILD_TOOLS]);

/** i18n key of the tool's label, or null for a name outside the agent lists. */
export function toolLabelKey(name: string): string | null {
  return KNOWN.has(name) ? `agent.tools.${name}` : null;
}

const VALUE_CAP = 80;

function shortValue(value: unknown): string {
  let text: string;
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean') text = String(value);
  else if (value === null || value === undefined) text = '—';
  else {
    try {
      text = JSON.stringify(value) ?? '';
    } catch {
      text = '…';
    }
  }
  text = redactDiagnostic(text.replace(/\s+/g, ' ').trim());
  return text.length > VALUE_CAP ? `${text.slice(0, VALUE_CAP - 1)}…` : text;
}

/** Arguments as short key/value pairs, without the long text fields a card shows on its own. */
export function compactArgs(args: Record<string, unknown>, omit: readonly string[] = []): Array<{ key: string; value: string }> {
  return Object.entries(args)
    .filter(([key, value]) => !omit.includes(key) && value !== undefined && value !== '')
    .map(([key, value]) => ({ key, value: shortValue(value) }));
}

/** The one-line outcome a tool reported (`message`), redacted; null when it said nothing readable. */
export function resultMessage(call: ToolCall): string | null {
  if (call.status === 'error') return call.error && call.error !== INTERRUPTED_ERROR ? redactDiagnostic(call.error) : null;
  if (!isRecord(call.result)) return null;
  const message = call.result.message;
  return typeof message === 'string' && message.trim() ? redactDiagnostic(message.trim()) : null;
}

function stringOf(record: unknown, key: string): string | undefined {
  if (!isRecord(record)) return undefined;
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** What a successful build tool changed, as an object the canvas can show. */
export function buildTargetRef(call: ToolCall): ObjectRef | null {
  if (call.kind !== 'build' || call.status !== 'success') return null;
  const result = call.result;
  if (call.toolName === 'connectNodes') {
    const edgeId = stringOf(result, 'edgeId') ?? stringOf(result, 'linkId');
    if (edgeId) return { kind: 'edge', id: edgeId };
  }
  if (call.toolName === 'createSubgraph' || call.toolName === 'insertSubgraph') {
    const nodeId = stringOf(result, 'nodeId');
    if (nodeId) return { kind: 'node', id: nodeId };
    const definitionId = stringOf(result, 'definitionId') ?? stringOf(result, 'subgraphId') ?? stringOf(call.args, 'definitionId');
    if (definitionId) return { kind: 'subgraph', id: definitionId };
  }
  if (call.toolName === 'removeNode' || call.toolName === 'setProcess') {
    return call.toolName === 'setProcess' ? { kind: 'process', id: 'process' } : null;
  }
  if (call.toolName === 'setComponentDocumentation') {
    const ownerId = stringOf(call.args, 'ownerId');
    const ownerKind = stringOf(call.args, 'ownerKind');
    if (ownerId) return { kind: ownerKind === 'subgraph' ? 'subgraph' : 'node', id: ownerId };
  }
  const nodeId = stringOf(result, 'nodeId') ?? stringOf(call.args, 'nodeId');
  return nodeId ? { kind: 'node', id: nodeId } : null;
}
