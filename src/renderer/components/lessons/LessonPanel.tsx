import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, CircleDot, Crosshair, FolderOutput, GraduationCap, MessageCircleQuestion, Plug, RotateCcw, Wand2 } from 'lucide-react';
import type { TFunction } from 'i18next';
import { lessonGaps, lessonProgress, type ClassPorts, type Lesson, type LessonFacts, type LessonGap, type LessonGraph, type Missing } from '../../../shared/lessons/engine';
import { LESSONS, LESSON_AFTER, lessonById } from '../../../shared/lessons/lessons';
import { lessonWords, withNodeNames } from '../../../shared/lessons/texts';
import { weightsOf } from '../../../shared/prompt/inspect';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';
import { runCommand } from '../../commands/registry';
import { useGraphStore } from '../../state/graphState';
import { useLessonStore } from '../../state/lessonState';
import { useUiStore } from '../../state/uiState';
import Button from '../../ui/Button';
import MarkdownLite from '../chat/MarkdownLite';
import { canDo, clearShown, doFix, nodeNameOf, portLabel, showMissing, titleOnCanvas, useLessonCatalog, useLessonFacts, useLessonGraph } from './lessonModel';
import styles from './LessonPanel.module.css';

/**
 * The helper's "Learn" mode. The person builds a graph by hand; the panel says what the step is and why, shows
 * where it is on the canvas, and reads off the graph when the step is done. Nothing is asked of a model: the
 * lessons are the app's own.
 *
 * Without an open lesson: the list, each lesson with whether it fits this ComfyUI. With one: the step, what it
 * still lacks in plain words, "show me where", "do this for me" where the app can, and the steps as a list.
 */

type Details = Record<string, NodeClassDetail | null>;

interface Shared {
  details: Details;
  ports: ClassPorts;
  catalogRead: boolean;
  graph: LessonGraph;
  facts: LessonFacts;
}

const NONE: readonly string[] = [];

function shown(t: TFunction, value: unknown): string {
  if (value === undefined || value === null || value === '') return String(t('lessons.empty'));
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value);
}

/** What a step lacks, as a sentence a person can act on. */
function lackText(t: TFunction, missing: Missing, lesson: Lesson, shared: Shared): string {
  const { details, graph, facts } = shared;
  if (missing.kind === 'node') {
    const name = nodeNameOf(lesson, missing.role, details) ?? missing.classes[0];
    const some = graph.nodes.some((node) => missing.classes.includes(node.classType));
    return String(some ? t('lessons.lackNodeMore', { name }) : t('lessons.lackNode', { name }));
  }
  if (missing.kind === 'link') {
    const from = titleOnCanvas(missing.from.nodeId, details);
    const to = titleOnCanvas(missing.to.nodeId, details);
    if (missing.absent === 'input') return String(t('lessons.lackPort', { node: to, port: missing.input }));
    if (missing.absent === 'output') return String(t('lessons.lackPort', { node: from, port: missing.output }));
    const output = portLabel(graph, missing.from.nodeId, 'output', missing.output);
    return missing.fedBy && missing.fedBy !== missing.from.nodeId
      ? String(t('lessons.lackLinkWrong', { input: missing.input, to, other: titleOnCanvas(missing.fedBy, details), output, from }))
      : String(t('lessons.lackLink', { input: missing.input, to, output, from }));
  }
  const node = titleOnCanvas(missing.nodeId, details);
  const field = missing.field;
  if (missing.absent) return String(t('lessons.lackField', { node, field }));
  const value = shown(t, missing.value);
  const other = missing.other ? titleOnCanvas(missing.other.nodeId, details) : '';
  switch (missing.test.kind) {
    case 'chosen':
      return String(t('lessons.lackChosen', { field, node }));
    case 'equals':
      return String(t('lessons.lackEquals', { field, node, value, wanted: String(missing.test.value) }));
    case 'between':
      return String(t('lessons.lackBetween', { field, node, value, min: missing.test.min, max: missing.test.max }));
    case 'text': {
      // An empty field is asked for a description; one that has a few words is told how many more it needs.
      const chars = typeof missing.value === 'string' ? missing.value.trim().length : 0;
      return String(chars > 0 ? t('lessons.lackTextShort', { field, node, chars, min: missing.test.minChars }) : t('lessons.lackText', { field, node }));
    }
    case 'weighted': {
      const { min, max } = missing.test;
      const high = typeof missing.value === 'string' ? weightsOf(missing.value).find((item) => item.weight > max) : undefined;
      return String(high ? t('lessons.lackWeightedHigh', { field, node, found: high.raw, min, max }) : t('lessons.lackWeighted', { field, node, min, max }));
    }
    case 'has-trigger': {
      const words = new Set<string>();
      for (const source of missing.test.of) {
        const classes = 'role' in source
          ? lesson.steps.flatMap((step) => step.roles ?? []).find((spec) => spec.role === source.role)?.classes ?? []
          : [source.classType];
        for (const item of graph.nodes) {
          if (!classes.includes(item.classType)) continue;
          const file = item.values[source.field];
          if (typeof file === 'string') for (const word of facts.triggers?.[file] ?? []) words.add(word);
        }
      }
      return String(t('lessons.lackTrigger', { node, words: [...words].slice(0, 8).join(', ') }));
    }
    case 'differs':
      return String(t('lessons.lackDiffers', { field, node, other }));
    case 'same':
      return String(t('lessons.lackSame', { field, node, value, wanted: shown(t, missing.other?.value), other }));
  }
}

/**
 * Everything a step lacks, one sentence each. Two nodes of one class that are both missing are one sentence with
 * their number, not the same sentence twice.
 */
function lackLines(t: TFunction, missing: Missing[], lesson: Lesson, shared: Shared): Array<{ text: string; times: number }> {
  const wanted = new Map<string, number>();
  for (const item of missing) {
    if (item.kind === 'node') wanted.set(item.classes.join('|'), (wanted.get(item.classes.join('|')) ?? 0) + 1);
  }
  const lines: string[] = [];
  const said = new Set<string>();
  for (const item of missing) {
    if (item.kind !== 'node') {
      lines.push(lackText(t, item, lesson, shared));
      continue;
    }
    const key = item.classes.join('|');
    if (said.has(key)) continue;
    said.add(key);
    const count = wanted.get(key) ?? 1;
    if (count === 1) {
      lines.push(lackText(t, item, lesson, shared));
      continue;
    }
    const name = nodeNameOf(lesson, item.role, shared.details) ?? item.classes[0];
    const some = shared.graph.nodes.some((node) => item.classes.includes(node.classType));
    lines.push(String(some ? t('lessons.lackNodesMore', { name, count }) : t('lessons.lackNodesNone', { name, count })));
  }
  // Two nodes of one name lack the same thing in the same words: said once, with how many times it is to be done.
  const times = new Map<string, number>();
  for (const line of lines) times.set(line, (times.get(line) ?? 0) + 1);
  return [...times].map(([text, count]) => ({ text, times: count }));
}

function gapText(t: TFunction, gap: LessonGap, details: Details): string {
  if (gap.kind === 'class') return String(t('lessons.missingClass', { name: gap.classes[0] }));
  const name = details[gap.classType]?.displayName || gap.classType;
  return String(gap.side === 'input' ? t('lessons.missingInput', { name, port: gap.port }) : t('lessons.missingOutput', { name, port: gap.port }));
}

function LessonList({ shared }: { shared: Shared }) {
  const { t, i18n } = useTranslation();
  const read = useLessonStore((state) => state.read);
  const done = useLessonStore((state) => state.done);
  const start = useLessonStore((state) => state.start);
  const again = useLessonStore((state) => state.again);
  const openSettings = useUiStore((state) => state.openSettings);
  return (
    <div className={styles.list}>
      <h3 className={styles.heading}>
        <GraduationCap size={16} aria-hidden="true" />
        {t('lessons.listTitle')}
      </h3>
      <p className={styles.intro}>{t('lessons.listIntro')}</p>
      {!shared.catalogRead ? (
        <div className={styles.notice} role="note">
          <p>{t('lessons.notRead')}</p>
          <Button variant="primary" size="sm" icon={<Plug size={14} />} onClick={() => openSettings('connection')}>{t('lessons.connect')}</Button>
        </div>
      ) : null}
      <ul className={styles.cards}>
        {LESSONS.map((lesson) => {
          const words = lessonWords(i18n.language, lesson.id);
          if (!words) return null;
          const gaps = shared.catalogRead ? lessonGaps(lesson, shared.ports) : [];
          const progress = lessonProgress(lesson, shared.graph, shared.facts, new Set(read[lesson.id] ?? NONE));
          const total = lesson.steps.length;
          const finished = progress.current >= total;
          const started = progress.current > 0 && !finished;
          const before = LESSON_AFTER[lesson.id]?.map((id) => lessonWords(i18n.language, id)?.title).filter(Boolean)[0];
          const blocked = !shared.catalogRead || gaps.length > 0;
          return (
            <li key={lesson.id} className={styles.card} data-lesson-card={lesson.id} data-lesson-state={blocked ? 'unfit' : finished ? 'done' : started ? 'started' : 'new'}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>{words.title}</span>
                {finished || done.includes(lesson.id) ? <span className={styles.doneMark}><Check size={12} aria-hidden="true" />{t('lessons.done')}</span> : null}
              </div>
              <p className={styles.cardText}>{words.result}</p>
              <p className={styles.cardMeta}>
                {started ? t('lessons.progress', { current: progress.current + 1, total }) : t('lessons.steps', { count: total })}
                {before ? ` · ${String(t('lessons.after', { title: before }))}` : ''}
              </p>
              {gaps.length > 0 ? (
                <div className={styles.gaps}>
                  <p>{t('lessons.unfit')}</p>
                  <ul>
                    {gaps.slice(0, 4).map((gap) => <li key={JSON.stringify(gap)}>{gapText(t, gap, shared.details)}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className={styles.cardActions}>
                {finished ? (
                  <Button variant="subtle" size="sm" icon={<RotateCcw size={14} />} disabled={blocked} onClick={() => { again(lesson.id); start(lesson.id); }}>{t('lessons.again')}</Button>
                ) : (
                  <Button variant={started ? 'primary' : 'subtle'} size="sm" icon={<ArrowRight size={14} />} disabled={blocked} onClick={() => start(lesson.id)}>
                    {started ? t('lessons.resume') : t('lessons.start')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LessonRun({ lesson, shared, onAsk }: { lesson: Lesson; shared: Shared; onAsk: (question: string) => void }) {
  const { t, i18n } = useTranslation();
  const readIds = useLessonStore((state) => state.read[lesson.id]) ?? NONE;
  const leave = useLessonStore((state) => state.leave);
  const markRead = useLessonStore((state) => state.markRead);
  const finish = useLessonStore((state) => state.finish);
  const start = useLessonStore((state) => state.start);
  const again = useLessonStore((state) => state.again);
  const inSubgraph = useGraphStore((state) => state.activeSubgraphId !== null);
  const words = lessonWords(i18n.language, lesson.id);
  const progress = useMemo(() => lessonProgress(lesson, shared.graph, shared.facts, new Set(readIds)), [lesson, shared.graph, shared.facts, readIds]);
  const total = lesson.steps.length;
  const finished = progress.current >= total;
  // A step looked at again from the list; moving on in the lesson returns to the current one.
  const [peek, setPeek] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPeek(null), [progress.current, lesson.id]);
  useEffect(() => {
    if (finished) finish(lesson.id);
  }, [finished, finish, lesson.id]);
  // What "show me where" lit on the canvas goes out when the thing it pointed at is done, and with the lesson.
  const lack = progress.missing[0];
  const lackKey = lack ? JSON.stringify(lack) : '';
  useEffect(() => clearShown, [lackKey, lesson.id]);
  // A new step is read from its top.
  const root = useRef<HTMLDivElement>(null);
  const viewed = peek ?? progress.current;
  useEffect(() => {
    const scroller = root.current?.closest('.lesson-panel');
    if (scroller) scroller.scrollTop = 0;
  }, [viewed, lesson.id]);
  if (!words) return null;

  const index = peek ?? Math.min(progress.current, total - 1);
  const step = lesson.steps[index];
  const text = words.steps[step.id];
  const nameOf = (role: string) => nodeNameOf(lesson, role, shared.details);
  const current = peek === null && !finished;
  const first = current ? progress.missing[0] : undefined;
  const fix = first ? canDo(first, shared.graph, shared.ports) : null;
  const nextLesson = LESSONS[LESSONS.findIndex((item) => item.id === lesson.id) + 1];
  const nextTitle = nextLesson ? lessonWords(i18n.language, nextLesson.id)?.title : undefined;
  const doneCount = Math.min(progress.current, total);

  return (
    <div ref={root} className={styles.run} data-lesson-step={finished && peek === null ? 'end' : step.id}>
      <div className={styles.top}>
        <Button size="sm" icon={<ArrowLeft size={14} />} onClick={leave}>{t('lessons.back')}</Button>
        <span className={styles.lessonTitle}>{words.title}</span>
      </div>
      <div className={styles.progressRow}>
        <span className={styles.progressText}>{finished ? t('lessons.finishedTitle') : t('lessons.progress', { current: progress.current + 1, total })}</span>
        <div className={styles.bar} role="progressbar" aria-label={String(t('lessons.progressLabel'))} aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
          <span style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
        </div>
      </div>
      {inSubgraph ? <p className={styles.notice} role="note">{t('lessons.inSubgraph')}</p> : null}

      {finished && peek === null ? (
        <section className={styles.step} data-step-state="end">
          <h4 className={styles.stepTitle}><Check size={16} aria-hidden="true" />{t('lessons.finishedTitle')}</h4>
          <p className={styles.plain}>{t('lessons.finishedBody')}</p>
          <div className={styles.actions}>
            <Button variant="primary" size="sm" icon={<FolderOutput size={14} />} onClick={() => void runCommand('file.export')}>{t('lessons.save')}</Button>
            <Button variant="subtle" size="sm" icon={<RotateCcw size={14} />} onClick={() => again(lesson.id)}>{t('lessons.again')}</Button>
          </div>
          {nextLesson && nextTitle ? (
            // The name of the next lesson is a sentence that wraps; a button that held it stuck out of a narrow panel.
            <div className={styles.nextLesson} data-next-lesson={nextLesson.id}>
              <p className={styles.plain}>{t('lessons.nextTitle', { title: nextTitle })}</p>
              <div className={styles.actions}>
                <Button variant="subtle" size="sm" icon={<ArrowRight size={14} />} onClick={() => start(nextLesson.id)}>{t('lessons.next')}</Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className={styles.step} data-step-state={current ? (step.read ? 'read' : 'do') : 'passed'}>
          <h4 className={styles.stepTitle}>{withNodeNames(text.title, nameOf).replace(/\*\*/g, '')}</h4>
          <MarkdownLite text={withNodeNames(text.body, nameOf)} className={styles.body} />
          {current && step.read ? (
            <div className={styles.actions}>
              <Button variant="primary" size="sm" icon={<ArrowRight size={14} />} onClick={() => markRead(lesson.id, step.id)}>{t('lessons.understood')}</Button>
            </div>
          ) : null}
          {current && !step.read ? (
            <>
              {progress.missing.length > 0 ? (
                <div className={styles.lacking} aria-live="polite">
                  <p className={styles.lackingTitle}>{t('lessons.lacking')}</p>
                  <ul>
                    {lackLines(t, progress.missing, lesson, shared).slice(0, 6).map((line) => (
                      <li key={line.text}>
                        {line.text}
                        {line.times > 1 ? <span className={styles.times}> ×{line.times}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className={styles.actions}>
                {first ? (
                  <Button variant="primary" size="sm" icon={<Crosshair size={14} />} onClick={() => showMissing(first, lesson, shared.graph, shared.details)}>{t('lessons.show')}</Button>
                ) : null}
                {first && fix ? (
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={<Wand2 size={14} />}
                    loading={busy}
                    onClick={() => {
                      setBusy(true);
                      void doFix(fix, first.kind === 'node' ? { lesson, role: first.role, roles: progress.roles } : undefined).finally(() => setBusy(false));
                    }}
                  >
                    {t('lessons.doIt')}
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
          {!current ? (
            <div className={styles.actions}>
              <span className={styles.passed}><Check size={14} aria-hidden="true" />{t('lessons.passed')}</span>
              <Button variant="subtle" size="sm" onClick={() => setPeek(null)}>{t('lessons.toCurrent')}</Button>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.ask}
            onClick={() => onAsk(String(t('lessons.askMessage', { lesson: words.title, step: text.title, body: withNodeNames(text.body, nameOf).replace(/[*`]/g, '').replace(/\s+/g, ' ').slice(0, 600) })))}
          >
            <MessageCircleQuestion size={14} aria-hidden="true" />
            {t('lessons.ask')}
          </button>
        </section>
      )}

      <nav className={styles.steps} aria-label={String(t('lessons.stepsTitle'))}>
        <p className={styles.stepsTitle}>{t('lessons.stepsTitle')}</p>
        <ol>
          {lesson.steps.map((item, order) => {
            const passed = order < progress.current;
            const now = order === progress.current;
            const title = withNodeNames(words.steps[item.id].title, nameOf).replace(/\*\*/g, '');
            return (
              <li key={item.id} data-step={item.id} data-step-mark={passed ? 'done' : now ? 'now' : 'later'}>
                <button
                  type="button"
                  className={styles.stepLink}
                  disabled={!passed && !now}
                  aria-current={order === index && !(finished && peek === null) ? 'step' : undefined}
                  onClick={() => setPeek(now ? null : order)}
                >
                  <span className={styles.mark} aria-hidden="true">
                    {passed ? <Check size={12} /> : now ? <CircleDot size={12} /> : order + 1}
                  </span>
                  <span className={styles.stepName}>{title}</span>
                  {passed ? <span className="sr-only">{t('lessons.stepDone')}</span> : now ? <span className="sr-only">{t('lessons.stepNow')}</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

export default function LessonPanel({ onAsk }: { onAsk: (question: string) => void }) {
  const active = useLessonStore((state) => state.active);
  const catalog = useLessonCatalog();
  const graph = useLessonGraph(catalog.details);
  const facts = useLessonFacts(graph);
  const shared: Shared = { details: catalog.details, ports: catalog.ports, catalogRead: catalog.read, graph, facts };
  const lesson = active ? lessonById(active) : null;
  return (
    <div className={`lesson-panel ${styles.panel}`} data-lesson={lesson?.id ?? 'list'}>
      {lesson ? <LessonRun lesson={lesson} shared={shared} onAsk={onAsk} /> : <LessonList shared={shared} />}
    </div>
  );
}
