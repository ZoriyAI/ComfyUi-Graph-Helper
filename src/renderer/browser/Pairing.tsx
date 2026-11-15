/** The only unauthenticated browser screen: enter the temporary code displayed on the computer. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import styles from './Browser.module.css';

/** Pairing is explicit and rate limited on the host; no project data loads until it succeeds. */
export default function Pairing({ onConnected }: { onConnected: () => void }) {
  const { t } = useTranslation(); const [code, setCode] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const connect = async (event: React.FormEvent) => {
    event.preventDefault(); setPending(true); setError('');
    try {
      const response = await fetch('/browser/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim() }) });
      if (response.ok) onConnected(); else setError(String(t(response.status === 429 ? 'browser.tooManyAttempts' : 'browser.codeWrong')));
    } catch { setError(String(t('browser.disconnected'))); }
    finally { setPending(false); }
  };
  return <main className={styles.pairing}><form className={styles.card} onSubmit={(event) => void connect(event)}>
    <h1>{t('browser.connectTitle')}</h1><p>{t('browser.connectHint')}</p>
    <label className={styles.codeLabel}>{t('browser.codeLabel')}<input autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} /></label>
    <p className={styles.note}>{t('browser.trustedWifi')}</p>
    <p role="status">{error}</p><Button type="submit" variant="primary" disabled={pending || code.length !== 6}>{t('browser.connect')}</Button>
  </form></main>;
}
