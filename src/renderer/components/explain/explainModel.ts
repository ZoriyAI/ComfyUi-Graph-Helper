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

/** Explanations by aspect in ASPECTS order, newest first inside each aspect. Aspects with none are left out. */
export function groupByAspect(list: readonly Explanation[]): Array<{ aspect: ExplanationAspect; items: Explanation[] }> {
  return ASPECTS.flatMap((aspect) => {
    const items = list.filter((item) => item.aspect === aspect).sort((a, b) => b.createdAt - a.createdAt);
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
