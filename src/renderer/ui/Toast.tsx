import React, { useEffect, useState } from 'react';
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

/**
 * The horizontal centre and width of the canvas (`.graph-pane`), so toasts sit over the canvas and never over the
 * library or the dock's composer. Null until the canvas is on screen; the CSS then centres them in the window.
 */
function useCanvasBand(): { center: number; width: number } | null {
  const [band, setBand] = useState<{ center: number; width: number } | null>(null);
  useEffect(() => {
    let observer: ResizeObserver | null = null;
    let frame = 0;
    const measure = (pane: Element) => {
      const box = pane.getBoundingClientRect();
      setBand((current) => (current && current.center === box.left + box.width / 2 && current.width === box.width ? current : { center: box.left + box.width / 2, width: box.width }));
    };
    const attach = () => {
      const pane = document.querySelector('.graph-pane');
      if (!pane) {
        frame = window.requestAnimationFrame(attach);
        return;
      }
      measure(pane);
      if (typeof ResizeObserver === 'undefined') return;
      observer = new ResizeObserver(() => measure(pane));
      observer.observe(pane);
    };
    attach();
    // The observer sees the canvas change size; a window resize can also move it without resizing it.
    const onResize = () => {
      const pane = document.querySelector('.graph-pane');
      if (pane) measure(pane);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return band;
}

/** Mount once near the root. Renders the queue from the toast store. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const band = useCanvasBand();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  return (
    <T.Provider label={String(t('shell.notification'))} swipeDirection="down">
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
      <T.Viewport
        className={styles.viewport}
        label={String(t('shell.notifications'))}
        style={band ? { left: band.center, width: Math.max(240, Math.min(440, band.width - 32)) } : undefined}
      />
    </T.Provider>
  );
}
