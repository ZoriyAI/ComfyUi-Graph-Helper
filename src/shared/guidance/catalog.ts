/** Fifty source-linked practical guides. Original explanations; no model/network is required to read them. */
import data from './problems.json';
export type GuideAction = 'check' | 'nodes' | 'models' | 'services' | 'templates' | 'sync' | 'resources' | 'canvas' | 'constructor' | 'import' | 'comfy' | 'error' | 'export' | 'memory' | 'connection';
export type GuideCategory = 'setup' | 'models' | 'performance' | 'graph' | 'create' | 'subgraphs' | 'touch';
export interface GuideProblem {
  id: string; category: GuideCategory; action: GuideAction; keywords: string; source: string;
  title: { ru: string; en: string }; why: { ru: string; en: string }; check: { ru: string; en: string }; expected: { ru: string; en: string };
  prepare: { ru: string; en: string }; followUp: GuideAction; targets: string[];
  template?: { family: 'image' | 'local-ai'; query: string };
  verify: { kind: 'graph'; fields: string[] } | { kind: 'sync' } | { kind: 'observed' };
}
export const GUIDE_PROBLEMS = data as GuideProblem[];
export const GUIDE_CATEGORIES: GuideCategory[] = ['create', 'setup', 'models', 'graph', 'performance', 'subgraphs', 'touch'];
/** The renderer supplies a closed guide id, never an arbitrary URL for Electron to open. */
export function guideSource(id: unknown): string | null {
  return typeof id === 'string' ? GUIDE_PROBLEMS.find((item) => item.id === id)?.source ?? null : null;
}
export function searchGuides(query: string, category: GuideCategory | '' = ''): GuideProblem[] {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return GUIDE_PROBLEMS.filter(item => (!category || category === item.category) && words.every(word =>
    `${item.title.ru} ${item.title.en} ${item.why.ru} ${item.why.en} ${item.keywords}`.toLocaleLowerCase().includes(word)));
}
