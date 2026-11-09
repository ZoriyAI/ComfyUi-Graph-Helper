import type { AgentBuildStep } from '../../../../shared/contracts/agent';
import type { MotionLevel } from './motion';

/**
 * Pure logic of the live build on the canvas: what one revealed step is, how long to wait before the next,
 * where its explanation comes from, and the step counter. BuildLayer holds the timers; this file holds the rules.
 */

/** One thing that appears on the canvas: a node, an edge (after both its ends), or a changed field. */
export interface BuildItem {
  /** Node id, edge id, or `param:<nodeId>:<key>`; the key build-step chunks are filed under. */
  key: string;
  kind: 'node' | 'edge' | 'param';
  /** The node the callout points at: the node itself, an edge's target, the changed node. */
  anchor: string;
  /** For a field change: the old and new value as short text. */
  change?: { key: string; from: string; to: string };
}

/** What a build-step chunk tells the canvas about one item. */
export interface BuildStepInfo {
  toolName: string;
  why: string;
}

/** The extra pause after the reveal animation so a person can read one sentence. */
export const READ_PAUSE_MS = 500;
/** The default full-motion step: the 320 ms reveal plus the reading pause (Preferences ▸ Canvas default). */
const DEFAULT_PACE_MS = 820;
/** How long a callout stays when no next step replaces it. */
export const CALLOUT_HOLD_MS = 4000;
/** With "follow the helper" on, the camera travels too: give each step this much more time. */
const FOLLOW_FACTOR = 1.6;
/** A long backlog speeds up a little so the canvas catches up with the agent. */
const BACKLOG = 10;
const BACKLOG_FACTOR = 0.6;

/**
 * Wait before the next item appears: the reveal animation plus a reading pause, slower when the camera
 * follows, faster with a long backlog. No wait at all when motion is off (everything is shown at once).
 */
export function stepDelayMs(input: { revealMs: number; motion: MotionLevel; follow: boolean; queued: number; paceMs?: number }): number {
  if (input.motion === 'off') return 0;
  // Preferences ▸ Canvas ▸ Build pace is the full-motion step; reduced motion keeps the reading share of it.
  const pace = typeof input.paceMs === 'number' && Number.isFinite(input.paceMs) && input.paceMs > 0 ? input.paceMs : null;
  let delay = input.motion === 'full'
    ? (pace ?? Math.max(0, input.revealMs) + READ_PAUSE_MS)
    : (pace === null ? READ_PAUSE_MS : Math.round(pace * (READ_PAUSE_MS / DEFAULT_PACE_MS)));
  if (input.follow) delay *= FOLLOW_FACTOR;
  if (input.queued > BACKLOG) delay *= BACKLOG_FACTOR;
  return Math.round(delay);
}

/** The key a build-step chunk is filed under, matching the BuildItem the projection diff produced. */
export function stepKey(step: Pick<AgentBuildStep, 'toolName' | 'nodeId' | 'edgeId' | 'key'>): string | null {
  switch (step.toolName) {
    case 'connectNodes': return step.edgeId ?? null;
    case 'setParameter': return step.nodeId && step.key ? paramKey(step.nodeId, step.key) : null;
    case 'removeNode': return step.nodeId ? `remove:${step.nodeId}` : null;
    default: return step.nodeId ?? null;
  }
}

export function paramKey(nodeId: string, key: string): string {
  return `param:${nodeId}:${key}`;
}

const VALUE_CAP = 40;

/** A field value as pill text. */
export function shortValue(value: unknown): string {
  let text: string;
  if (value === undefined || value === null) text = '—';
  else if (typeof value === 'string') text = value === '' ? '""' : value;
  else if (typeof value === 'number' || typeof value === 'boolean') text = String(value);
  else {
    try {
      text = JSON.stringify(value) ?? '—';
    } catch {
      text = '—';
    }
  }
  text = text.replace(/\s+/g, ' ');
  return text.length > VALUE_CAP ? `${text.slice(0, VALUE_CAP)}…` : text;
}

type ParamNode = { id: string; data?: { parameters?: Record<string, unknown> } };

/** Fields that changed on nodes present in both graphs. */
export function parameterChanges(previous: ParamNode[], next: ParamNode[]): BuildItem[] {
  const before = new Map(previous.map((node) => [node.id, node.data?.parameters ?? {}]));
  const items: BuildItem[] = [];
  for (const node of next) {
    const old = before.get(node.id);
    if (!old) continue;
    const now = node.data?.parameters ?? {};
    for (const key of Object.keys(now)) {
      if (JSON.stringify(old[key]) === JSON.stringify(now[key])) continue;
      items.push({ key: paramKey(node.id, key), kind: 'param', anchor: node.id, change: { key, from: shortValue(old[key]), to: shortValue(now[key]) } });
    }
  }
  return items;
}

/** "3/7": the step on screen and every step known so far (shown plus still queued). */
export function stepCounter(shown: number, queued: number): { index: number; total: number } {
  const index = Math.max(1, shown);
  return { index, total: Math.max(index, shown + queued) };
}

/**
 * The sentence a callout shows, best first: the agent's `why` for this step, the component purpose,
 * the first annotation, the catalog description, then the given fallback.
 */
export function calloutText(sources: { why?: string | null; purpose?: string | null; annotation?: string | null; catalog?: string | null; fallback: string }): string {
  for (const candidate of [sources.why, sources.purpose, sources.annotation, sources.catalog]) {
    const text = typeof candidate === 'string' ? candidate.trim() : '';
    if (text) return text;
  }
  return sources.fallback;
}
