/**
 * The text of a Note or Markdown Note on its card. A person reads it in place and, where the canvas can be edited,
 * writes it: a double click or Enter opens the box, Ctrl+Enter or leaving the box saves, Escape keeps the old text.
 * Saving sends `set-note-text` (main/commands/editOps.ts), one undo step, and the text goes into the workflow file
 * where ComfyUI reads it (widgets_values[0]).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { commitManual } from '../commit';
import styles from './Node.module.css';

interface NoteTextProps {
  nodeId: string;
  text: string;
  /** False on a ghost, in a replay and on a locked node: the text is shown, not edited. */
  editable: boolean;
  /** How the text is drawn while not being written (a Markdown Note draws its formatting); the plain text otherwise. */
  display?: React.ReactNode;
}

export default function NoteText({ nodeId, text, editable, display }: NoteTextProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);
  useEffect(() => {
    if (editing) box.current?.focus();
  }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft !== text) void commitManual({ type: 'set-note-text', nodeId, text: draft });
  };

  if (editing) {
    return (
      <textarea
        ref={box}
        className={`${styles.noteText} ${styles.noteEditor} nowheel nodrag`}
        aria-label={String(t('editing.noteLabel'))}
        placeholder={String(t('editing.notePlaceholder'))}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          // Keys stay in the box: the canvas must not take Delete or arrows from a note being written.
          event.stopPropagation();
          if (event.key === 'Escape') {
            setDraft(text);
            setEditing(false);
          } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
          }
        }}
      />
    );
  }
  return (
    <div
      className={`${styles.noteText} nowheel`}
      role="note"
      aria-label={String(t('node.noteText'))}
      title={editable ? String(t('editing.noteEdit')) : undefined}
      tabIndex={0}
      data-empty={text ? undefined : 'true'}
      onDoubleClick={editable ? (event) => {
        event.stopPropagation();
        setEditing(true);
      } : undefined}
      onKeyDown={editable ? (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          setEditing(true);
        }
      } : undefined}
    >
      {text ? (display ?? text) : (editable ? <span className={styles.notePlaceholder}>{t('editing.notePlaceholder')}</span> : null)}
    </div>
  );
}
