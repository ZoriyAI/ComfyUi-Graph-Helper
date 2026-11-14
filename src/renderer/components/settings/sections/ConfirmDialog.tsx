import React from 'react';
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from '../../../ui/Dialog';
import Button from '../../../ui/Button';
import { cx } from '../../../ui/cx';
import { Trash2 } from 'lucide-react';
import styles from '../../shell/CommandDialogs.module.css';
import own from './ConfirmDialog.module.css';

/** A small "are you sure" dialog: what will be removed, then Cancel or the action. */
export default function ConfirmDialog({ open, onOpenChange, title, lead, items, confirmLabel, cancelLabel, onConfirm, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  lead: string;
  items?: string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={cx(styles.dialog, className)} aria-describedby={`${className ?? 'confirm'}-lead`}>
          <header className={cx(styles.header, own.head)}>
            <span className={own.mark} aria-hidden="true"><Trash2 size={16} /></span>
            <DialogTitle className={styles.title}>{title}</DialogTitle>
            <DialogDescription id={`${className ?? 'confirm'}-lead`} className={styles.lead}>{lead}</DialogDescription>
          </header>
          {items && items.length > 0 ? (
            <ul className={cx(styles.findings, own.items)}>
              {items.map((item) => <li key={item} className={styles.finding}>{item}</li>)}
            </ul>
          ) : null}
          <footer className={styles.footer}>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">{cancelLabel}</Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={() => { onOpenChange(false); onConfirm(); }}>{confirmLabel}</Button>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
