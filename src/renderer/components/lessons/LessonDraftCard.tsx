/**
 * The card of a lesson the assistant drafted (the draftLesson tool), in the chat: its title, what the person ends
 * up with, how many steps, how it was tried, the mark "drafted by the assistant, check it before you share", and
 * two buttons: keep it in My lessons, or discard it. Like grey drafts on the canvas, nothing is kept until the
 * person says so.
 *
 * Who uses it: the chat's ToolCard, for a successful draftLesson call. Why it asks main for the draft: the chat
 * keeps only the draft's id, so a card from before a restart says the draft is gone instead of showing stale text.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, GraduationCap, X } from 'lucide-react';
import { docWords } from '../../../shared/lessons/share/format';
import type { LessonDraft } from '../../../shared/lessons/share/mine';
import { useMyLessonsStore } from '../../state/myLessonsState';
import { openHelp } from '../../services/help';
import Badge from '../../ui/Badge';
import Button from '../../ui/Button';
import { refusalText } from './lessonFiles';
import styles from './MyLessons.module.css';
import panel from './LessonPanel.module.css';

type State = { kind: 'loading' } | { kind: 'open'; draft: LessonDraft } | { kind: 'gone' } | { kind: 'kept' } | { kind: 'discarded' };

export default function LessonDraftCard({ draftId }: { draftId: string }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void (window.electronAPI?.lessonDraft?.(draftId) ?? Promise.resolve(null)).catch(() => null).then((draft) => {
      if (live) setState(draft ? { kind: 'open', draft } : { kind: 'gone' });
    });
    return () => {
      live = false;
    };
  }, [draftId]);

  const resolve = async (accept: boolean) => {
    const bridge = window.electronAPI;
    if (!bridge?.resolveLessonDraft) return;
    setBusy(true);
    try {
      const outcome = await bridge.resolveLessonDraft(draftId, accept);
      if (outcome.ok && 'rejected' in outcome) setState({ kind: 'discarded' });
      else if (outcome.ok) {
        setState({ kind: 'kept' });
        await useMyLessonsStore.getState().refresh();
      } else if ('gone' in outcome) setState({ kind: 'gone' });
      else setError(refusalText((key: string, values?: Record<string, unknown>) => String(values ? t(key, values) : t(key)), outcome, i18n.language));
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === 'loading') return null;
  const head = (
    <div className={panel.cardHead}>
      <GraduationCap size={14} aria-hidden="true" />
      <span className={panel.cardTitle}>{t('lessonFiles.draft.title')}</span>
    </div>
  );
  if (state.kind !== 'open') {
    const line = state.kind === 'kept' ? t('lessonFiles.draft.accepted') : state.kind === 'discarded' ? t('lessonFiles.draft.rejected') : t('lessonFiles.draft.gone');
    return <div className={styles.notice} data-lesson-draft={draftId} data-lesson-draft-state={state.kind}>{head}<p className={panel.cardMeta}>{line}</p></div>;
  }
  const { draft } = state;
  const words = docWords(draft.doc, i18n.language);
  return (
    <div className={styles.notice} data-lesson-draft={draftId} data-lesson-draft-state="open">
      {head}
      <p className={panel.cardText}><strong>{words.title}</strong></p>
      {words.result ? <p className={panel.cardText}>{words.result}</p> : null}
      <div className={styles.badges}>
        <Badge tone="ai">{t('lessonFiles.originAssistant')}</Badge>
        {draft.doc.adult ? <Badge tone="warn">18+</Badge> : null}
        <Badge tone="neutral">{t('lessonFiles.draft.steps', { count: draft.doc.steps.length })}</Badge>
      </div>
      <p className={styles.warn}>{t('lessonFiles.assistantWarn')}</p>
      <p className={panel.cardMeta}>{draft.triedWith === 'catalog' ? t('lessonFiles.draft.triedCatalog') : t('lessonFiles.draft.triedLesson')}</p>
      <p className={panel.cardMeta}>
        {t('lessonFiles.rules')}{' '}
        <Button variant="ghost" size="sm" className={styles.inline} icon={<BookOpen size={14} />} onClick={() => openHelp('content-rules')}>{t('lessonFiles.rulesOpen')}</Button>
      </p>
      <div className={panel.cardActions}>
        <Button variant="subtle" size="sm" icon={<Check size={14} />} loading={busy} onClick={() => void resolve(true)}>{t('lessonFiles.draft.accept')}</Button>
        <Button variant="ghost" size="sm" icon={<X size={14} />} disabled={busy} onClick={() => void resolve(false)}>{t('lessonFiles.draft.reject')}</Button>
      </div>
      {error ? <p className={styles.warn} role="status">{error}</p> : null}
    </div>
  );
}
