import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { McpAuthMode } from '../../../../shared/config/schema';
import type { McpOAuthStatus } from '../../../../shared/contracts';
import { explainError, type Translator } from '../../../../shared/i18n';
import Button from '../../../ui/Button';
import { cx } from '../../../ui/cx';
import { refreshSyncStatus } from '../../../state/knowledgeState';
import { formatSyncTime } from '../../sync/syncView';
import { ACCESS_CHOICES, tokenPlaceKey, type AccessChoice, type TokenStatus } from '../mcpAccess';
import settingsStyles from '../SettingsPanel.module.css';
import styles from './McpAccess.module.css';
import { fieldClass, hintClass, rowClass } from './common';

const TITLES: Record<AccessChoice, string> = { none: 'settings.accessNone', token: 'settings.accessToken', oauth: 'settings.accessOauth' };
const HINTS: Record<AccessChoice, string> = { none: 'settings.accessNoneHint', token: 'settings.accessTokenHint', oauth: 'settings.accessOauthHint' };

/**
 * Settings ▸ Connection ▸ "Access to the server": how the app gets in — without credentials, with a pasted token,
 * or through a browser sign-in. Native radios in a fieldset, so arrow keys and screen readers work as everywhere;
 * only the chosen option is expanded, the others stay one title line. The choice is part of the settings draft.
 */
export default function McpAccess({ value, savedValue, onChange, mcpUrl, savedUrl, disabled }: {
  value: McpAuthMode;
  /** The stored choice, to say that a changed one applies after Save. */
  savedValue: McpAuthMode;
  onChange: (next: AccessChoice) => void;
  /** The MCP address in the draft; a pasted token is held for that address. */
  mcpUrl: string;
  /** The address is saved and unchanged, so the browser sign-in can go to it. */
  savedUrl: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset className={cx(styles.access, 'mcp-access')} data-access={value || 'unchosen'}>
      <legend className={styles.legend}>{t('settings.accessTitle')}</legend>
      <p className={hintClass}>{t('settings.accessLead')}</p>
      <div className={styles.options}>
        {ACCESS_CHOICES.map((choice) => {
          const checked = value === choice;
          const hintId = `${name}-${choice}-hint`;
          return (
            <div key={choice} className={cx(styles.option, checked && styles.checked)} data-access-option={choice} data-expanded={checked}>
              <label className={styles.head}>
                <input
                  type="radio"
                  name={name}
                  value={choice}
                  checked={checked}
                  disabled={disabled}
                  aria-describedby={checked ? hintId : undefined}
                  onChange={() => onChange(choice)}
                />
                <span className={styles.title}>{t(TITLES[choice])}</span>
              </label>
              {checked ? (
                <div className={styles.body}>
                  <p id={hintId} className={hintClass}>{t(HINTS[choice])}</p>
                  {choice === 'token' ? <TokenPanel mcpUrl={mcpUrl} /> : null}
                  {choice === 'oauth' ? <McpSignIn savedUrl={savedUrl} disabled={disabled} /> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {value === '' ? <p className={hintClass}>{t('settings.accessUnchosen')}</p> : null}
      {value !== '' && value !== savedValue ? <p className={hintClass}>{t('settings.accessApplies')}</p> : null}
    </fieldset>
  );
}

/**
 * The pasted token. It goes only through its own IPC (memory for this session, or the OS password manager); the
 * field is emptied once handed over and the token is never shown back. Main binds it to the address it is for.
 */
function TokenPanel({ mcpUrl }: { mcpUrl: string }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<TokenStatus>({ held: false, source: 'none', stored: false });
  const [canStore, setCanStore] = useState(true);
  const [note, setNote] = useState('');

  const refresh = async () => {
    const [token, secret] = await Promise.all([window.electronAPI.mcpTokenStatus(), window.electronAPI.secretStatus()]);
    setStatus(token);
    setCanStore(secret.persist);
  };
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);
  // Every change is shown at once, here and in the sync indicator; nothing waits for Save.
  const after = async () => {
    await refresh().catch(() => undefined);
    refreshSyncStatus();
  };

  const holdForSession = async () => {
    setNote('');
    await window.electronAPI.mcpSetToken(draft, mcpUrl);
    setDraft('');
    await after();
  };
  const saveInStorage = async () => {
    setNote('');
    const saved = await window.electronAPI.mcpSaveToken(draft, mcpUrl);
    // Refused: the pasted text stays in the field so "Use in this session" still works without pasting again.
    if (saved.status === 'stored') setDraft('');
    else setNote(String(t('settings.tokenStorageBlocked')));
    await after();
  };
  const removeSaved = async () => {
    setNote('');
    await window.electronAPI.mcpForgetToken();
    await after();
  };
  const forgetSession = async () => {
    setNote('');
    await window.electronAPI.mcpSetToken('');
    await after();
  };

  const saved = status.source === 'os' || status.stored;
  return (
    <div className={cx(styles.panel, 'mcp-token')}>
      <label className={fieldClass}>
        {t('settings.tokenField')}
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label={String(t('settings.tokenField'))}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <div className={rowClass}>
        <Button size="sm" disabled={draft.length === 0} onClick={() => void holdForSession()}>{t('settings.tokenUseSession')}</Button>
        {canStore ? (
          <Button size="sm" disabled={draft.length === 0} onClick={() => void saveInStorage()}>{t('settings.tokenSave')}</Button>
        ) : null}
        {saved ? <Button size="sm" variant="danger" onClick={() => void removeSaved()}>{t('settings.tokenRemoveSaved')}</Button> : null}
        {!saved && status.held ? <Button size="sm" variant="subtle" onClick={() => void forgetSession()}>{t('settings.tokenForget')}</Button> : null}
      </div>
      <p className={hintClass} role="status" aria-label={String(t('settings.tokenField'))}>
        <span className={cx(settingsStyles.placeDot, (status.held || saved) && settingsStyles.placeOn)} aria-hidden="true" />
        {t(tokenPlaceKey(status))}
      </p>
      {!canStore ? <p className={hintClass}>{t('settings.tokenNoStorage')}</p> : null}
      <p className={hintClass}>{t('settings.tokenPrivacy')}</p>
      {note ? <p className={settingsStyles.errorNote} role="alert">{note}</p> : null}
    </div>
  );
}

/**
 * "Sign in through the browser" to the saved MCP address. Main opens the system browser and keeps whatever the
 * server hands out; this row only shows the status. The class and data-oauth-state are hooks for the e2e tests.
 */
function McpSignIn({ savedUrl, disabled }: { savedUrl: boolean; disabled: boolean }) {
  const { t, i18n } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const [status, setStatus] = useState<McpOAuthStatus | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState('');
  const [info, setInfo] = useState('');
  const language = i18n.language === 'en' ? 'en' : 'ru';

  useEffect(() => {
    if (!savedUrl) return;
    void window.electronAPI.mcpOAuthStatus().then(setStatus).catch(() => undefined);
  }, [savedUrl]);

  const signIn = async () => {
    setNote('');
    setInfo('');
    setWaiting(true);
    setStatus((current) => ({ state: 'pending', persisted: current?.persisted ?? false }));
    try {
      const result = await window.electronAPI.mcpOAuthLogin();
      if (!result.ok) setNote(explainError(translate, result.error).summary);
      else if (result.anonymous) setInfo(String(t('settings.oauthNotNeeded')));
    } finally {
      setWaiting(false);
      setStatus(await window.electronAPI.mcpOAuthStatus().catch(() => null));
      refreshSyncStatus();
    }
  };
  const signOut = async () => {
    setNote('');
    setInfo('');
    setStatus(await window.electronAPI.mcpOAuthLogout().catch(() => null));
    refreshSyncStatus();
  };

  const state = waiting ? 'pending' : status?.state ?? 'none';
  let label = String(t('settings.oauthNone'));
  if (state === 'pending') label = String(t('settings.oauthPending'));
  else if (state === 'expired') label = String(t('settings.oauthExpired'));
  else if (state === 'authorized') {
    label = status?.expiresAt
      ? String(t('settings.oauthAuthorized', { time: formatSyncTime(status.expiresAt, language) }))
      : String(t('settings.oauthAuthorizedOpen'));
    label += ` ${String(t(status?.persisted ? 'settings.oauthStored' : 'settings.oauthSessionOnly'))}`;
  }

  return (
    <div className={cx(styles.panel, 'mcp-sign-in')} data-oauth-state={state}>
      <p className={hintClass} role="status" aria-label={String(t('settings.oauthTitle'))}>{savedUrl ? label : t('settings.oauthSaveFirst')}</p>
      <div className={rowClass}>
        <Button size="sm" disabled={disabled || !savedUrl || waiting} loading={waiting} onClick={() => void signIn()}>
          {t('settings.oauthSignIn')}
        </Button>
        {state === 'authorized' || state === 'expired' ? (
          <Button size="sm" variant="subtle" disabled={disabled || waiting} onClick={() => void signOut()}>
            {t('settings.oauthSignOut')}
          </Button>
        ) : null}
      </div>
      {info ? <p className={hintClass} role="status">{info}</p> : null}
      {note ? <p className={settingsStyles.errorNote} role="alert">{note}</p> : null}
    </div>
  );
}
