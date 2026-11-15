/**
 * The confirmation dialog used inside Settings: SettingsPanel asks with it before discarding a changed draft, and
 * PrivacySection before removing stored data or agreeing to a choice. It borrows the frame of the shell's command
 * dialogs so a question looks the same wherever it is asked.
 */
import React from 'react';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../../ui/Dialog';
import Button from '../../../ui/Button';
import { cx } from '../../../ui/cx';
import { Trash2 } from 'lucide-react';
import styles from '../../shell/CommandDialogs.module.css';
import own from './ConfirmDialog.module.css';

/**
 * A small "are you sure" dialog: what will be removed, then Cancel or the action. With `tone` "agree" it asks to
 * agree to something instead (a plain mark, the action as the strong button), and `after` and `children` follow
 * the list: a closing sentence and a way to read more.
 */
export default function ConfirmDialog({ open, onOpenChange, title, lead, items, after, children, confirmLabel, cancelLabel, onConfirm, className, tone = 'danger', icon }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  lead: string;
  items?: string[];
  after?: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  className?: string;
  tone?: 'danger' | 'agree';
  icon?: React.ReactNode;
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          // The lead's id comes from the class name, so two confirm dialogs on one page do not share an id.
          className={cx(styles.dialog, className)} aria-describedby={`${className ?? 'confirm'}-lead`}>
          <header className={cx(styles.header, own.head)}>
            <span className={cx(own.mark, tone === 'agree' && own.markAgree)} aria-hidden="true">{icon ?? <Trash2 size={16} />}</span>
            <DialogTitle className={styles.title}>{title}</DialogTitle>
            <DialogDescription id={`${className ?? 'confirm'}-lead`} className={styles.lead}>{lead}</DialogDescription>
          </header>
          {items && items.length > 0 ? (
            <ul className={cx(styles.findings, own.items)}>
              {items.map((item) => <li key={item} className={styles.finding}>{item}</li>)}
            </ul>
          ) : null}
          {after ? <p className={cx(styles.lead, own.after)}>{after}</p> : null}
          {children ? <div className={own.more}>{children}</div> : null}
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{cancelLabel}</Button>
            </DialogClose>
            <Button variant={tone === 'agree' ? 'primary' : 'danger'} size="sm" onClick={() => { onOpenChange(false); onConfirm(); }}>{confirmLabel}</Button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
