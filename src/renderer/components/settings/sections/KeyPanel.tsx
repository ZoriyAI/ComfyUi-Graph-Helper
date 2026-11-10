import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { explainError, type Translator } from '../../../../shared/i18n';
import Button from '../../../ui/Button';
import { cx } from '../../../ui/cx';
import type { KeySource } from '../../../state/providerState';
import settingsStyles from '../SettingsPanel.module.css';
import { fieldClass, hintClass, rowClass } from './common';

/** Typing or pasting applies the key after this pause, not on every key. */
const APPLY_DEBOUNCE_MS = 600;

type Verdict = { kind: 'idle' } | { kind: 'checking' } | { kind: 'accepted'; count: number } | { kind: 'rejected' } | { kind: 'failed'; text: string };

const PROVIDER_NAMES: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' };

/** Where the key lives, for the status line under the field. */
export function keyPlaceKey(source: KeySource, stored: boolean, inFile: boolean): string {
  if (source === 'os' || stored) return 'settings.keyPlaceOs';
  if (source === 'file' || inFile) return 'settings.keyPlaceFile';
  if (source === 'session') return 'settings.keyPlaceSession';
  return 'settings.keyPlaceNone';
}

/**
 * Settings ▸ Assistant ▸ the cloud provider's key, right under the provider choice. Pasting applies the key for this
 * session and checks it at once by asking the provider for its model list, so the person sees "accepted" or "not
 * accepted" without pressing anything. Remembering it for the next start is one button that fits this computer:
 * the OS password manager when it proved encryption, else the app folder file the person chooses knowingly. The key
 * goes only through its own IPC and is never shown back.
 */
export default function KeyPanel({ provider, baseURL, onSession }: { provider: string; baseURL: string; onSession: (source: KeySource) => void }) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState<KeySource>('none');
  const [canStore, setCanStore] = useState(true);
  const [stored, setStored] = useState(false);
  const [inFile, setInFile] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' });
  const [note, setNote] = useState('');
  const applyTicket = useRef(0);
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  const refresh = async () => {
    const [secret, session] = await Promise.all([window.electronAPI.secretStatus(), window.electronAPI.llmSessionStatus()]);
    setCanStore(secret.persist);
    setStored(secret.stored);
    setInFile(secret.inFile);
    setSource(session.source);
    onSessionRef.current(session.source);
  };
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  // Paste → hold for this session → ask the provider for its models with that key.
  useEffect(() => {
    if (draft.length === 0) return undefined;
    const ticket = ++applyTicket.current;
    const timer = setTimeout(() => {
      void (async () => {
        setNote('');
        setVerdict({ kind: 'checking' });
        const held = await window.electronAPI.llmSetSessionKey(draft);
        setSource(held.source);
        onSessionRef.current(held.source);
        let listed: Awaited<ReturnType<typeof window.electronAPI.llmListModels>>;
        try {
          listed = await window.electronAPI.llmListModels({ provider, baseURL });
        } catch {
          listed = { ok: false, error: 'The model list could not be read.' };
        }
        if (ticket !== applyTicket.current) return;
        if (listed.ok) {
          setVerdict({ kind: 'accepted', count: listed.models.length });
          setDraft('');
        } else if (listed.error === 'The provider refused the key.') {
          setVerdict({ kind: 'rejected' });
        } else {
          setVerdict({ kind: 'failed', text: explainError(translate, listed.error).summary });
        }
        await refresh().catch(() => undefined);
      })();
    }, APPLY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, provider, baseURL]);

  const remember = async () => {
    setNote('');
    const saved = await window.electronAPI.saveSecret();
    if (saved.status !== 'stored') setNote(String(t('settings.keyStorageBlocked')));
    await refresh().catch(() => undefined);
  };
  const rememberInFile = async () => {
    setNote('');
    const saved = await window.electronAPI.saveSecretFile();
    if (saved.status !== 'stored') setNote(String(t('settings.keyPlaceNone')));
    await refresh().catch(() => undefined);
  };
  const forget = async () => {
    setNote('');
    setVerdict({ kind: 'idle' });
    await window.electronAPI.forgetSecret();
    await refresh().catch(() => undefined);
  };

  const held = source !== 'none';
  const remembered = source === 'os' || stored || source === 'file' || inFile;
  const name = PROVIDER_NAMES[provider] ?? provider;
  const verdictText = verdict.kind === 'checking' ? t('settings.keyChecking')
    : verdict.kind === 'accepted' ? t('settings.keyAccepted', { count: verdict.count })
      : verdict.kind === 'rejected' ? t('settings.keyRejected')
        : verdict.kind === 'failed' ? verdict.text : '';
  return (
    <div className={cx(settingsStyles.keyPanel, 'provider-key')}>
      <label className={fieldClass}>
        {t('settings.keyField', { provider: name })}
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label={String(t('settings.keyField', { provider: name }))}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <p className={hintClass}>{t('settings.keyPasteHint', { provider: name })}</p>
      {verdictText ? (
        <p className={cx(hintClass, verdict.kind === 'rejected' || verdict.kind === 'failed' ? settingsStyles.errorNote : undefined)} role="status">{verdictText}</p>
      ) : null}
      <p className={hintClass} role="status" aria-label={String(t('settings.keyField', { provider: name }))}>
        <span className={cx(settingsStyles.placeDot, (held || remembered) && settingsStyles.placeOn)} aria-hidden="true" />
        {t(keyPlaceKey(source, stored, inFile))}
      </p>
      <div className={rowClass}>
        {held && !remembered && canStore ? <Button size="sm" onClick={() => void remember()}>{t('settings.keyRemember')}</Button> : null}
        {held && !remembered && !canStore ? <Button size="sm" onClick={() => void rememberInFile()}>{t('settings.keyRememberFile')}</Button> : null}
        {held || remembered ? <Button size="sm" variant="subtle" onClick={() => void forget()}>{t('settings.keyForget')}</Button> : null}
      </div>
      {held && !remembered && !canStore ? <p className={hintClass}>{t('settings.keyRememberFileHint')}</p> : null}
      {remembered ? <p className={hintClass}>{t('settings.keyRemembered')}</p> : null}
      <p className={hintClass}>{t('settings.keyPrivacy')}</p>
      {note ? <p className={settingsStyles.errorNote} role="alert">{note}</p> : null}
    </div>
  );
}
