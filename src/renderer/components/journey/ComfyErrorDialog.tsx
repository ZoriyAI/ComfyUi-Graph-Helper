/**
 * "Explain a ComfyUI error": the way back from ComfyUI when a run fails.
 *
 * Who uses it: a person whose graph ComfyUI refused or broke on; it opens from the Help menu command
 * help.comfyError (commands/appCommands.ts) and from the "Run it in ComfyUI" card. Why: the red text of ComfyUI
 * is English jargon with node numbers. The person pastes it; the app explains every message it knows with the
 * built-in notes (knowledge/sets/foundations.ts comfyErrorNotes, no assistant needed), lists the nodes it names (shared/journey/comfyError.ts) with "Show on the
 * canvas", and offers the assistant for anything else. The text is read here only; it is sent to the assistant only
 * when the person presses "Ask the assistant".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, MessageCircleQuestion } from 'lucide-react';
import Button from '../../ui/Button';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../ui/Dialog';
import { useJourneyStore } from '../../state/journeyState';
import { useGraphStore } from '../../state/graphState';
import { useDockStore } from '../../state/dockState';
import { useCanvasStore } from '../graph/canvasStore';
import { selectOnLevel } from '../graph/lib/level';
import { nodeDisplayName } from '../graph/lib/nodeName';
import { getChatService } from '../../services/llm/chatService';
import { comfyErrorNotes } from '../../../shared/knowledge/sets/foundations';
import { errorNodeRefs } from '../../../shared/journey/comfyError';
import styles from './Journey.module.css';

/** The error card; JourneyHost.tsx mounts it, journeyState's dialog 'error' opens it. */
export default function ComfyErrorDialog() {
  const { t, i18n } = useTranslation();
  const open = useJourneyStore((state) => state.dialog === 'error');
  const start = useJourneyStore((state) => state.errorText);
  const close = useJourneyStore((state) => state.close);
  const nodes = useGraphStore((state) => state.nodes);
  const [text, setText] = useState('');
  const [explained, setExplained] = useState('');
  // Each opening starts from the text the store holds (the last one, or one passed to open()), already explained.
  useEffect(() => {
    if (open) {
      setText(start);
      setExplained(start);
    }
  }, [open, start]);
  const notes = useMemo(() => (explained.trim() ? comfyErrorNotes(explained, i18n.language) : []), [explained, i18n.language]);
  const refs = useMemo(() => (explained.trim() ? errorNodeRefs(explained) : []), [explained]);
  // A number names one node; a class names every node of it on the canvas.
  const found = refs.map((ref) => {
    const matches = nodes.filter((node) => (ref.id ? node.id === ref.id : node.data?.comfyType === ref.classType));
    return { ref, matches };
  });
  const show = (ids: string[]) => {
    if (ids.length === 0) return;
    close();
    selectOnLevel(ids);
    useCanvasStore.getState().requestCenter(ids[0]);
  };
  const ask = () => {
    close();
    useDockStore.getState().show('assistant');
    // 4000 characters hold the messages that matter; a whole traceback would crowd the model's window.
    void getChatService().sendMessage(String(t('journey.error.askMessage', { text: explained.trim().slice(0, 4000) })));
  };
  return (
    <DialogRoot open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={`${styles.dialog} journey-error-dialog`} aria-describedby="journey-error-lead">
          <header className={styles.header}>
            <DialogTitle className={styles.title}>{t('journey.error.title')}</DialogTitle>
            <DialogDescription id="journey-error-lead" className={styles.lead}>{t('journey.error.lead')}</DialogDescription>
          </header>
          <div className={styles.body}>
            <label className={styles.label} htmlFor="journey-error-text">{t('journey.error.field')}</label>
            <textarea
              id="journey-error-text"
              className={styles.field}
              value={text}
              placeholder={String(t('journey.error.placeholder'))}
              spellCheck={false}
              onChange={(event) => setText(event.target.value)}
            />
            <span className={styles.row}>
              <Button size="sm" variant="primary" disabled={!text.trim()} onClick={() => setExplained(text)}>{t('journey.error.explain')}</Button>
            </span>
            {explained.trim() ? (
              <div role="status" className={styles.stepText} data-error-result="">
                {found.length > 0 ? (
                  <>
                    <span className={styles.label}>{t('journey.error.nodes')}</span>
                    {found.map(({ ref, matches }) => {
                      const label = matches[0] ? nodeDisplayName(matches[0].data) : (ref.classType ?? `#${ref.id}`);
                      return (
                        <span key={`${ref.id}-${ref.classType}`} className={styles.nodeRow} data-error-node={ref.id ?? ref.classType ?? ''}>
                          <span>{matches.length > 0 ? `${label}${ref.id ? ` #${ref.id}` : ''}` : t('journey.error.notOnCanvas', { name: ref.classType ?? `#${ref.id}` })}</span>
                          {matches.length > 0 ? <Button size="sm" variant="subtle" icon={<Crosshair size={14} aria-hidden="true" />} onClick={() => show(matches.map((node) => node.id))}>{t('journey.error.show')}</Button> : null}
                        </span>
                      );
                    })}
                  </>
                ) : null}
                {notes.length > 0 ? (
                  <ul className={styles.notes} aria-label={String(t('journey.error.notesTitle'))}>
                    {notes.map((note) => (
                      <li key={note.id} className={styles.noteItem} data-error-note={note.id}>
                        <span className={styles.noteTitle}>{note.title}</span>
                        <span>{note.meaning}</span>
                        <span><strong>{t('journey.error.fix')}:</strong> {note.fix}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.note}>{t('journey.error.unknown')}</p>}
              </div>
            ) : null}
          </div>
          <footer className={styles.footer}>
            <Button size="sm" variant="subtle" quiet icon={<MessageCircleQuestion size={14} aria-hidden="true" />} disabled={!explained.trim()} onClick={ask}>{t('journey.error.ask')}</Button>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{t('journey.error.close')}</Button>
            </DialogClose>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
