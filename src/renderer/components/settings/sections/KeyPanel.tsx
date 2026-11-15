/**
 * The key field of one model provider in Settings > Assistant (AssistantSection renders it for the cloud companies,
 * a compatible service and an own server's optional key). Unlike the rest of Settings, a key applies at once and
 * goes only to main (memory, the OS password store or a file); the renderer never reads a stored key back.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { explainError, type Translator } from '../../../../shared/i18n';
import type { CloudKeyProvider } from '../../../../shared/contracts';
import Button from '../../../ui/Button';
import { cx } from '../../../ui/cx';
import { NO_KEYS, type KeySource, type KeySources } from '../../../state/providerState';
import { useUiStore } from '../../../state/uiState';
import settingsStyles from '../SettingsPanel.module.css';
import { errorSummary, fieldClass, hintClass, rowClass } from './common';
import { keyOriginFor } from '../../../../shared/config/keyOrigin';

/** Typing or pasting applies the key after this pause, not on every key. */
const APPLY_DEBOUNCE_MS = 600;

/** The result of checking a pasted key against the provider's model list. */
type Verdict =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'accepted'; count: number }
  | { kind: 'rejected'; dropped: boolean }
  | { kind: 'unchecked'; text: string }
  | { kind: 'failed'; text: string };

/** Company names are brand names: the same in every language, so they are not in the catalog. */
const PROVIDER_NAMES: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' };

/** What a panel says instead of the cloud wording: your own server's optional key, a compatible service's key. */
export interface KeyPanelWords {
  /** The provider's name in sentences (a compatible service: the host of its address). */
  name?: string;
  /** The field's label. */
  label?: string;
  /** The line under the field. */
  hint?: string;
  /** Why the field cannot take a key yet (no address); the field is disabled while it is set. */
  blocked?: string;
}

/** Where the key lives, for the status line under the field. */
export function keyPlaceKey(source: KeySource, stored: boolean, inFile: boolean): string {
  // The strongest place wins: OS storage, then the file, then memory for this session only.
  if (source === 'os' || stored) return 'settings.keyPlaceOs';
  if (source === 'file' || inFile) return 'settings.keyPlaceFile';
  if (source === 'session') return 'settings.keyPlaceSession';
  return 'settings.keyPlaceNone';
}

/**
 * Settings ▸ Assistant ▸ the chosen cloud provider's key, right under the provider choice. Every action names that
 * provider: a key pasted here is held, checked, remembered and forgotten for it alone, and never goes to another
 * company after a switch. Pasting applies the key and checks it at once by asking the provider for its model list;
 * a key the provider refuses is dropped in main and the panel says so; a check that could not reach the provider
 * keeps the key and says it was not checked. Remembering fits this computer: the OS password manager when it
 * proved encryption, else the app folder file the person chooses knowingly. The key is never shown back.
 */
export default function KeyPanel({ provider, baseURL, onSession, words = {} }: { provider: CloudKeyProvider; baseURL: string; onSession: (sources: KeySources) => void; words?: KeyPanelWords }) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState<KeySource>('none');
  const [canStore, setCanStore] = useState(true);
  const openSettings = useUiStore((state) => state.openSettings);
  const [stored, setStored] = useState(false);
  const [inFile, setInFile] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' });
  const [note, setNote] = useState('');
  const [keyOrigin, setKeyOrigin] = useState<string | null>(null);
  // Each apply or provider switch takes a new ticket; an answer for an older ticket is ignored.
  const applyTicket = useRef(0);
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const refresh = async () => {
    const asked = providerRef.current;
    const [secret, session] = await Promise.all([window.electronAPI.secretStatus(asked), window.electronAPI.llmSessionStatus()]);
    const sources = { ...NO_KEYS, ...(session.providers ?? {}) };
    onSessionRef.current(sources);
    // A switch while the answer was on its way: the newer provider's refresh is the one that shows.
    if (asked !== providerRef.current) return;
    setCanStore(secret.persist);
    setStored(secret.providers?.[asked]?.stored ?? secret.stored);
    setInFile(secret.providers?.[asked]?.inFile ?? secret.inFile);
    setSource(sources[asked]);
    setKeyOrigin(session.origins?.[asked] ?? null);
  };

  // Another provider is another key: the half-typed draft and the last verdict belong to the previous one.
  useEffect(() => {
    applyTicket.current += 1;
    setDraft('');
    setVerdict({ kind: 'idle' });
    setNote('');
    void refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Paste → hold for this provider and the address shown now → ask that address for its models with that key.
  // Editing the address later never re-sends the key: a key belongs to the address it was pasted for.
  const baseRef = useRef(baseURL);
  baseRef.current = baseURL;
  useEffect(() => {
    if (draft.length === 0) return undefined;
    const ticket = ++applyTicket.current;
    const target = provider;
    const timer = setTimeout(() => {
      void (async () => {
        setNote('');
        setVerdict({ kind: 'checking' });
        const base = baseRef.current;
        let held: Awaited<ReturnType<typeof window.electronAPI.llmSetSessionKey>>;
        try {
          held = await window.electronAPI.llmSetSessionKey(target, draft, base);
        } catch (error) {
          // Main could not take the key: say so instead of leaving "Checking…" on screen for good.
          if (ticket === applyTicket.current) setVerdict({ kind: 'failed', text: errorSummary(translate, error) });
          return;
        }
        if (ticket === applyTicket.current) setSource(held.source);
        let listed: Awaited<ReturnType<typeof window.electronAPI.llmListModels>>;
        try {
          listed = await window.electronAPI.llmListModels({ provider: target, baseURL: base });
        } catch {
          listed = { ok: false, error: 'The model list could not be read.' };
        }
        if (ticket !== applyTicket.current) return;
        if (listed.ok) {
          setVerdict({ kind: 'accepted', count: listed.models.length });
          setDraft('');
        // Main's error sentence for a 401/403 from the provider; compared as text because it is the IPC contract.
        } else if (listed.error === 'The provider refused the key.') {
          setVerdict({ kind: 'rejected', dropped: listed.dropped === true });
          if (listed.dropped) setDraft('');
        } else {
          setVerdict({ kind: 'unchecked', text: explainError(translate, listed.error).summary });
        }
        await refresh().catch(() => undefined);
      })();
    }, APPLY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const remember = async () => {
    setNote('');
    const saved = await window.electronAPI.saveSecret(provider);
    if (saved.status !== 'stored') setNote(String(t('settings.keyStorageBlocked')));
    await refresh().catch(() => undefined);
  };
  const rememberInFile = async () => {
    setNote('');
    const saved = await window.electronAPI.saveSecretFile(provider);
    if (saved.status !== 'stored') setNote(String(t('settings.keyFileSaveFailed')));
    await refresh().catch(() => undefined);
  };
  const forget = async () => {
    setNote('');
    setVerdict({ kind: 'idle' });
    await window.electronAPI.forgetSecret(provider);
    await refresh().catch(() => undefined);
  };

  const held = source !== 'none';
  // The held key belongs to another address than the one in the field: it is not sent there.
  const wanted = keyOriginFor(provider, baseURL);
  const otherAddress = held && keyOrigin !== null && wanted !== keyOrigin;
  const remembered = source === 'os' || stored || source === 'file' || inFile;
  const name = words.name ?? PROVIDER_NAMES[provider] ?? provider;
  const label = words.label ?? String(t('settings.keyField', { provider: name }));
  const verdictText = verdict.kind === 'checking' ? t('settings.keyChecking')
    : verdict.kind === 'accepted' ? t('settings.keyAccepted', { count: verdict.count })
      : verdict.kind === 'rejected' ? (verdict.dropped ? t('settings.keyRejectedDropped', { provider: name }) : t('settings.keyRejected'))
        : verdict.kind === 'unchecked' ? t('settings.keyUnchecked', { reason: verdict.text })
          : verdict.kind === 'failed' ? t('settings.keyApplyFailed', { reason: verdict.text }) : '';
  return (
    <div className={cx(settingsStyles.keyPanel, 'provider-key')} data-provider={provider}>
      <label className={fieldClass}>
        {label}
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          value={draft}
          disabled={Boolean(words.blocked)}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      {words.blocked ? <p className={hintClass} role="status">{words.blocked}</p> : null}
      <p className={hintClass}>{words.hint ?? t('settings.keyPasteHint', { provider: name })} {t('settings.appliesNow')}</p>
      {/* Without a password store a pasted key lives until the app closes: one line here, the full account in Privacy. */}
      {!canStore ? (
        <p className={cx(hintClass, settingsStyles.keyStoreNote, 'key-store-note')}>
          {t('settings.keyReason')}{' '}
          <button type="button" className={settingsStyles.inlineLink} onClick={() => openSettings('privacy')}>{t('settings.keysWhereLink')}</button>
        </p>
      ) : null}
      {verdictText ? (
        <p className={cx(hintClass, verdict.kind === 'rejected' || verdict.kind === 'unchecked' || verdict.kind === 'failed' ? settingsStyles.errorNote : undefined)} role="status">{verdictText}</p>
      ) : null}
      <p className={hintClass} role="status" aria-label={label}>
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
      {otherAddress ? (
        <p className={cx(hintClass, settingsStyles.errorNote, 'key-other-address')} role="status">
          {t('settings.keyOtherAddress', { address: keyOrigin })}
        </p>
      ) : null}
      <p className={hintClass}>{t('settings.keyPrivacy')}</p>
      {note ? <p className={settingsStyles.errorNote} role="alert">{note}</p> : null}
    </div>
  );
}
