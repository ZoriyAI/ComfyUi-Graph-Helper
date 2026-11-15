/**
 * The update line in the status bar (StatusBar.tsx renders it). The check is opt-in (Settings > Privacy), so it asks
 * main nothing while the preference is off; main does the network request and the window only polls main's answer.
 * tests/unit/updateCheck.test.ts covers noticeOf.
 */
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UpdateNotice as Notice, UpdateStatus } from '../../../shared/contracts/updates';
import { usePreferencesStore } from '../../state/preferencesState';
import styles from './UpdateNotice.module.css';

/** How often the window asks main; main itself asks the releases page at most once a day. */
const POLL_MS = 60 * 60 * 1000;

/** The notice to show for a status; null when there is nothing to say. */
export function noticeOf(status: UpdateStatus | null): Notice | null {
  return status?.state === 'available' ? status.notice : null;
}

/**
 * A quiet line in the status bar when Settings ▸ Privacy ▸ "Check for new versions" is on and a newer version
 * exists: "Version X is available · What's new · Download". Nothing is downloaded by the app; the links open in
 * the browser. With the check off (the default) it renders nothing and nothing is asked.
 */
export default function UpdateNotice() {
  const { t } = useTranslation();
  const enabled = usePreferencesStore((state) => state.preferences.privacy.checkUpdates);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!enabled) {
      setNotice(null);
      return undefined;
    }
    // Ignore an answer that arrives after the check was switched off or the component unmounted.
    let alive = true;
    const ask = () => {
      void window.electronAPI.updateStatus()
        .then((status) => {
          if (alive) setNotice(noticeOf(status));
        })
        .catch(() => undefined);
    };
    ask();
    const timer = window.setInterval(ask, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled]);

  if (!notice) return null;
  const open = (link: 'notes' | 'download') => void window.electronAPI.openUpdateLink(link).catch(() => undefined);
  const dismiss = () => {
    setNotice(null);
    // Main remembers the dismissed version, so this notice does not come back for it.
    void window.electronAPI.dismissUpdate(notice.version).catch(() => undefined);
  };
  return (
    <span className={`${styles.notice} update-notice`} role="status" aria-label={String(t('updates.region'))}>
      <span className={styles.text}>{t('updates.available', { version: notice.version })}</span>
      <button type="button" className={styles.link} onClick={() => open('notes')}>{t('updates.notes')}</button>
      <button type="button" className={styles.link} onClick={() => open('download')}>{t('updates.download')}</button>
      <button type="button" className={styles.close} aria-label={String(t('updates.dismiss'))} title={String(t('updates.dismiss'))} onClick={dismiss}>
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  );
}
