/**
 * The lesson editor inside the Lessons panel: the lesson proposed from the graph (or one of "My lessons" being
 * changed), with its title, what the person ends up with, the language of the texts, the 18+ flag, and for each
 * step its title, its words and which values matter. "Try the lesson" plays it from an empty canvas and says which
 * step cannot be done; "Save to My lessons" tries it again in main and keeps it.
 *
 * Who uses it: LessonPanel.tsx shows it in place of the list while useMyLessonsStore().editing is set.
 *
 * Why so plain: one column of ui primitives that fits a narrow panel; one glowing primary (Save); every other
 * action is subtle or an icon. The checks of a step are shown as sentences, not edited: they come from the graph.
 */

import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowLeft, ArrowUp, Check, FlaskConical, Save, Trash2 } from 'lucide-react';
import type { FieldSpec, LinkSpec } from '../../../shared/lessons/engine';
import type { LessonDraftModel } from '../../../shared/lessons/share/authoring';
import type { LessonCheck } from '../../../shared/lessons/share/mine';
import { useMyLessonsStore, type EditorState } from '../../state/myLessonsState';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import Segmented from '../../ui/Segmented';
import Switch from '../../ui/Switch';
import { useNodeInfoStore } from '../graph/nodeInfo';
import { refusalText, problemText, triedText } from './lessonFiles';
import { saveEditorLesson, tryEditorLesson } from './lessonAuthoring';
import panel from './LessonPanel.module.css';
import styles from './LessonEditor.module.css';

/** The verdict shown under the actions: a sentence and whether it is good news. */
type Verdict = { ok: boolean; text: string } | null;

/** The sentence for the result of trying a lesson. */
function verdictOf(t: (key: string, values?: Record<string, unknown>) => string, check: LessonCheck, language: string): Verdict {
  if (check.ok) return { ok: true, text: t('lessonFiles.editor.triedOk') };
  return { ok: false, text: 'problem' in check ? problemText(t, check.problem) : triedText(t, check.tried, language) };
}

/** A field check in words (any value, equals, between, at least some characters). */
function ruleText(t: (key: string, values?: Record<string, unknown>) => string, spec: FieldSpec): string {
  const test = spec.test;
  if (test.kind === 'chosen') return t('lessonFiles.editor.ruleChosen');
  if (test.kind === 'equals') return t('lessonFiles.editor.ruleEquals', { value: String(test.value).slice(0, 80) });
  if (test.kind === 'between') return t('lessonFiles.editor.ruleBetween', { min: test.min, max: test.max });
  if (test.kind === 'text') return t('lessonFiles.editor.ruleText', { min: test.minChars });
  return t('lessonFiles.editor.ruleOther');
}

/**
 * The editor of one lesson model. Every change goes back to the store, so the draft survives the panel closing
 * (but not a restart).
 */
export default function LessonEditor({ editing }: { editing: EditorState }) {
  const { t, i18n } = useTranslation();
  const tr = (key: string, values?: Record<string, unknown>) => String(values ? t(key, values) : t(key));
  const setEditing = useMyLessonsStore((state) => state.setEditing);
  const details = useNodeInfoStore((state) => state.details);
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [busy, setBusy] = useState(false);
  const ids = useId();
  const { model, replaces } = editing;
  // A role's name for the checks: the catalog display name of the first class that fills it.
  const nameOfRole = (role: string) => {
    for (const step of model.steps) {
      const spec = step.roles.find((item) => item.role === role);
      if (spec) return details[spec.classes[0]]?.displayName || spec.classes[0];
    }
    return role;
  };

  const update = (change: Partial<LessonDraftModel>) => {
    setVerdict(null);
    setEditing({ model: { ...model, ...change }, replaces });
  };
  const updateStep = (index: number, change: Partial<LessonDraftModel['steps'][number]>) => {
    update({ steps: model.steps.map((step, at) => (at === index ? { ...step, ...change } : step)) });
  };
  const move = (index: number, by: number) => {
    const steps = [...model.steps];
    const [step] = steps.splice(index, 1);
    steps.splice(index + by, 0, step);
    update({ steps });
  };

  /** What the person must fill before a try means anything. */
  const missing = (): string | null => {
    if (!model.title.trim()) return tr('lessonFiles.editor.needTitle');
    if (model.steps.some((step) => !step.title.trim())) return tr('lessonFiles.editor.needStepTitle');
    return null;
  };
  const tryIt = () => {
    const need = missing();
    setVerdict(need ? { ok: false, text: need } : verdictOf(tr, tryEditorLesson(model, replaces), i18n.language));
  };
  const save = async () => {
    const need = missing();
    if (need) {
      setVerdict({ ok: false, text: need });
      return;
    }
    const check = tryEditorLesson(model, replaces);
    if (!check.ok) {
      setVerdict(verdictOf(tr, check, i18n.language));
      return;
    }
    setBusy(true);
    try {
      const outcome = await saveEditorLesson(model, replaces);
      const refusal = refusalText(tr, outcome, i18n.language);
      if (refusal) setVerdict({ ok: false, text: refusal });
    } finally {
      setBusy(false);
    }
  };

  const linkText = (link: LinkSpec) => tr('lessonFiles.editor.checkLink', { output: link.output, from: nameOfRole(link.from), input: link.input, to: nameOfRole(link.to) });

  return (
    <div className={panel.list} data-lesson-editor={replaces ?? 'new'}>
      <header className={panel.topRow}>
        <IconButton size="sm" label={tr('lessonFiles.editor.cancel')} onClick={() => setEditing(null)}>
          <ArrowLeft size={16} aria-hidden="true" />
        </IconButton>
        <h3 className={panel.lessonTitle}>{replaces ? t('lessonFiles.editor.headingEdit') : t('lessonFiles.editor.heading')}</h3>
      </header>
      <p className={panel.intro}>{t('lessonFiles.editor.intro')}</p>

      <div className={styles.form}>
        <label className={styles.label} htmlFor={`${ids}-title`}>{t('lessonFiles.editor.lessonTitle')}</label>
        <input id={`${ids}-title`} className={styles.field} value={model.title} maxLength={200} onChange={(event) => update({ title: event.target.value })} />
        <label className={styles.label} htmlFor={`${ids}-result`}>{t('lessonFiles.editor.result')}</label>
        <input id={`${ids}-result`} className={styles.field} value={model.result} maxLength={600} onChange={(event) => update({ result: event.target.value })} />
        <Segmented
          label={tr('lessonFiles.editor.language')}
          value={model.language}
          options={[{ value: 'en', label: tr('lessonFiles.editor.english') }, { value: 'ru', label: tr('lessonFiles.editor.russian') }]}
          onChange={(value) => update({ language: value === 'ru' ? 'ru' : 'en' })}
        />
        <Switch label={t('lessonFiles.editor.adult')} checked={model.adult} onCheckedChange={(checked) => update({ adult: checked === true })} />
      </div>

      <ol className={styles.steps}>
        {model.steps.map((step, index) => (
          <li key={step.id} className={panel.card} data-editor-step={step.id}>
            <div className={panel.cardHead}>
              <span className={panel.cardTitle}>{t('lessonFiles.editor.stepNumber', { number: index + 1 })}</span>
              <span className={styles.tools}>
                <IconButton size="sm" label={tr('lessonFiles.editor.moveUp')} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} aria-hidden="true" /></IconButton>
                <IconButton size="sm" label={tr('lessonFiles.editor.moveDown')} disabled={index === model.steps.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} aria-hidden="true" /></IconButton>
                <IconButton size="sm" label={tr('lessonFiles.editor.removeStep')} disabled={model.steps.length <= 2} onClick={() => update({ steps: model.steps.filter((_item, at) => at !== index) })}><Trash2 size={14} aria-hidden="true" /></IconButton>
              </span>
            </div>
            {step.read ? <p className={panel.cardMeta}>{t('lessonFiles.editor.stepRead')}</p> : null}
            <label className={styles.label} htmlFor={`${ids}-${step.id}-title`}>{t('lessonFiles.editor.stepTitle')}</label>
            <input id={`${ids}-${step.id}-title`} className={styles.field} value={step.title} maxLength={200} onChange={(event) => updateStep(index, { title: event.target.value })} />
            <label className={styles.label} htmlFor={`${ids}-${step.id}-body`}>{t('lessonFiles.editor.stepBody')}</label>
            <textarea id={`${ids}-${step.id}-body`} className={styles.field} value={step.body} maxLength={8000} rows={4} onChange={(event) => updateStep(index, { body: event.target.value })} />
            {step.roles.length > 0 || step.links.length > 0 ? (
              <ul className={styles.checks}>
                {step.roles.map((spec) => <li key={spec.role}>{t('lessonFiles.editor.checkNode', { name: nameOfRole(spec.role) })}</li>)}
                {step.links.map((link) => <li key={`${link.from}-${link.output}-${link.input}`}>{linkText(link)}</li>)}
              </ul>
            ) : null}
            {step.fields.length > 0 ? (
              <ul className={styles.values}>
                {step.fields.map((item, at) => (
                  <li key={`${item.spec.field}-${at}`}>
                    <label className={styles.value}>
                      <input
                        type="checkbox"
                        checked={item.on}
                        aria-label={`${tr('lessonFiles.editor.valueMatters')}: ${item.spec.field}`}
                        onChange={(event) => updateStep(index, { fields: step.fields.map((field, which) => (which === at ? { ...field, on: event.target.checked } : field)) })}
                      />
                      <span>{tr('lessonFiles.editor.checkField', { field: item.spec.field, node: nameOfRole(item.spec.role), rule: ruleText(tr, item.spec) })}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      <div className={panel.actions}>
        <Button variant="subtle" size="sm" icon={<FlaskConical size={14} />} onClick={tryIt}>{t('lessonFiles.editor.tryIt')}</Button>
        <Button variant="primary" size="sm" icon={<Save size={14} />} loading={busy} onClick={() => void save()}>{t('lessonFiles.editor.save')}</Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>{t('lessonFiles.editor.cancel')}</Button>
      </div>
      {verdict ? (
        <p className={verdict.ok ? styles.ok : styles.bad} role="status" data-editor-verdict={verdict.ok ? 'ok' : 'bad'}>
          {verdict.ok ? <Check size={14} aria-hidden="true" /> : null} {verdict.text}
        </p>
      ) : null}
    </div>
  );
}
