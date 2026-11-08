import React from 'react';
import * as T from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './Toast.module.css';
import { cx } from './cx';
import { showToast, useToastStore, type ToastInput } from './toastStore';

export { showToast, type ToastInput, type ToastTone } from './toastStore';

/**
 * Radix's own announcer would copy the text into a second hidden node; the toast itself is the
 * polite live region instead, so assistive tech hears it once and the text exists once in the DOM.
 */
const EXCLUDE = { 'data-radix-toast-announce-exclude': '' } as Record<string, string>;

export function useToast() {
  const dismiss = useToastStore((state) => state.dismiss);
  return { show: (input: ToastInput) => showToast(input), dismiss };
}

/** Mount once near the root. Renders the queue from the toast store. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <T.Provider label={String(t('shell.notification'))} swipeDirection="up">
      {children}
      {toasts.map((toast) => (
        <T.Root
          key={toast.key}
          open={toast.open}
          duration={toast.duration}
          type="background"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cx(styles.toast, styles[toast.tone], 'app-toast')}
          data-tone={toast.tone}
          onOpenChange={(open) => {
            if (!open) dismiss(toast.id);
          }}
        >
          <span className={styles.bar} aria-hidden="true" />
          <div className={styles.body} {...EXCLUDE}>
            <T.Title className={styles.title}>{toast.title}</T.Title>
            {toast.description ? <T.Description className={styles.description}>{toast.description}</T.Description> : null}
          </div>
          <div className={styles.actions}>
            {toast.action ? (
              <T.Action altText={toast.action.label} className={styles.action} onClick={toast.action.onSelect}>
                {toast.action.label}
              </T.Action>
            ) : null}
            <T.Close className={styles.close} aria-label={String(t('shell.dismiss'))} title={String(t('shell.dismiss'))}>
              <X size={14} aria-hidden="true" />
            </T.Close>
          </div>
        </T.Root>
      ))}
      <T.Viewport className={styles.viewport} label={String(t('shell.notifications'))} />
    </T.Provider>
  );
}
