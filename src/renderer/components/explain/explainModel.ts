import type { Explanation, ExplanationAspect, ObjectRef } from '../../../shared/contracts';

/** Pure helpers for the Explain panel. */

export const ASPECTS: readonly ExplanationAspect[] = ['what', 'why', 'connect', 'next', 'risk'];

/** Knowledge about a class or a model file is shared across projects and not tied to a revision. */
export function isGlobalOwner(ref: ObjectRef): boolean {
  return ref.kind === 'nodeClass' || ref.kind === 'model' || ref.kind === 'linkType' || ref.kind === 'family';
}

/**
 * True when the explanation was written against another graph revision than the current one.
 * Global knowledge (revisionId null) never goes stale; an unknown current revision proves nothing.
 */
export function isStale(explanation: Pick<Explanation, 'revisionId'>, currentRevisionId: string | null | undefined): boolean {
  if (!explanation.revisionId || !currentRevisionId) return false;
  return explanation.revisionId !== currentRevisionId;
}

/**
 * How far an explanation can be trusted, lowest first: the app's built-in knowledge, then the person's own notes,
 * then what the app read itself, then the internet, and the assistant's words last (P0 of the assistant review).
 */
export function trustRank(item: Pick<Explanation, 'createdBy' | 'provenance'>): number {
  if (item.createdBy === 'seed') return 0;
  if (item.createdBy === 'user') return 1;
  if (item.createdBy === 'ai') return 4;
  if (item.provenance === 'fact') return 2;
  return 3;
}

/** Where an explanation holds: this graph, this project, or every project (built-in and the person's notes). */
export function explanationScope(item: Pick<Explanation, 'projectId' | 'revisionId'>): 'graph' | 'project' | 'global' {
  if (item.revisionId) return 'graph';
  return item.projectId ? 'project' : 'global';
}

/** Explanations by aspect in ASPECTS order: the most trusted first, newest first among equals. */
export function groupByAspect(list: readonly Explanation[]): Array<{ aspect: ExplanationAspect; items: Explanation[] }> {
  return ASPECTS.flatMap((aspect) => {
    const items = list.filter((item) => item.aspect === aspect).sort((a, b) => trustRank(a) - trustRank(b) || b.createdAt - a.createdAt);
    return items.length > 0 ? [{ aspect, items }] : [];
  });
}

export function missingAspects(list: readonly Explanation[]): ExplanationAspect[] {
  const present = new Set(list.map((item) => item.aspect));
  return ASPECTS.filter((aspect) => !present.has(aspect));
}

/** The newest `limit` explanations, newest first. Built-in seeds are reference, not history, and stay out. */
export function recentExplanations(list: readonly Explanation[], limit = 20): Explanation[] {
  return list.filter((item) => item.createdBy !== 'seed').sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/**
 * The source link shown under an explanation: web findings always carry theirs; a built-in seed shows the official
 * docs page its fact comes from. Other records do not show links (the agent could write any URL beside a "fact").
 */
export function shownSourceUrl(item: Pick<Explanation, 'provenance' | 'createdBy' | 'sourceUrl'>): string | null {
  if (item.provenance === 'web' || (item.createdBy === 'seed' && item.provenance === 'fact')) return safeSourceUrl(item.sourceUrl);
  return null;
}

/** Only http(s) links are shown as sources; anything else is not a link. */
export function safeSourceUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
