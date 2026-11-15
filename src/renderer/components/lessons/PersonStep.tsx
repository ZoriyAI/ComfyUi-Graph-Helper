/**
 * The steps of a lesson the person answers in the panel (shared/lessons/steps.ts): a checklist of things done outside
 * the app, a rubric to assess a result, a short quiz, and a read-check the app answers from what it already knows.
 * Each answer goes to the lesson state (state/lessonState.ts) and is kept with the lesson's progress.
 *
 * Who uses it: LessonPanel.tsx draws one of these in place of "Still to do" when the step is of such a kind.
 *
 * Why every line says who answered: the app never runs anything in ComfyUI and never sees a picture. An item the app
 * checked says so; an item the person ticked is their own word; a rubric records a choice and says the app does not
 * judge the picture. A wrong quiz answer costs nothing: the explanation shows and the lesson goes on.
 */

import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleDashed, CircleQuestionMark, CircleX, Eraser, UserCheck } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { LessonGraph, LessonStep } from '../../../shared/lessons/engine';
import { SELF_CHECK, TICK, criterionPasses, itemState, readVerdict, type ReadCondition, type ReadFacts, type ReadVerdict, type StepAnswers } from '../../../shared/lessons/steps';
import type { StepWords } from '../../../shared/lessons/texts';
import Button from '../../ui/Button';
import radio from '../../ui/RadioMark.module.css';
import styles from './PersonStep.module.css';

/** What every person step needs from the panel. */
export interface PersonStepProps {
  step: LessonStep;
  words: StepWords;
  answers: StepAnswers;
  graph: LessonGraph;
  facts: ReadFacts | undefined;
  /** Sets one answer, or takes it back with null. */
  onAnswer: (itemId: string, value: string | null) => void;
  /** Clears every answer of the step. */
  onClear: () => void;
}

/** The sentence of one read-check condition, in the person's language. */
export function conditionText(t: TFunction, condition: ReadCondition): string {
  switch (condition.kind) {
    case 'comfy-read':
      return String(t('lessons.person.condition.comfyRead'));
    case 'node-class':
      return String(t('lessons.person.condition.nodeClass', { names: condition.classes.join(', ') }));
    case 'model-file':
      return condition.words?.length
        ? String(t('lessons.person.condition.modelFileWords', { folder: condition.folder, words: condition.words.join(', ') }))
        : String(t('lessons.person.condition.modelFile', { folder: condition.folder }));
    case 'workflow-complete':
      return String(t('lessons.person.condition.workflowComplete'));
    case 'workflow-size':
      if (condition.min !== undefined && condition.max !== undefined) return String(t('lessons.person.condition.workflowSizeRange', { min: condition.min, max: condition.max }));
      if (condition.max !== undefined) return String(t('lessons.person.condition.workflowSizeMax', { max: condition.max }));
      return String(t('lessons.person.condition.workflowSizeMin', { min: condition.min ?? 0 }));
    case 'workflow-from':
      return String(t(condition.from === 'picture' ? 'lessons.person.condition.workflowFromPicture' : 'lessons.person.condition.workflowFromApi'));
    case 'workflow-partner':
      return String(t(condition.present ? 'lessons.person.condition.workflowPartnerYes' : 'lessons.person.condition.workflowPartnerNo'));
  }
}

/** The icon of a verdict: held, failed, or not known now. */
function VerdictIcon({ verdict }: { verdict: ReadVerdict }) {
  if (verdict === 'holds') return <CircleCheck className={styles.ok} size={14} aria-hidden="true" />;
  if (verdict === 'fails') return <CircleX className={styles.bad} size={14} aria-hidden="true" />;
  return <CircleQuestionMark className={styles.faint} size={14} aria-hidden="true" />;
}

/** A checklist: each item ticked by the person or checked by the app. */
function Checklist({ step, words, answers, graph, facts, onAnswer }: PersonStepProps) {
  const { t } = useTranslation();
  const ids = useId();
  return (
    <ul className={styles.items} data-person-step="checklist">
      {(step.checklist ?? []).map((item) => {
        const text = words.items?.[item.id];
        const state = itemState(item, answers[item.id], graph, facts);
        // An item the app sees as done, or sees as not done, is not the person's to tick.
        const locked = state.verdict === 'holds' || state.verdict === 'fails';
        const note = state.by === 'app'
          ? t('lessons.person.byApp')
          : state.verdict === 'fails'
            ? t('lessons.person.notYet')
            : state.verdict === 'unknown'
              ? t('lessons.person.unknownTick')
              : state.by === 'self' ? t('lessons.person.ownWord') : null;
        return (
          <li key={item.id} className={styles.item} data-item={item.id} data-item-state={state.done ? state.by : state.verdict === 'fails' ? 'fails' : 'open'}>
            <label className={styles.tick} htmlFor={`${ids}-${item.id}`}>
              <input
                id={`${ids}-${item.id}`}
                type="checkbox"
                checked={state.done}
                disabled={locked}
                onChange={(event) => onAnswer(item.id, event.target.checked ? TICK : null)}
              />
              <span>{text?.label ?? item.id}{item.optional ? <span className={styles.faint}> {t('lessons.person.optional')}</span> : null}</span>
            </label>
            {text?.how ? <p className={styles.how}>{t('lessons.person.how')} {text.how}</p> : null}
            {note ? (
              <p className={styles.note}>
                {item.check ? <VerdictIcon verdict={state.verdict ?? 'unknown'} /> : <UserCheck className={styles.faint} size={14} aria-hidden="true" />}
                {note}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** A rubric: one level per criterion, and what to try when the level is low. */
function Rubric({ step, words, answers, onAnswer }: PersonStepProps) {
  const { t } = useTranslation();
  const ids = useId();
  return (
    <div className={styles.group} data-person-step="rubric">
      <p className={styles.notice} role="note">{t('lessons.person.rubricNote')}</p>
      {(step.rubric ?? []).map((criterion) => {
        const text = words.criteria?.[criterion.id];
        const chosen = answers[criterion.id];
        const top = criterion.levels[criterion.levels.length - 1];
        const low = chosen !== undefined && chosen !== top;
        const passes = criterionPasses(criterion, chosen);
        return (
          <fieldset key={criterion.id} className={styles.question} data-criterion={criterion.id}>
            <legend className={styles.legend}>{text?.title ?? criterion.id}</legend>
            <div className={styles.choices}>
              {criterion.levels.map((level) => (
                <label key={level} className={styles.choice} htmlFor={`${ids}-${criterion.id}-${level}`}>
                  <input
                    id={`${ids}-${criterion.id}-${level}`}
                    className={radio.input}
                    type="radio"
                    name={`${ids}-${criterion.id}`}
                    checked={chosen === level}
                    onChange={() => onAnswer(criterion.id, level)}
                  />
                  <span>{text?.levels[level] ?? level}</span>
                </label>
              ))}
            </div>
            {low && text?.tryNext ? <p className={styles.how}><strong>{t('lessons.person.tryNext')}</strong> {text.tryNext}</p> : null}
            {chosen !== undefined && !passes && criterion.pass ? (
              <p className={styles.note}><CircleDashed className={styles.faint} size={14} aria-hidden="true" />{t('lessons.person.passNeeded', { level: text?.levels[criterion.pass] ?? criterion.pass })}</p>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}

/** A quiz: a choice per question, then whether it was right and why. */
function Quiz({ step, words, answers, onAnswer }: PersonStepProps) {
  const { t } = useTranslation();
  const ids = useId();
  return (
    <div className={styles.group} data-person-step="quiz">
      {(step.quiz ?? []).map((question) => {
        const text = words.questions?.[question.id];
        const chosen = answers[question.id];
        const answered = chosen !== undefined && question.choices.includes(chosen);
        const right = chosen === question.answer;
        return (
          <fieldset key={question.id} className={styles.question} data-question={question.id} data-answered={answered ? (right ? 'right' : 'wrong') : undefined}>
            <legend className={styles.legend}>{text?.text ?? question.id}</legend>
            <div className={styles.choicesColumn}>
              {question.choices.map((choice) => (
                <label key={choice} className={styles.choice} htmlFor={`${ids}-${question.id}-${choice}`}>
                  <input
                    id={`${ids}-${question.id}-${choice}`}
                    className={radio.input}
                    type="radio"
                    name={`${ids}-${question.id}`}
                    checked={chosen === choice}
                    onChange={() => onAnswer(question.id, choice)}
                  />
                  <span>{text?.choices[choice] ?? choice}</span>
                </label>
              ))}
            </div>
            {answered ? (
              <p className={styles.explain} role="status">
                {right ? <CircleCheck className={styles.ok} size={14} aria-hidden="true" /> : <CircleQuestionMark className={styles.faint} size={14} aria-hidden="true" />}
                <span>
                  <strong>{right ? t('lessons.person.right') : t('lessons.person.notQuite', { answer: text?.choices[question.answer] ?? question.answer })}</strong>{' '}
                  {text?.explain}
                </span>
              </p>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}

/** A read-check: the conditions with what the app sees, and "I will check it myself" while it cannot tell. */
function ReadCheck({ step, answers, graph, facts, onAnswer }: PersonStepProps) {
  const { t } = useTranslation();
  const verdicts = (step.readCheck ?? []).map((condition) => ({ condition, verdict: readVerdict(condition, graph, facts) }));
  const self = answers[SELF_CHECK] === TICK;
  const unknown = verdicts.some((item) => item.verdict === 'unknown');
  const fails = verdicts.some((item) => item.verdict === 'fails');
  return (
    <div className={styles.group} data-person-step="read-check">
      <ul className={styles.items}>
        {verdicts.map(({ condition, verdict }, index) => (
          <li key={index} className={styles.item} data-condition={condition.kind} data-verdict={verdict}>
            <p className={styles.note}>
              <VerdictIcon verdict={verdict} />
              <span>
                {conditionText(t, condition)}{' '}
                <span className={styles.faint}>{verdict === 'holds' ? t('lessons.person.byApp') : verdict === 'fails' ? t('lessons.person.notYet') : t('lessons.person.cannotTell')}</span>
              </span>
            </p>
          </li>
        ))}
      </ul>
      {unknown && !fails && !self ? (
        <div className={styles.actions}>
          <p className={styles.how}>{t('lessons.person.selfCheckHint')}</p>
          <Button variant="subtle" size="sm" icon={<UserCheck size={14} />} onClick={() => onAnswer(SELF_CHECK, TICK)}>{t('lessons.person.selfCheck')}</Button>
        </div>
      ) : null}
      {self && unknown ? <p className={styles.note}><UserCheck className={styles.faint} size={14} aria-hidden="true" />{t('lessons.person.selfChecked')}</p> : null}
    </div>
  );
}

/** One step the person answers, with "Clear my answers" once there is something to clear. */
export default function PersonStep(props: PersonStepProps) {
  const { t } = useTranslation();
  const { step } = props;
  const any = Object.keys(props.answers).length > 0;
  return (
    <div className={styles.step}>
      {step.checklist ? <Checklist {...props} /> : step.rubric ? <Rubric {...props} /> : step.quiz ? <Quiz {...props} /> : step.readCheck ? <ReadCheck {...props} /> : null}
      {any && !step.readCheck ? (
        <Button variant="ghost" size="sm" className={styles.clear} icon={<Eraser size={14} />} onClick={props.onClear}>{t('lessons.person.clear')}</Button>
      ) : null}
    </div>
  );
}
