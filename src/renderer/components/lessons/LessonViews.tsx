/**
 * The parts of the lessons panel that come with the programme of version 1.1: the choice of how the list is read (by
 * topic, by level, by track, or as the path of one track), a lesson's place in the programme (level, priority,
 * tracks), its outcomes (structure checked, run in ComfyUI, result assessed) with who stands behind each, and the
 * card "About this lesson" with the metadata of the lesson template.
 *
 * Who uses it: LessonPanel.tsx (the list and the end of a lesson).
 *
 * Why the outcomes say who checked: the app checks the graph; a run in ComfyUI is the person's tick unless the app
 * could read it; an assessment is always the person's own. A finished lesson never claims more than that.
 */

import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, CircleCheck, CircleDashed, UserCheck } from 'lucide-react';
import type { Lesson } from '../../../shared/lessons/engine';
import { outcomesOf } from '../../../shared/lessons/engine';
import { LESSON_TRACKS, lessonPlace, type LessonTrack } from '../../../shared/lessons/programme';
import type { LessonOutcome, OutcomeState } from '../../../shared/lessons/steps';
import type { LessonWords } from '../../../shared/lessons/texts';
import Segmented from '../../ui/Segmented';
import SelectField from '../../ui/SelectField';
import styles from './LessonViews.module.css';

/** How the list is read. */
export type LessonView = 'groups' | 'levels' | 'tracks' | 'path';

/** The catalog key of a track (a key cannot hold a hyphen there). */
export function trackKey(track: LessonTrack): string {
  return track.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

/** The choice of the view, and of the track for the views of one track. */
export function ViewBar({ view, track, onView, onTrack }: { view: LessonView; track: LessonTrack; onView: (view: LessonView) => void; onTrack: (track: LessonTrack) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.bar} data-lesson-view={view}>
      <Segmented
        label={String(t('lessons.view.label'))}
        value={view}
        options={(['groups', 'levels', 'tracks', 'path'] as const).map((value) => ({ value, label: String(t(`lessons.view.${value}`)) }))}
        onChange={(value) => onView(value)}
      />
      {view === 'tracks' || view === 'path' ? (
        <SelectField
          id={`${id}-track`}
          label={String(t('lessons.view.track'))}
          value={track}
          options={LESSON_TRACKS.map((value) => ({ value, label: String(t(`lessons.track.${trackKey(value)}`)) }))}
          onChange={(value) => onTrack(value as LessonTrack)}
        />
      ) : null}
    </div>
  );
}

/** "Level 2 · Core" and the tracks, under a card's title. Nothing for a lesson the programme does not know. */
export function PlaceLine({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation();
  const place = lessonPlace(lessonId);
  if (!place) return null;
  const tracks = place.tracks.map((track) => String(t(`lessons.track.${trackKey(track)}`))).join(', ');
  return (
    <p className={styles.place} data-lesson-level={place.level}>
      {t('lessons.place', { level: place.level, priority: t(`lessons.priority.${place.priority}`), tracks })}
    </p>
  );
}

/** The icon of an outcome's state. */
function StateIcon({ state }: { state: OutcomeState }) {
  if (state === 'app') return <CircleCheck className={styles.ok} size={12} aria-hidden="true" />;
  if (state === 'self') return <UserCheck className={styles.self} size={12} aria-hidden="true" />;
  return <CircleDashed className={styles.faint} size={12} aria-hidden="true" />;
}

/** The outcomes reached, as kept in the lesson state, for a card in the list. */
export function storedStates(lesson: Lesson, stored: readonly string[] | undefined): Array<{ outcome: LessonOutcome; state: OutcomeState }> {
  const have = new Set(stored ?? []);
  return outcomesOf(lesson).map((outcome) => {
    if (outcome === 'structure') return { outcome, state: have.has('structure') ? 'app' : 'open' };
    if (outcome === 'run') return { outcome, state: have.has('run-app') ? 'app' : have.has('run-self') ? 'self' : 'open' };
    return { outcome, state: have.has('result') ? 'self' : 'open' };
  });
}

/** The outcomes as the lesson state keeps them. */
export function storedOutcomes(states: ReadonlyArray<{ outcome: LessonOutcome; state: OutcomeState }>): Array<'structure' | 'run-app' | 'run-self' | 'result'> {
  return states.flatMap(({ outcome, state }) => {
    if (state === 'open') return [];
    if (outcome === 'run') return [state === 'app' ? 'run-app' as const : 'run-self' as const];
    return [outcome];
  });
}

/**
 * The outcomes of a lesson as a small row of marks: for a card, only when the lesson has more than "structure
 * checked" (an old lesson looks as before); at the end of a lesson, always, with who stands behind each.
 */
export function OutcomeMarks({ states, full }: { states: ReadonlyArray<{ outcome: LessonOutcome; state: OutcomeState }>; full?: boolean }) {
  const { t } = useTranslation();
  if (!full && states.length < 2) return null;
  return (
    <ul className={full ? styles.outcomesFull : styles.outcomes} aria-label={String(t('lessons.outcome.label'))}>
      {states.map(({ outcome, state }) => (
        <li key={outcome} data-outcome={outcome} data-outcome-state={state}>
          <StateIcon state={state} />
          <span>{t(`lessons.outcome.${outcome}`)}</span>
          {full || state !== 'open' ? <span className={styles.by}>{t(`lessons.outcome.by.${state}`)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** "About this lesson": the target skill, what it needs, the versions and date, expected mistakes, source, limits. */
export function AboutLesson({ lesson, words }: { lesson: Lesson; words: LessonWords }) {
  const { t } = useTranslation();
  const meta = words.meta;
  if (!meta && !lesson.meta) return null;
  return (
    <details className={styles.about} data-lesson-about={lesson.id}>
      <summary className={styles.aboutSummary}>
        <ChevronRight size={12} aria-hidden="true" />
        {t('lessons.about.title')}
      </summary>
      <dl className={styles.aboutList}>
        {meta?.skill ? (<><dt>{t('lessons.about.skill')}</dt><dd>{meta.skill}</dd></>) : null}
        {meta?.requires?.length ? (<><dt>{t('lessons.about.requires')}</dt><dd><ul>{meta.requires.map((item) => <li key={item}>{item}</li>)}</ul></dd></>) : null}
        {lesson.meta?.versions?.length ? (
          <><dt>{t('lessons.about.versions')}</dt><dd>{lesson.meta.versions.join('; ')}{lesson.meta.checkedOn ? ` (${t('lessons.about.checkedOn', { date: lesson.meta.checkedOn })})` : ''}</dd></>
        ) : null}
        {meta?.mistakes?.length ? (
          <>
            <dt>{t('lessons.about.mistakes')}</dt>
            <dd>
              <ul>
                {meta.mistakes.map((item) => (
                  <li key={item.sign}>{item.sign} <span className={styles.fix}>{t('lessons.about.fix')} {item.fix}</span></li>
                ))}
              </ul>
            </dd>
          </>
        ) : null}
        {meta?.notChecked ? (<><dt>{t('lessons.about.notChecked')}</dt><dd>{meta.notChecked}</dd></>) : null}
        {meta?.provenance ? (<><dt>{t('lessons.about.provenance')}</dt><dd>{meta.provenance}</dd></>) : null}
      </dl>
    </details>
  );
}
