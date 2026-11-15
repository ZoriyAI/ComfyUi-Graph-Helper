import { lessonGaps, type ClassPorts, type Lesson, type LessonGap } from './engine';
import { LESSON_AFTER, lessonById } from './lessons';
import { VIDEO_PACK_OF } from './sets/video';
import { imageTechniquePack } from './sets/image-techniques';

/**
 * Whether a lesson can be done in this ComfyUI, and how to say why not: its own missing nodes and ports, or the
 * lesson it continues not fitting (a lesson standing on a graph nobody can build here is a dead end too).
 */
export interface LessonFit {
  gaps: LessonGap[];
  /** The lesson this one continues, when that one does not fit (and no other one it may continue does). */
  blockedBy: string | null;
}

export function lessonFit(lesson: Lesson, ports: ClassPorts, seen: ReadonlySet<string> = new Set()): LessonFit {
  const gaps = lessonGaps(lesson, ports);
  const before = LESSON_AFTER[lesson.id] ?? [];
  if (before.length === 0 || seen.has(lesson.id)) return { gaps, blockedBy: null };
  const trail = new Set([...seen, lesson.id]);
  const unfit = before.filter((id) => {
    const base = lessonById(id);
    if (!base) return false;
    const fit = lessonFit(base, ports, trail);
    return fit.gaps.length > 0 || fit.blockedBy !== null;
  });
  return { gaps, blockedBy: unfit.length === before.length ? before[0] : null };
}

export function fits(fit: LessonFit): boolean {
  return fit.gaps.length === 0 && fit.blockedBy === null;
}

/**
 * The node pack a class of the lessons comes from, when it is not ComfyUI itself. Only the classes the lessons
 * use are listed: a class that is missing is not in the catalog, so its pack cannot be read from there.
 */
export function packOf(classType: string): string | null {
  if (/^(?:WanVideo|LoadWanVideo|MultiTalk|Wav2VecModelLoader|DownloadAndLoadWav2Vec|FantasyTalking|Ovi)/.test(classType)) return 'ComfyUI-WanVideoWrapper';
  if (/^(?:OnnxDetectionModelLoader|PoseAndFaceDetection|DrawViTPose)/.test(classType)) return 'ComfyUI-WanAnimatePreprocess';
  if (/^(?:UnetLoaderGGUF|(?:Dual|Triple|Quadruple)?CLIPLoaderGGUF)/.test(classType)) return 'ComfyUI-GGUF';
  for (const [pattern, pack] of VIDEO_PACK_OF) if (pattern.test(classType)) return pack;
  return imageTechniquePack(classType);
}

export interface GapGroup {
  /** The pack that brings these nodes; null for ComfyUI itself. */
  pack: string | null;
  /** Names to show (display names when known), each once. */
  names: string[];
  /** How many more names there are beyond `names`. */
  more: number;
}

/**
 * The "does not fit" list without repeats: missing nodes grouped by the pack that brings them (ComfyUI itself
 * last), at most `cap` names per group with how many more, and the ports a class lacks, each once.
 */
export function groupGaps(gaps: readonly LessonGap[], displayName: (classType: string) => string, cap = 4): { groups: GapGroup[]; ports: Array<Extract<LessonGap, { kind: 'port' }>> } {
  const byPack = new Map<string, string[]>();
  const ports: Array<Extract<LessonGap, { kind: 'port' }>> = [];
  const seenPorts = new Set<string>();
  for (const gap of gaps) {
    if (gap.kind === 'port') {
      const key = `${gap.classType}|${gap.side}|${gap.port}`;
      if (!seenPorts.has(key)) { seenPorts.add(key); ports.push(gap); }
      continue;
    }
    const classType = gap.classes[0];
    const pack = packOf(classType) ?? '';
    const name = displayName(classType) || classType;
    const list = byPack.get(pack) ?? [];
    if (!list.includes(name)) list.push(name);
    byPack.set(pack, list);
  }
  const groups = [...byPack.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([pack, names]) => ({ pack: pack || null, names: names.slice(0, cap), more: Math.max(0, names.length - cap) }));
  return { groups, ports };
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

/**
 * The sentences under "This lesson does not fit": why, grouped and without repeats, and one closing sentence that
 * the person installs nodes in ComfyUI themselves (the app never installs anything). `title` names a lesson.
 */
export function fitLines(fit: LessonFit, translate: Translate, displayName: (classType: string) => string, title: (lessonId: string) => string): string[] {
  const lines: string[] = [];
  if (fit.blockedBy) lines.push(translate('lessons.unfitAfter', { title: title(fit.blockedBy) }));
  const { groups, ports } = groupGaps(fit.gaps, displayName);
  for (const group of groups) {
    const names = group.names.join(', ') + (group.more > 0 ? ` ${translate('lessons.missingMore', { count: group.more })}` : '');
    lines.push(group.pack ? translate('lessons.missingPack', { pack: group.pack, names }) : translate('lessons.missingCore', { names }));
  }
  for (const gap of ports) {
    const name = displayName(gap.classType) || gap.classType;
    lines.push(translate(gap.side === 'input' ? 'lessons.missingInput' : 'lessons.missingOutput', { name, port: gap.port }));
  }
  if (groups.length > 0 || ports.length > 0) lines.push(translate('lessons.installYourself'));
  return lines;
}
