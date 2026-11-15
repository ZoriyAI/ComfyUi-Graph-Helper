/**
 * "My lessons" in the Lessons panel: the group of the person's own, imported and accepted lessons at the end of the
 * list, the export buttons of the built-in lessons and groups, the notice a lesson of the person shows while it
 * runs (where it came from, who wrote it, that the content rules apply), and the drop target for lesson files.
 *
 * Who uses it: LessonPanel.tsx, through small hooks (one element each), so the panel's own logic stays its owner's.
 *
 * Why it looks like the built-in list: a lesson of the person is run by the same engine and the same panel; only
 * the mark of where it came from, and the 18+ switch for one marked so, set it apart. Its texts are drawn with the
 * same Markdown renderer as the built-in ones, which opens no links.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen, Download, FileUp, Lock, Pencil, RotateCcw, Settings, ShieldAlert, Trash2, Wand2 } from 'lucide-react';
import { lessonGaps, lessonProgress, rolesOf, type ClassPorts, type LessonFacts, type LessonGraph } from '../../../shared/lessons/engine';
import { fitLines, packOf } from '../../../shared/lessons/fit';
import { docWords } from '../../../shared/lessons/share/format';
import { isAdultMine, myEngineLesson, type MyLesson } from '../../../shared/lessons/share/mine';
import type { NodeClassDetail } from '../../../shared/contracts/knowledge';
import { useLessonStore } from '../../state/lessonState';
import { useMyLessonsStore } from '../../state/myLessonsState';
import { useUiStore } from '../../state/uiState';
import { openHelp } from '../../services/help';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import { showToast } from '../../ui/toastStore';
import { useNodeInfoStore } from '../graph/nodeInfo';
import { exportGroup, exportLesson, importDroppedFiles, importLessonsFromDialog } from './lessonFiles';
import { makeLessonFromGraph, editMyLesson } from './lessonAuthoring';
import panel from './LessonPanel.module.css';
import styles from './MyLessons.module.css';

const NONE: readonly string[] = [];

/** What the list shares with this group: the catalog as the lessons see it, the canvas, the facts. */
export interface MyLessonsShared {
  details: Record<string, NodeClassDetail | null>;
  ports: ClassPorts;
  catalogRead: boolean;
  graph: LessonGraph;
  facts: LessonFacts;
}

/** Reads "My lessons" from main once the panel is shown. */
export function useMyLessons(): MyLesson[] {
  const lessons = useMyLessonsStore((state) => state.lessons);
  const loaded = useMyLessonsStore((state) => state.loaded);
  const refresh = useMyLessonsStore((state) => state.refresh);
  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);
  return lessons;
}

/** The mark of where a lesson came from. */
function OriginBadge({ lesson }: { lesson: MyLesson }) {
  const { t } = useTranslation();
  if (lesson.origin === 'assistant') return <Badge tone="ai" icon={<Wand2 size={12} />}>{t('lessonFiles.originAssistant')}</Badge>;
  if (lesson.origin === 'file') return <Badge tone="neutral" icon={<FileUp size={12} />} title={lesson.fileName ? String(t('lessonFiles.originFileNamed', { name: lesson.fileName })) : undefined}>{t('lessonFiles.originFile')}</Badge>;
  return <Badge tone="neutral" icon={<Pencil size={12} />}>{t('lessonFiles.originMade')}</Badge>;
}

/** Drop a lesson file on the list to import it. Returns the props for the element and whether a file is over it. */
export function useLessonDrop(): { over: boolean; props: Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'> } {
  const [over, setOver] = useState(false);
  const props = useMemo(() => ({
    onDragOver: (event: React.DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setOver(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop: (event: React.DragEvent) => {
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      setOver(false);
      void importDroppedFiles(files);
    },
  }), []);
  return { over, props };
}

/** The export button of a built-in lesson card or of a lesson of the person. */
export function LessonExportButton({ lessonId, title }: { lessonId: string; title: string }) {
  const { t } = useTranslation();
  return (
    <IconButton size="sm" label={String(t('lessonFiles.exportLessonNamed', { title }))} data-lesson-export={lessonId} onClick={() => void exportLesson(lessonId)}>
      <Download size={14} aria-hidden="true" />
    </IconButton>
  );
}

/** The export button of a built-in group: the whole group as one pack. */
export function GroupExportButton({ groupId, title }: { groupId: string; title: string }) {
  const { t } = useTranslation();
  return (
    <IconButton size="sm" className={styles.groupExport} label={String(t('lessonFiles.exportGroupNamed', { title }))} data-group-export={groupId} onClick={() => void exportGroup(groupId)}>
      <Download size={14} aria-hidden="true" />
    </IconButton>
  );
}

/**
 * Under the head of a running lesson of the person: where it came from, who wrote it and where from (as text,
 * never a link), the warning on an assistant's draft, and the line that the app's content rules apply.
 */
export function MyLessonNotice({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation();
  useMyLessons();
  const lesson = useMyLessonsStore((state) => state.lessons.find((item) => item.id === lessonId));
  if (!lesson) return null;
  return (
    <div className={styles.notice} data-my-lesson-notice={lesson.origin}>
      <div className={styles.badges}>
        <OriginBadge lesson={lesson} />
        {isAdultMine(lesson) ? <Badge tone="warn">18+</Badge> : null}
      </div>
      {lesson.origin === 'assistant' ? <p className={styles.warn}>{t('lessonFiles.assistantWarn')}</p> : null}
      {lesson.doc.author ? <p className={panel.cardMeta}>{t('lessonFiles.author', { author: lesson.doc.author })}</p> : null}
      {lesson.doc.source ? <p className={panel.cardMeta}>{t('lessonFiles.source', { source: lesson.doc.source })}</p> : null}
      <p className={panel.cardMeta}>
        {t('lessonFiles.rules')}{' '}
        <Button variant="ghost" size="sm" className={styles.inline} icon={<BookOpen size={14} />} onClick={() => openHelp('content-rules')}>{t('lessonFiles.rulesOpen')}</Button>
      </p>
    </div>
  );
}

function MyLessonCard({ lesson, shared }: { lesson: MyLesson; shared: MyLessonsShared }) {
  const { t, i18n } = useTranslation();
  const read = useLessonStore((state) => state.read[lesson.id]) ?? NONE;
  const doneIds = useLessonStore((state) => state.done);
  const start = useLessonStore((state) => state.start);
  const again = useLessonStore((state) => state.again);
  const refresh = useMyLessonsStore((state) => state.refresh);
  const [confirming, setConfirming] = useState(false);
  const engine = useMemo(() => myEngineLesson(lesson), [lesson]);
  const words = docWords(lesson.doc, i18n.language);
  const gaps = shared.catalogRead ? lessonGaps(engine, shared.ports) : [];
  const lines = gaps.length > 0 ? fitLines({ gaps, blockedBy: null }, (key, values) => String(t(key, values ?? {})), (classType) => shared.details[classType]?.displayName || classType, (id) => id) : [];
  const progress = lessonProgress(engine, shared.graph, shared.facts, new Set(read));
  const total = engine.steps.length;
  const finished = progress.current >= total;
  const started = progress.current > 0 && !finished;
  const blocked = !shared.catalogRead || lines.length > 0;
  const adult = isAdultMine(lesson);
  const packs = [...new Set(rolesOf(engine).map((spec) => packOf(spec.classes[0])).filter((pack): pack is string => pack !== null))];
  const remove = async () => {
    setConfirming(false);
    if (await window.electronAPI?.removeMyLesson?.(lesson.id)) {
      again(lesson.id);
      await refresh();
      showToast({ id: 'lesson-removed', tone: 'success', title: String(t('lessonFiles.removed')), duration: 4000 });
    }
  };
  const markAdult = async () => {
    if (await window.electronAPI?.markMyLessonAdult?.(lesson.id, !lesson.adultMark)) await refresh();
  };
  return (
    <li id={`lesson-${lesson.id}`} tabIndex={-1} className={panel.card} data-lesson-card={lesson.id} data-lesson-origin={lesson.origin} data-lesson-state={blocked ? 'unfit' : finished ? 'done' : started ? 'started' : 'new'}>
      <div className={panel.cardHead}>
        <span className={panel.cardTitle}>{words.title}</span>
        {finished || doneIds.includes(lesson.id) ? <span className={panel.doneMark}>{t('lessons.done')}</span> : null}
      </div>
      <div className={styles.badges}>
        <OriginBadge lesson={lesson} />
        {adult ? <Badge tone="warn" title={String(t('lessonFiles.adultNote'))}>18+</Badge> : null}
      </div>
      {words.result ? <p className={panel.cardText}>{words.result}</p> : null}
      {packs.length > 0 ? <p className={panel.cardMeta}>{t('lessonFiles.needs', { packs: packs.join(', ') })}</p> : null}
      {lines.length > 0 ? (
        <div className={panel.gaps}>
          <p>{t('lessons.unfit')}</p>
          <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      ) : null}
      {confirming ? (
        <div className={panel.cardActions} role="group" aria-label={String(t('lessonFiles.removeConfirm', { title: words.title }))}>
          <span className={panel.cardSteps}>{t('lessonFiles.removeConfirm', { title: words.title })}</span>
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => void remove()}>{t('lessonFiles.removeYes')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{t('lessonFiles.removeNo')}</Button>
        </div>
      ) : (
        <div className={panel.cardActions}>
          {finished ? (
            <Button variant="subtle" size="sm" icon={<RotateCcw size={14} />} disabled={blocked} onClick={() => { again(lesson.id); start(lesson.id); }}>{t('lessons.again')}</Button>
          ) : (
            <Button variant={started ? 'primary' : 'subtle'} quiet size="sm" icon={<ArrowRight size={14} />} disabled={blocked} onClick={() => start(lesson.id)}>
              {started ? t('lessons.resume') : t('lessons.start')}
            </Button>
          )}
          <span className={panel.cardSteps}>{started ? t('lessons.progress', { current: progress.current + 1, total }) : t('lessons.steps', { count: total })}</span>
          <span className={styles.tools}>
            <IconButton size="sm" label={String(t('lessonFiles.edit'))} onClick={() => editMyLesson(lesson)}><Pencil size={14} aria-hidden="true" /></IconButton>
            <LessonExportButton lessonId={lesson.id} title={words.title} />
            <IconButton size="sm" active={lesson.adultMark} label={String(lesson.adultMark ? t('lessonFiles.unmarkAdult') : t('lessonFiles.markAdult'))} disabled={lesson.doc.adult === true} onClick={() => void markAdult()}><ShieldAlert size={14} aria-hidden="true" /></IconButton>
            <IconButton size="sm" label={String(t('lessonFiles.remove'))} data-lesson-remove={lesson.id} onClick={() => setConfirming(true)}><Trash2 size={14} aria-hidden="true" /></IconButton>
          </span>
        </div>
      )}
    </li>
  );
}

/**
 * The group "My lessons", last in the list. A lesson marked for adults stays closed, not hidden, while the switch
 * is off: one row says how many there are and leads to the switch, as the built-in adult group does.
 */
export function MyLessonsGroup({ shared, adultOn }: { shared: MyLessonsShared; adultOn: boolean }) {
  const { t } = useTranslation();
  const lessons = useMyLessons();
  const request = useNodeInfoStore((state) => state.request);
  const openSettings = useUiStore((state) => state.openSettings);
  const doneIds = useLessonStore((state) => state.done);
  const classes = useMemo(() => [...new Set(lessons.flatMap((lesson) => lesson.doc.steps.flatMap((step) => (step.roles ?? []).flatMap((spec) => spec.classes))))], [lessons]);
  useEffect(() => {
    for (const classType of classes) void request(classType);
  }, [classes, request]);
  const open = lessons.filter((lesson) => adultOn || !isAdultMine(lesson));
  const closed = lessons.length - open.length;
  return (
    <section className={panel.group} data-lesson-group="mine" aria-labelledby="lesson-group-mine">
      <h4 id="lesson-group-mine" className={panel.groupTitle}>
        <span>{t('lessonFiles.group')}</span>
        <span className={panel.groupCount}>{t('lessons.groupDone', { done: open.filter((lesson) => doneIds.includes(lesson.id)).length, total: open.length })}</span>
      </h4>
      <div className={styles.groupActions}>
        <Button variant="subtle" size="sm" icon={<FileUp size={14} />} onClick={() => void importLessonsFromDialog()}>{t('lessonFiles.importButton')}</Button>
        <Button variant="subtle" size="sm" icon={<Wand2 size={14} />} onClick={() => void makeLessonFromGraph()}>{t('lessonFiles.makeButton')}</Button>
      </div>
      {lessons.length === 0 ? <p className={panel.cardMeta}>{t('lessonFiles.empty')} {t('lessonFiles.dropHint')}</p> : null}
      <ul className={panel.cards}>
        {closed > 0 ? (
          <li className={panel.card} data-lesson-group-closed="mine-adult" data-lesson-state="closed">
            <div className={panel.cardHead}>
              <span className={panel.cardTitle}><Lock size={14} aria-hidden="true" /> {t('lessons.adultGroup')}</span>
            </div>
            <p className={panel.cardText}>{t('lessons.adultClosed')}</p>
            <div className={panel.cardActions}>
              <Button variant="subtle" quiet size="sm" icon={<Settings size={14} />} onClick={() => openSettings('privacy')}>{t('lessons.adultOpen')}</Button>
            </div>
          </li>
        ) : null}
        {open.map((lesson) => <MyLessonCard key={lesson.id} lesson={lesson} shared={shared} />)}
      </ul>
    </section>
  );
}

/** The visible mark while a file is dragged over the list. */
export function DropMark({ over }: { over: boolean }) {
  const { t } = useTranslation();
  return over ? <p className={styles.dropMark} role="status">{t('lessonFiles.dropHere')}</p> : null;
}
