import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser } from 'lucide-react';
import { explainError, type Translator } from '../../../../shared/i18n';
import Button from '../../../ui/Button';
import { cx } from '../../../ui/cx';
import styles from '../SettingsPanel.module.css';
import { fieldClass, Group, hintClass, rowClass, SectionHead } from './common';

type KeySource = 'none' | 'session' | 'os';

/**
 * Settings ▸ Models & keys: the model key (session memory or OS storage), the MCP token, where each secret
 * is right now, and one button that forgets them all. Keys go only through their own IPC; none is in the draft.
 */
export default function ModelsSection({ provider, onSession, mcpUrl }: { provider: string; onSession: (source: KeySource) => void
  /** The MCP URL in the current settings draft; the token is held for that origin. */
  mcpUrl: string;
}) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;
  const [sessionKey, setSessionKey] = useState('');
  const [osKey, setOsKey] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [secretReason, setSecretReason] = useState('');
  const [secretPersist, setSecretPersist] = useState(false);
  const [secretStored, setSecretStored] = useState(false);
  const [keySource, setKeySource] = useState<KeySource>('none');
  const [mcpHeld, setMcpHeld] = useState(false);
  const [mcpTokenDraft, setMcpTokenDraft] = useState('');
  const [mcpNote, setMcpNote] = useState('');

  const refresh = async () => {
    const [status, session, mcp] = await Promise.all([
      window.electronAPI.secretStatus(),
      window.electronAPI.llmSessionStatus(),
      window.electronAPI.mcpTokenStatus(),
    ]);
    setSecretReason(status.reason);
    setSecretPersist(status.persist);
    setSecretStored(status.stored);
    setKeySource(session.source);
    setMcpHeld(mcp.held);
    return { status, session };
  };

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  const holdSession = async () => {
    const held = await window.electronAPI.llmSetSessionKey(sessionKey);
    setSessionKey('');
    setSessionNote(String(t(held.held ? 'settings.sessionHeld' : 'settings.sessionCleared')));
    setKeySource(held.source);
    onSessionRef.current(held.source);
  };
  const clearSession = async () => {
    const held = await window.electronAPI.llmSetSessionKey('');
    setSessionKey('');
    setSessionNote(String(t('settings.sessionCleared')));
    setKeySource(held.source);
    onSessionRef.current(held.source);
  };
  const storeOsKey = async () => {
    const saved = await window.electronAPI.saveSecret(osKey);
    setOsKey('');
    const { status, session } = await refresh();
    if (saved.status !== 'stored') {
      setActionNote(explainError(translate, status.reason).summary);
      return;
    }
    onSessionRef.current(session.source);
  };
  const removeStoredKey = async () => {
    await window.electronAPI.forgetSecret();
    setSecretStored(false);
    setOsKey('');
    setKeySource('none');
    onSessionRef.current('none');
    setSessionNote(String(t('settings.storedRemoved')));
  };
  const holdMcpToken = async () => {
    const held = await window.electronAPI.mcpSetToken(mcpTokenDraft, mcpUrl);
    setMcpTokenDraft('');
    setMcpHeld(held.held);
    setMcpNote(String(t(held.held ? 'settings.mcpTokenHeld' : 'settings.mcpTokenCleared')));
  };
  const clearMcpToken = async () => {
    await window.electronAPI.mcpSetToken('');
    setMcpTokenDraft('');
    setMcpHeld(false);
    setMcpNote(String(t('settings.mcpTokenCleared')));
  };
  const forgetEverything = async () => {
    await window.electronAPI.llmSetSessionKey('');
    await window.electronAPI.mcpSetToken('');
    await window.electronAPI.forgetSecret();
    setSessionKey('');
    setOsKey('');
    setMcpTokenDraft('');
    await refresh().catch(() => undefined);
    onSessionRef.current('none');
    setActionNote(String(t('preferences.forgotAll')));
  };

  const keyPlace = keySource === 'os' ? 'preferences.placeOs' : keySource === 'session' ? 'preferences.placeSession' : secretStored ? 'preferences.placeOs' : 'preferences.placeNone';
  const providerName = provider ? ` (${provider})` : '';

  return (
    <>
      <SectionHead title={String(t('preferences.nav.models'))} lead={String(t('preferences.lead.models'))} />
      <table className={styles.table}>
        <caption className={styles.caption}>{t('preferences.secretsTitle')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('preferences.secretColumn')}</th>
            <th scope="col">{t('preferences.placeColumn')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t('preferences.providerKeyRow')}{providerName}</th>
            <td><span className={cx(styles.placeDot, keyPlace !== 'preferences.placeNone' && styles.placeOn)} aria-hidden="true" />{t(keyPlace)}</td>
          </tr>
          <tr>
            <th scope="row">{t('preferences.mcpTokenRow')}</th>
            <td><span className={cx(styles.placeDot, mcpHeld && styles.placeOn)} aria-hidden="true" />{t(mcpHeld ? 'preferences.placeSession' : 'preferences.placeNone')}</td>
          </tr>
        </tbody>
      </table>

      <Group title={String(t('preferences.providerKeysTitle'))}>
        {secretPersist ? (
          <>
            <label className={fieldClass}>
              {t('settings.osKey')}
              <input type="password" autoComplete="off" aria-label={String(t('settings.osKey'))} value={osKey} onChange={(event) => setOsKey(event.target.value)} />
            </label>
            <div className={rowClass}>
              <Button size="sm" disabled={osKey.length === 0} onClick={() => void storeOsKey()}>{t('settings.saveStoredKey')}</Button>
              {secretStored ? <Button size="sm" variant="danger" onClick={() => void removeStoredKey()}>{t('settings.removeStored')}</Button> : null}
            </div>
            {secretStored ? <p className={hintClass} role="status">{t('settings.storedKey')}</p> : null}
          </>
        ) : (
          <>
            <label className={fieldClass}>
              {t('settings.apiKey')}
              <input type="password" aria-label={String(t('settings.apiKey'))} aria-describedby="key-unavailable" value="" disabled readOnly />
            </label>
            <p id="key-unavailable" className={hintClass}>{t('settings.keyReason')}</p>
            <Button size="sm" className={styles.single} disabled>{t('settings.saveKey')}</Button>
          </>
        )}
        <label className={fieldClass}>
          {t('settings.sessionKey')}
          <input type="password" autoComplete="off" aria-label={String(t('settings.sessionKey'))} value={sessionKey} onChange={(event) => setSessionKey(event.target.value)} />
        </label>
        <p className={hintClass}>{secretReason ? explainError(translate, secretReason).summary : ''}</p>
        <div className={rowClass}>
          <Button size="sm" disabled={sessionKey.length === 0} onClick={() => void holdSession()}>{t('settings.useSession')}</Button>
          <Button size="sm" onClick={() => void clearSession()}>{t('settings.clearSession')}</Button>
        </div>
        {sessionNote ? <p className={hintClass} role="status">{sessionNote}</p> : null}
      </Group>

      <Group title={String(t('preferences.mcpTitle'))}>
        <label className={fieldClass}>
          {t('settings.mcpToken')}
          <input type="password" autoComplete="off" aria-label={String(t('settings.mcpToken'))} value={mcpTokenDraft} onChange={(event) => setMcpTokenDraft(event.target.value)} />
        </label>
        <div className={rowClass}>
          <Button size="sm" disabled={mcpTokenDraft.length === 0} onClick={() => void holdMcpToken()}>{t('settings.useMcpToken')}</Button>
          <Button size="sm" onClick={() => void clearMcpToken()}>{t('settings.clearMcpToken')}</Button>
        </div>
        {mcpNote ? <p className={hintClass} role="status">{mcpNote}</p> : null}
      </Group>

      <Group>
        <div className={cx(rowClass, styles.rowStart)}>
          <Button size="sm" variant="danger" icon={<Eraser size={14} aria-hidden="true" />} onClick={() => void forgetEverything()}>{t('preferences.forgetAll')}</Button>
        </div>
        <p className={hintClass}>{t('preferences.forgetAllHint')}</p>
        {actionNote ? <p className={hintClass} role="status">{actionNote}</p> : null}
      </Group>
    </>
  );
}
