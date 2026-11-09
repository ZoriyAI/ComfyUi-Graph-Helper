import React, { useEffect, useId, useRef, useState } from 'react';
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
export default function McpAccess({ value, savedValue, onChange, mcpUrl, savedUrl, disabled, focusToken = 0 }: {
  value: McpAuthMode;
  /** The stored choice, to say that a changed one applies after Save. */
  savedValue: McpAuthMode;
  onChange: (next: AccessChoice) => void;
  /** The MCP address in the draft; a pasted token is held for that address. */
  mcpUrl: string;
  /** The address is saved and unchanged, so the browser sign-in can go to it. */
  savedUrl: boolean;
  disabled: boolean;
  /** Bumped by the parent when "Check" found that the server wants a token: the field takes focus. */
  focusToken?: number;
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
                  {choice === 'token' ? <TokenPanel mcpUrl={mcpUrl} focusRequest={focusToken} /> : null}
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

/** Typing or pasting applies the token after this pause, not on every key. */
const APPLY_DEBOUNCE_MS = 600;

type Verdict = { kind: 'idle' } | { kind: 'checking' } | { kind: 'accepted'; tools: number } | { kind: 'rejected' } | { kind: 'notNeeded' } | { kind: 'failed'; text: string };

/**
 * The pasted token. It is applied the moment it is pasted (held for this session) and checked against the server
 * right away, so the person sees "accepted" or "not accepted" without pressing anything. Remembering it for the
 * next start is one button: the OS password manager when it proved encryption, else the app folder file the person
 * chooses knowingly. The token goes only through its own IPC and is never shown back; main binds it to the address.
 */
function TokenPanel({ mcpUrl, focusRequest }: { mcpUrl: string; focusRequest: number }) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<TokenStatus>({ held: false, source: 'none', stored: false, inFile: false });
  const [canStore, setCanStore] = useState(true);
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' });
  const [note, setNote] = useState('');
  const input = useRef<HTMLInputElement | null>(null);
  const applyTicket = useRef(0);

  const refresh = async () => {
    const [token, secret] = await Promise.all([window.electronAPI.mcpTokenStatus(), window.electronAPI.secretStatus()]);
    setStatus(token);
    setCanStore(secret.persist);
  };
  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);
  useEffect(() => {
    if (focusRequest > 0) input.current?.focus();
  }, [focusRequest]);
  // Every change is shown at once, here and in the sync indicator; nothing waits for Save.
  const after = async () => {
    await refresh().catch(() => undefined);
    refreshSyncStatus();
  };

  // Paste → hold for this session → ask the server whether it takes the token.
  useEffect(() => {
    if (draft.length === 0) return undefined;
    const ticket = ++applyTicket.current;
    const timer = setTimeout(() => {
      void (async () => {
        setNote('');
        setVerdict({ kind: 'checking' });
        await window.electronAPI.mcpSetToken(draft, mcpUrl);
        let probe: Awaited<ReturnType<typeof window.electronAPI.mcpDetectAuth>>;
        try {
          probe = await window.electronAPI.mcpDetectAuth(mcpUrl);
        } catch {
          probe = { ok: false, error: 'MCP server was not read.' };
        }
        if (ticket !== applyTicket.current) return;
        if (!probe.ok) setVerdict({ kind: 'failed', text: explainError(translate, probe.error).summary });
        else if (probe.mode === 'none') setVerdict({ kind: 'notNeeded' });
        else if (probe.mode === 'token' && probe.tokenAccepted === true) setVerdict({ kind: 'accepted', tools: probe.tools ?? 0 });
        else if (probe.mode === 'token' && probe.tokenAccepted === false) setVerdict({ kind: 'rejected' });
        else setVerdict({ kind: 'failed', text: translate('settings.tokenUnverified') });
        // Accepted or not needed: the field empties, the token lives in main. Rejected: the text stays to be fixed.
        if (probe.ok && (probe.mode === 'none' || (probe.mode === 'token' && probe.tokenAccepted === true))) setDraft('');
        await after();
      })();
    }, APPLY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, mcpUrl]);

  const remember = async () => {
    setNote('');
    const saved = await window.electronAPI.mcpSaveToken(undefined, mcpUrl);
    if (saved.status !== 'stored') setNote(String(t('settings.tokenStorageBlocked')));
    await after();
  };
  const rememberInFile = async () => {
    setNote('');
    const saved = await window.electronAPI.mcpSaveTokenFile(mcpUrl);
    if (saved.status !== 'stored') setNote(String(t('settings.tokenPlaceNone')));
    await after();
  };
  const forget = async () => {
    setNote('');
    setVerdict({ kind: 'idle' });
    await window.electronAPI.mcpForgetToken();
    await after();
  };

  const remembered = status.source === 'os' || status.stored || status.source === 'file' || status.inFile;
  const verdictText = verdict.kind === 'checking' ? t('settings.tokenChecking')
    : verdict.kind === 'accepted' ? t('settings.tokenAccepted', { tools: verdict.tools })
      : verdict.kind === 'rejected' ? t('settings.tokenRejected')
        : verdict.kind === 'notNeeded' ? t('settings.tokenNotNeeded')
          : verdict.kind === 'failed' ? verdict.text : '';
  return (
    <div className={cx(styles.panel, 'mcp-token')}>
      <label className={fieldClass}>
        {t('settings.tokenField')}
        <input
          ref={input}
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-label={String(t('settings.tokenField'))}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <p className={hintClass}>{t('settings.tokenPasteHint')}</p>
      {verdictText ? (
        <p className={cx(hintClass, verdict.kind === 'rejected' || verdict.kind === 'failed' ? settingsStyles.errorNote : undefined)} role="status">{verdictText}</p>
      ) : null}
      <p className={hintClass} role="status" aria-label={String(t('settings.tokenField'))}>
        <span className={cx(settingsStyles.placeDot, (status.held || remembered) && settingsStyles.placeOn)} aria-hidden="true" />
        {t(tokenPlaceKey(status))}
      </p>
      <div className={rowClass}>
        {status.held && !remembered && canStore ? (
          <Button size="sm" onClick={() => void remember()}>{t('settings.tokenRemember')}</Button>
        ) : null}
        {status.held && !remembered && !canStore ? (
          <Button size="sm" onClick={() => void rememberInFile()}>{t('settings.tokenRememberFile')}</Button>
        ) : null}
        {status.held || remembered ? <Button size="sm" variant="subtle" onClick={() => void forget()}>{t('settings.tokenForget')}</Button> : null}
      </div>
      {status.held && !remembered && !canStore ? <p className={hintClass}>{t('settings.tokenRememberFileHint')}</p> : null}
      {remembered ? <p className={hintClass}>{t('settings.tokenRemembered')}</p> : null}
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
