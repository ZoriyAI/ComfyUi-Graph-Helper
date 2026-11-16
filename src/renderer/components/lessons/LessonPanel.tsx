/**
 * The helper's "Learn" mode. The person builds a graph by hand; the panel says what the step is and why, shows
 * where it is on the canvas, and reads off the graph when the step is done. Nothing is asked of a model: the
 * lessons are the app's own.
 *
 * Without an open lesson: the list, each lesson with whether it fits this ComfyUI, read by topic, by level, by track or
 * as the path of one track (LessonViews.tsx). With one: the step, what it still lacks in plain words, "show me where",
 * "do this for me" where the app can, and the steps as a list. A step the person answers (a checklist, a rubric, a
 * quiz, a read-check) is drawn by PersonStep.tsx; the end of a lesson says which outcomes the app checked and which
 * are the person's own word.
 *
 * Who uses it: chat/ChatDock.tsx renders it in place of the conversation while Learn mode is on.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleDashed, CircleDot, Crosshair, FolderOutput, GraduationCap, Lock, MessageCircleQuestion, Plug, RotateCcw, Settings, Wand2 } from 'lucide-react';
import type { TFunction } from 'i18next';
import { lessonOutcomes, lessonProgress, type ClassPorts, type Lesson, type LessonFacts, type LessonGraph, type Missing } from '../../../shared/lessons/engine';
import { ADULT_GROUP, isAdultLesson, lessonById, nextLesson as nextLessonOf } from '../../../shared/lessons/lessons';
import { adultContentOn } from '../../../shared/config/preferences';
import { lessonDependencies, lessonGroups, lessonLevels, trackLessons, trackPath } from '../../../shared/lessons/navigation';
import { isPersonStep, type LessonAnswers, type ReadFacts } from '../../../shared/lessons/steps';
import type { LessonTrack } from '../../../shared/lessons/programme';
import { fitLines, fits, lessonFit } from '../../../shared/lessons/fit';
import { lessonWords, withNodeNames } from '../../../shared/lessons/texts';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';
import { runCommand } from '../../commands/registry';
import { useGraphStore } from '../../state/graphState';
import { shownLesson, useLessonStore } from '../../state/lessonState';
import { usePreferencesStore } from '../../state/preferencesState';
import { useUiStore } from '../../state/uiState';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import MarkdownLite from '../chat/MarkdownLite';
import { useLessonMotion } from './lessonMotion';
import { canDo, clearShown, doFix, nodeNameOf, showMissing, useLessonCatalog, useLessonFacts, useLessonGraph, useReadFacts } from './lessonModel';
import PersonStep from './PersonStep';
import { AboutLesson, OutcomeMarks, PlaceLine, ViewBar, storedOutcomes, storedStates, type LessonView } from './LessonViews';
import { lackLines, lackText } from './lackText';
import styles from './LessonPanel.module.css';
import RecoveryNotice from '../../ui/RecoveryNotice';
// The person's own lessons: their group, export buttons, the drop target for lesson files, the lesson editor.
import { DropMark, GroupExportButton, LessonExportButton, MyLessonNotice, MyLessonsGroup, useLessonDrop, useMyLessons } from './MyLessons';
import LessonEditor from './LessonEditor';
import { myLessonById, myLessonWords, useMyLessonsStore } from '../../state/myLessonsState';


/** Catalog details by class; null for a class the catalog does not have. */
type Details = Record<string, NodeClassDetail | null>;

/** What every part of the panel reads: the catalog, the lesson view of the graph, and facts about it. */
interface Shared {
  details: Details;
  ports: ClassPorts;
  catalogRead: boolean;
  graph: LessonGraph;
  facts: LessonFacts;
  /** What the read-checks of the open lesson look at (steps.ts ReadFacts). */
  readFacts: ReadFacts;
}

/** No answers yet: one shared object, so a store selector with nothing stored keeps the same reference. */
const NO_ANSWERS: LessonAnswers = {};

/** One shared empty list, so a store selector with nothing stored keeps the same reference. */
const NONE: readonly string[] = [];
/** A lesson with more steps than this shows the steps near the current one, and the rest on request. */
const FOLD_STEPS_OVER = 12;
const STEPS_AROUND = 2;


/**
 * Why a lesson does not fit this ComfyUI: the first reason, and the rest one press away, so a card in the list
 * stays short. Every line stays in the page (hidden until opened) for screen readers and search.
 */
function UnfitReasons({ lines }: { lines: string[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [first, ...rest] = lines;
  // A native disclosure, not a second button: the card's one button stays the one that starts the lesson.
  return (
    <div className={styles.gaps}>
      <p>{t('lessons.unfit')}</p>
      <ul>
        <li>{first}</li>
      </ul>
      {rest.length > 0 ? (
        <details className={styles.gapsRest} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
          <summary className={styles.gapsMore}>
            <ChevronRight size={12} aria-hidden="true" />
            {open ? t('lessons.unfitLess') : t('lessons.unfitMore', { count: rest.length })}
          </summary>
          <ul>
            {rest.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** The list of lessons by group, by level, by track or as a path, each card with its state, fit and dependencies, then the person's own lessons. */
function LessonList({ shared, adultOn }: { shared: Shared; adultOn: boolean }) {
  const { t, i18n } = useTranslation();
  const read = useLessonStore((state) => state.read);
  const done = useLessonStore((state) => state.done);
  const answersAll = useLessonStore((state) => state.answers);
  const outcomesAll = useLessonStore((state) => state.outcomes);
  const start = useLessonStore((state) => state.start);
  const again = useLessonStore((state) => state.again);
  const openSettings = useUiStore((state) => state.openSettings);
  const drop = useLessonDrop();
  const [view, setView] = useState<LessonView>('groups');
  const [track, setTrack] = useState<LessonTrack>('base');

  /** One lesson's row: its words, fit, progress and whether it is finished. */
  const rowOf = (lesson: Lesson) => {
    const words = lessonWords(i18n.language, lesson.id);
    const fit = shared.catalogRead ? lessonFit(lesson, shared.ports) : null;
    const gaps = fit && !fits(fit) ? fitLines(fit, (key, values) => String(t(key, values ?? {})), (classType) => shared.details[classType]?.displayName || classType, (id) => lessonWords(i18n.language, id)?.title ?? id) : [];
    const progress = lessonProgress(lesson, shared.graph, { ...shared.facts, read: shared.readFacts }, new Set(read[lesson.id] ?? NONE), answersAll[lesson.id] ?? NO_ANSWERS);
    const total = lesson.steps.length;
    // A lesson once finished stays finished: a later lesson may rewire its graph (outpainting over inpainting,
    // a face over the first picture), and that is no reason to tell the person the lesson is undone.
    const finished = progress.current >= total || done.includes(lesson.id);
    return { lesson, words, gaps, progress, total, finished, done: finished };
  };

  /** One card; `order` is its place on a path. Only the first card of a lesson in the list carries its anchor. */
  const card = (row: ReturnType<typeof rowOf>, order?: number) => {
    const { lesson, words, gaps, progress, total, finished, done: isDone } = row;
    if (!words) return null;
    const started = progress.current > 0 && !finished;
    const before = lessonDependencies(lesson.id).map((id) => ({ id, title: lessonWords(i18n.language, id)?.title ?? id }));
    const blocked = !shared.catalogRead || gaps.length > 0;
    return (
      <li key={lesson.id} id={`lesson-${lesson.id}`} tabIndex={-1} className={styles.card} data-lesson-card={lesson.id} data-lesson-state={blocked ? 'unfit' : finished ? 'done' : started ? 'started' : 'new'}>
        <div className={styles.cardHead}>
          {/* Lesson names are headings under their group (h4), so a screen reader can jump between lessons. */}
          <span className={styles.cardTitle} role="heading" aria-level={5}>{order !== undefined ? `${order}. ` : ''}{words.title}</span>
          {isDone ? <span className={styles.doneMark}><Check size={12} aria-hidden="true" />{t('lessons.done')}</span> : null}
        </div>
        <PlaceLine lessonId={lesson.id} />
        <p className={styles.cardText}>{words.result}</p>
        <OutcomeMarks states={storedStates(lesson, outcomesAll[lesson.id])} />
        {before.length > 0 ? (
          <div className={styles.dependencies}>
            <span>{t('lessons.related')}</span>
            {before.map((dependency) => (
              <a href={`#lesson-${dependency.id}`} key={dependency.id} onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById(`lesson-${dependency.id}`);
                target?.scrollIntoView({ block: 'nearest' });
                target?.focus({ preventScroll: true });
              }}>{dependency.title}</a>
            ))}
          </div>
        ) : null}
        <AboutLesson lesson={lesson} words={words} />
        {gaps.length > 0 ? <UnfitReasons lines={gaps} /> : null}
        <div className={styles.cardActions}>
          {finished ? (
            <Button variant="subtle" size="sm" icon={<RotateCcw size={14} />} disabled={blocked} onClick={() => { again(lesson.id); start(lesson.id); }}>{t('lessons.again')}</Button>
          ) : (
            <Button variant={started ? 'primary' : 'subtle'} quiet size="sm" icon={<ArrowRight size={14} />} disabled={blocked} onClick={() => start(lesson.id)}>
              {started ? t('lessons.resume') : t('lessons.start')}
            </Button>
          )}
          <span className={styles.cardSteps}>
            {started ? t('lessons.progress', { current: progress.current + 1, total }) : t('lessons.steps', { count: total })}
          </span>
          <LessonExportButton lessonId={lesson.id} title={words.title} />
        </div>
      </li>
    );
  };

  /** A section of cards under a heading, with how many of them are done. */
  const section = (id: string, title: string, lessons: readonly Lesson[], numbered = false) => {
    const rows = lessons.filter((lesson) => adultOn || !isAdultLesson(lesson.id)).map(rowOf);
    return (
      <section key={id} className={styles.group} data-lesson-group={id} aria-labelledby={`lesson-group-${id}`}>
        <h4 id={`lesson-group-${id}`} className={styles.groupTitle}>
          <span>{title}</span>
          <span className={styles.groupCount}>{t('lessons.groupDone', { done: rows.filter((row) => row.done).length, total: rows.length })}</span>
        </h4>
        {rows.length === 0 ? <p className={styles.cardMeta}>{t('lessons.view.trackEmpty')}</p> : null}
        <ul className={styles.cards}>{rows.map((row, index) => card(row, numbered ? index + 1 : undefined))}</ul>
      </section>
    );
  };

  return (
    <div className={styles.list} {...drop.props}>
      <h3 className={styles.heading}>
        <GraduationCap size={16} aria-hidden="true" />
        {t('lessons.listTitle')}
      </h3>
      <p className={styles.intro}>{t('lessons.listIntro')}</p>
      <ViewBar view={view} track={track} onView={setView} onTrack={setTrack} />
      <DropMark over={drop.over} />
      {!shared.catalogRead ? (
        <div className={styles.notice} role="note">
          <p>{t('lessons.notRead')}</p>
          <Button variant="primary" quiet size="sm" icon={<Plug size={14} />} onClick={() => openSettings('connection')}>{t('lessons.connect')}</Button>
        </div>
      ) : null}
      {view === 'levels' ? lessonLevels().map(({ level, lessons }) => section(`level-${level}`, String(t(`lessons.level.${level}`)), lessons)) : null}
      {view === 'tracks' ? section(`track-${track}`, String(t('lessons.view.trackTitle', { track: t(`lessons.track.${track.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase())}`) })), trackLessons(track)) : null}
      {view === 'path' ? (
        <>
          <p className={styles.intro}>{t('lessons.view.pathIntro')}</p>
          {section(`path-${track}`, String(t('lessons.view.pathTitle', { track: t(`lessons.track.${track.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase())}`) })), trackPath(track, adultOn), true)}
        </>
      ) : null}
      {view === 'groups' ? lessonGroups().map((group) => {
        const rows = group.lessons.map(rowOf);
        const doneHere = rows.filter((row) => row.done).length;
        return (
          // The lessons read as a few short lists: what kind of graph each group builds is its title.
          <section key={group.id} className={styles.group} data-lesson-group={group.id} aria-labelledby={`lesson-group-${group.id}`}>
            <h4 id={`lesson-group-${group.id}`} className={styles.groupTitle}>
              <span>{group.title[i18n.language === 'ru' ? 'ru' : 'en']}</span>
              <span className={styles.groupCount}>{t('lessons.groupDone', { done: doneHere, total: rows.length })}</span>
              {group.id === ADULT_GROUP.id && !adultOn ? null : <GroupExportButton groupId={group.id} title={group.title[i18n.language === 'ru' ? 'ru' : 'en']} />}
            </h4>
            <ul className={styles.cards}>
              {/* The lessons for adults: closed, not hidden, while the switch is off; one row that leads to it. */}
              {group.id === ADULT_GROUP.id && !adultOn ? (
                <li className={styles.card} data-lesson-group-closed="adult" data-lesson-state="closed">
                  <div className={styles.cardHead}>
                    <span className={styles.cardTitle}><Lock size={14} aria-hidden="true" /> {t('lessons.adultGroup')}</span>
                  </div>
                  <p className={styles.cardText}>{t('lessons.adultClosed')}</p>
                  <div className={styles.cardActions}>
                    <Button variant="subtle" quiet size="sm" icon={<Settings size={14} />} onClick={() => openSettings('privacy')}>{t('lessons.adultOpen')}</Button>
                  </div>
                </li>
              ) : null}
              {(group.id === ADULT_GROUP.id && !adultOn ? [] : rows).map((row) => card(row))}
            </ul>
          </section>
        );
      }) : null}
      <MyLessonsGroup shared={shared} adultOn={adultOn} />
    </div>
  );
}

/**
 * One open lesson: the head with progress, the current (or a looked-at) step with what it lacks and the Show and
 * Do it buttons, the end card with the next lesson, and the list of steps.
 */
function LessonRun({ lesson, shared, onAsk }: { lesson: Lesson; shared: Shared; onAsk: (question: string) => void }) {
  const { t, i18n } = useTranslation();
  const readIds = useLessonStore((state) => state.read[lesson.id]) ?? NONE;
  const answers = useLessonStore((state) => state.answers[lesson.id]) ?? NO_ANSWERS;
  const answer = useLessonStore((state) => state.answer);
  const clearAnswers = useLessonStore((state) => state.clearAnswers);
  const setOutcomes = useLessonStore((state) => state.setOutcomes);
  // A transfer task keeps "Still to do" folded until the person asks for it.
  const [lacksOpen, setLacksOpen] = useState(false);
  const leave = useLessonStore((state) => state.leave);
  const markRead = useLessonStore((state) => state.markRead);
  const finish = useLessonStore((state) => state.finish);
  const start = useLessonStore((state) => state.start);
  const again = useLessonStore((state) => state.again);
  const inSubgraph = useGraphStore((state) => state.activeSubgraphId !== null);
  const doneIds = useLessonStore((state) => state.done);
  const reached = useLessonStore((state) => state.reached[lesson.id]);
  const reach = useLessonStore((state) => state.reach);
  const words = lessonWords(i18n.language, lesson.id) ?? myLessonWords(i18n.language, lesson.id);
  const facts = useMemo(() => ({ ...shared.facts, read: shared.readFacts }), [shared.facts, shared.readFacts]);
  const progress = useMemo(() => lessonProgress(lesson, shared.graph, facts, new Set(readIds), answers), [lesson, shared.graph, facts, readIds, answers]);
  const outcomes = useMemo(() => lessonOutcomes(lesson, progress, answers, shared.graph, facts), [lesson, progress, answers, shared.graph, facts]);
  const total = lesson.steps.length;
  const finished = progress.current >= total;
  // A step looked at again from the list; moving on in the lesson returns to the current one.
  const [peek, setPeek] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [allSteps, setAllSteps] = useState(false);
  const folded = !allSteps && lesson.steps.length > FOLD_STEPS_OVER;
  useEffect(() => setPeek(null), [progress.current, lesson.id]);
  useEffect(() => setLacksOpen(false), [progress.current, lesson.id]);
  // The outcomes reached are kept for the list; one reached once stays (a later lesson may rewire the canvas).
  const outcomesKey = storedOutcomes(outcomes).join(',');
  useEffect(() => {
    const kept = useLessonStore.getState().outcomes[lesson.id] ?? [];
    const merged = [...new Set([...kept, ...storedOutcomes(outcomes)])];
    // A run on the app's check replaces the person's word for it, never the other way round.
    const next = merged.includes('run-app') ? merged.filter((item) => item !== 'run-self') : merged;
    setOutcomes(lesson.id, next.sort());
    // `outcomesKey` stands for the outcomes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomesKey, lesson.id, setOutcomes]);
  // The canvas follows the lesson: focus on the step's place, a flash for a passed step (motion package).
  useLessonMotion(lesson.id, progress, !finished);
  useEffect(() => {
    if (finished) finish(lesson.id);
  }, [finished, finish, lesson.id]);
  // The furthest step reached: a lesson the canvas takes back behind it says so.
  useEffect(() => {
    if (progress.current > (reached ?? -1)) reach(lesson.id, progress.current);
  }, [progress.current, reached, reach, lesson.id]);
  const steppedBack = reached !== undefined && progress.current < reached && !finished;
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
  // A transfer task has no ready answer: no "Do this for me", and the lacks stay folded until asked for.
  const transfer = step.transfer === true;
  const fix = first && !transfer ? canDo(first, shared.graph, shared.ports, shared.details, shared.facts) : null;
  const person = isPersonStep(step);
  // One rule for the next lesson (lessons.ts nextLesson): the grouped path, a lesson that fits this ComfyUI and
  // is not done, never a lesson for adults after an ordinary one.
  const nextLesson = nextLessonOf(lesson.id, (id) => {
    const candidate = lessonById(id);
    return Boolean(candidate) && shared.catalogRead && fits(lessonFit(candidate!, shared.ports));
  }, new Set([...doneIds, lesson.id]));
  const nextTitle = nextLesson ? lessonWords(i18n.language, nextLesson.id)?.title : undefined;
  const doneCount = Math.min(progress.current, total);

  return (
    <div ref={root} className={styles.run} data-lesson-step={finished && peek === null ? 'end' : step.id}>
      {/* A compact head that stays at the top while the step scrolls: back, the lesson, how far, a thin bar. */}
      <header className={styles.top} data-finished={finished ? 'true' : undefined}>
        <div className={styles.topRow}>
          <IconButton size="sm" label={String(t('lessons.back'))} onClick={leave}>
            <ArrowLeft size={16} aria-hidden="true" />
          </IconButton>
          <span className={styles.lessonTitle}>{words.title}</span>
        </div>
        <div className={styles.progressRow}>
          <span className={styles.progressText}>{t('lessons.progress', { current: finished ? total : progress.current + 1, total })}</span>
          <div className={styles.bar} role="progressbar" aria-label={String(t('lessons.progressLabel'))} aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
            <span style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
          </div>
        </div>
      </header>
      {inSubgraph ? <p className={styles.notice} role="note">{t('lessons.inSubgraph')}</p> : null}
      {peek === null && !finished ? (progress.hints ?? []).map((hint) => (
        <p key={`${hint.kind}-${hint.kind === 'field' ? `${hint.nodeId}.${hint.field}` : ''}`} className={styles.notice} role="note" data-lesson-hint="">
          {lackText(t, hint, lesson, { details: shared.details, graph: shared.graph, facts: shared.facts, roles: progress.roles, language: i18n.language, roleLabels: words.roles })}
        </p>
      )) : null}
      {/* Accessibility: a screen reader hears the new step when the lesson moves on (or is done), once per step. */}
      <span className="sr-only" role="status" aria-live="polite">
        {finished && peek === null ? t('lessons.finishedTitle') : current ? `${t('lessons.progress', { current: progress.current + 1, total })}. ${withNodeNames(text.title, nameOf).replace(/\*\*/g, '')}` : ''}
      </span>
      {steppedBack && peek === null ? <p className={styles.notice} role="status" data-lesson-back="">{t('lessons.steppedBack', { step: progress.current + 1 })}</p> : null}
      <MyLessonNotice lessonId={lesson.id} />

      {finished && peek === null ? (
        <section className={styles.step} data-step-state="end">
          <h4 className={styles.stepTitle} tabIndex={-1} data-focus-fallback=""><Check size={16} aria-hidden="true" />{t('lessons.finishedTitle')}</h4>
          <p className={styles.plain}>{t('lessons.finishedBody')}</p>
          {outcomes.length > 1 ? (
            // What the end can truthfully say: what the app checked, and what is the person's own word.
            <div className={styles.nextLesson} data-lesson-outcomes="">
              <OutcomeMarks states={outcomes} full />
              <p className={styles.plain}>{t('lessons.outcome.honest')}</p>
            </div>
          ) : null}
          <div className={styles.actions}>
            <Button variant={nextLesson && nextTitle ? 'subtle' : 'primary'} quiet size="sm" icon={<FolderOutput size={14} />} onClick={() => void runCommand('file.export')}>{t('lessons.save')}</Button>
            <Button variant="subtle" size="sm" icon={<RotateCcw size={14} />} onClick={() => again(lesson.id)}>{t('lessons.again')}</Button>
          </div>
          {nextLesson && nextTitle ? (
            // Going on is the path, saving is optional: the next lesson carries the primary button.
            // The name of the next lesson is a sentence that wraps; a button that held it stuck out of a narrow panel.
            <div className={styles.nextLesson} data-next-lesson={nextLesson.id}>
              <p className={styles.plain}>{t('lessons.nextTitle', { title: nextTitle })}</p>
              <div className={styles.actions}>
                <Button variant="primary" quiet size="sm" icon={<ArrowRight size={14} />} onClick={() => start(nextLesson.id)}>{t('lessons.next')}</Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <section className={styles.step} data-step-state={current ? (step.read ? 'read' : person ? 'answer' : 'do') : 'passed'} data-step-kind={step.read ? 'read' : person ? Object.keys(step).find((key) => ['checklist', 'rubric', 'quiz', 'readCheck'].includes(key)) : 'canvas'} data-transfer={transfer ? 'true' : undefined}>
          {/* Accessibility: when the button that moved the lesson on disappears, focus lands here (a11y/focusRescue.ts). */}
          <h4 className={styles.stepTitle} tabIndex={-1} data-focus-fallback="">{withNodeNames(text.title, nameOf).replace(/\*\*/g, '')}</h4>
          <MarkdownLite text={withNodeNames(text.body, nameOf)} className={styles.body} terms={i18n.language} />
          {transfer ? <p className={styles.cardMeta} data-transfer-note="">{t('lessons.transferNote')}</p> : null}
          {person ? (
            <PersonStep
              step={step}
              words={text}
              answers={answers[step.id] ?? {}}
              graph={shared.graph}
              facts={shared.readFacts}
              onAnswer={(itemId, value) => answer(lesson.id, step.id, itemId, value)}
              onClear={() => clearAnswers(lesson.id, step.id)}
            />
          ) : null}
          {current && step.read ? (
            <div className={styles.actions}>
              <Button variant="primary" quiet size="sm" icon={<ArrowRight size={14} />} onClick={() => markRead(lesson.id, step.id)}>{t('lessons.understood')}</Button>
            </div>
          ) : null}
          {current && !step.read && !person ? (
            <>
              {transfer && !lacksOpen && progress.missing.length > 0 ? (
                <Button variant="ghost" size="sm" className={styles.allSteps} onClick={() => setLacksOpen(true)}>{t('lessons.transferShow')}</Button>
              ) : null}
              {progress.missing.length > 0 && (!transfer || lacksOpen) ? (
                <div className={styles.lacking} aria-live="polite">
                  <p className={styles.lackingTitle}>{t('lessons.lacking')}</p>
                  <ul>
                    {lackLines(t, progress.missing, lesson, { details: shared.details, graph: shared.graph, facts: shared.facts, roles: progress.roles, language: i18n.language, roleLabels: words.roles }).slice(0, 6).map((line) => (
                      <li key={line.text}>
                        <CircleDashed className={styles.lackIcon} size={14} aria-hidden="true" />
                        {line.text}
                        {line.times > 1 ? <span className={styles.times}> ×{line.times}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className={styles.actions}>
                {first?.kind === 'field' && first.why?.kind === 'metadata' ? <>
                  <Button size="sm" onClick={() => useUiStore.getState().bumpCatalog()}>{t('recovery.retryLoad')}</Button>
                  <Button size="sm" onClick={() => useUiStore.getState().setDialog('sync-problems')}>{t('guidance.actions.sync')}</Button>
                </> : null}
                {first ? (
                  <Button
                    variant="primary" quiet size="sm" icon={<Crosshair size={14} />} disabled={inSubgraph}
                    data-lesson-target={first.kind === 'field' ? first.nodeId : first.kind === 'link' ? first.to.nodeId : undefined}
                    onClick={() => showMissing(first, lesson, shared.graph, shared.details)}
                  >{t('lessons.show')}</Button>
                ) : null}
                {first && fix ? (
                  <Button
                    variant="subtle"
                    size="sm"
                    icon={<Wand2 size={14} />}
                    loading={busy}
                    disabled={inSubgraph}
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
            // A long lesson shows the steps around where the person is; the rest are one press away.
            const near = Math.abs(order - Math.min(index, total - 1)) <= STEPS_AROUND;
            return (
              <li key={item.id} data-step={item.id} data-step-mark={passed ? 'done' : now ? 'now' : 'later'} hidden={folded && !near}>
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
        {total > FOLD_STEPS_OVER ? (
          <Button variant="ghost" size="sm" className={styles.allSteps} aria-expanded={!folded} onClick={() => setAllSteps((open) => !open)}>
            {folded ? t('lessons.allSteps', { count: total }) : t('lessons.fewerSteps')}
          </Button>
        ) : null}
      </nav>
    </div>
  );
}

/** The Learn panel: the editor, an open lesson or the list. `onAsk` sends a question about a step to the chat. */
export default function LessonPanel({ onAsk }: { onAsk: (question: string) => void }) {
  const persistence = useLessonStore(state => state.persistence);
  const loadError = useMyLessonsStore(state => state.error);
  const loading = useMyLessonsStore(state => state.loading);
  const active = useLessonStore((state) => state.active);
  const adultOn = usePreferencesStore((state) => adultContentOn(state.preferences));
  const catalog = useLessonCatalog();
  const graph = useLessonGraph(catalog.details);
  const facts = useLessonFacts(graph, catalog.details);
  // The person's own lessons are read once the panel shows, so a `my:` lesson that was open comes back after a restart.
  useMyLessons();
  const editing = useMyLessonsStore((state) => state.editing);
  const shownId = shownLesson(active, adultOn);
  const lesson = shownId ? lessonById(shownId) ?? myLessonById(shownId) : null;
  const readFacts = useReadFacts(lesson, graph, catalog.details, catalog.read);
  const shared: Shared = { details: catalog.details, ports: catalog.ports, catalogRead: catalog.read, graph, facts, readFacts };
  return (
    <div className={`lesson-panel ${styles.panel}`} data-lesson={editing ? 'editor' : lesson?.id ?? 'list'}>
      {persistence === 'failed' ? <RecoveryNotice kind="progress" saving retry={() => useLessonStore.getState().retrySave()} /> : null}
      {loadError ? <RecoveryNotice kind="lessons" retry={() => void useMyLessonsStore.getState().refresh()} /> : loading ? <RecoveryNotice kind="lessons" loading /> : null}
      {editing ? <LessonEditor editing={editing} /> : lesson ? <LessonRun lesson={lesson} shared={shared} onAsk={onAsk} /> : <LessonList shared={shared} adultOn={adultOn} />}
    </div>
  );
}
