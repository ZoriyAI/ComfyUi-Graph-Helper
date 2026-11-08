import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { secretBearingFields, settingsWriteError } from '../../../shared/config/draft';
import { nonSecretDefaults, type NonSecretSettings, type SettingsRead } from '../../../shared/config/schema';
import { explainError, languageOf, type AppLanguage, type Translator } from '../../../shared/i18n';
import { applyLanguage } from '../../i18n';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '../../ui/Dialog';
import Button from '../../ui/Button';
import SelectField, { CLOSE_OPEN_SELECT } from '../../ui/SelectField';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from '../../ui/Tabs';
import { cx } from '../../ui/cx';
import SyncSection from './SyncSection';
import styles from './SettingsPanel.module.css';

function applyMotion(motion: NonSecretSettings['motion']) {
  document.documentElement.dataset.motion = motion;
}

function sameSettings(left: NonSecretSettings, right: NonSecretSettings) {
  return left.theme === right.theme
    && left.motion === right.motion
    && left.provider === right.provider
    && left.model === right.model
    && left.baseURL === right.baseURL
    && left.comfyOrigin === right.comfyOrigin
    && left.mcpUrl === right.mcpUrl
    && left.language === right.language;
}

type Section = 'connection' | 'assistant' | 'appearance' | 'sync';
const SECTIONS: Section[] = ['connection', 'assistant', 'appearance', 'sync'];
const SECTION_LABELS: Record<Section, string> = {
  connection: 'settings.connection',
  assistant: 'settings.assistant',
  appearance: 'settings.appearance',
  sync: 'settings.sync',
};
type NoteState = { kind: 'key'; key: string } | { kind: 'error'; code: string };

/**
 * Settings dialog. Non-secret values save together and fail closed (a secret in any field blocks the save);
 * keys and tokens go only to memory or OS storage through their own buttons. Sync applies at once.
 */
export default function SettingsPanel({
  onRead,
  onSaved,
  onSession,
  triggerIcon,
}: {
  onRead: (values: NonSecretSettings) => void;
  onSaved: (values: NonSecretSettings) => void;
  onSession: (source: 'none' | 'session' | 'os') => void;
  triggerIcon?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const savedRef = useRef<NonSecretSettings>(nonSecretDefaults);
  const onReadRef = useRef(onRead);
  const onSavedRef = useRef(onSaved);
  onReadRef.current = onRead;
  onSavedRef.current = onSaved;
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>('connection');
  const [values, setValues] = useState<NonSecretSettings>(nonSecretDefaults);
  const [note, setNote] = useState<NoteState>({ kind: 'key', key: 'settings.notSavedYet' });
  const [pending, setPending] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [sessionKey, setSessionKey] = useState('');
  const [osKey, setOsKey] = useState('');
  const [sessionNote, setSessionNote] = useState('');
  const [secretReason, setSecretReason] = useState('');
  const [secretPersist, setSecretPersist] = useState(false);
  const [secretStored, setSecretStored] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [mcpTokenDraft, setMcpTokenDraft] = useState('');
  const [mcpNote, setMcpNote] = useState('');
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.secretStatus().then((status) => {
      if (cancelled) return;
      setSecretReason(status.reason);
      setSecretPersist(status.persist);
      setSecretStored(status.stored);
    }).catch(() => undefined);
    window.electronAPI.getSettings().then((read: SettingsRead) => {
      if (cancelled) return;
      const language = languageOf(read);
      applyLanguage(language);
      if (read.source === 'stored' && read.values) {
        savedRef.current = read.values;
        setValues(read.values);
        setNote({ kind: 'key', key: 'settings.restored' });
        applyMotion(read.values.motion);
        onReadRef.current(read.values);
        return;
      }
      if (read.source === 'corrupt') {
        const fallback = { ...nonSecretDefaults, language: 'en' as const };
        savedRef.current = fallback;
        setValues(fallback);
        setNote({ kind: 'key', key: 'settings.corrupt' });
        return;
      }
      savedRef.current = nonSecretDefaults;
      setValues(nonSecretDefaults);
      setNote({ kind: 'key', key: 'settings.defaults' });
    }).catch(() => {
      if (!cancelled) setNote({ kind: 'key', key: 'settings.unread' });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const discard = () => {
    setValues(savedRef.current);
    applyLanguage(savedRef.current.language);
    setPending(false);
  };
  const closeFromEscape = () => {
    discard();
    setOpen(false);
  };
  const closeFromEscapeRef = useRef(closeFromEscape);
  closeFromEscapeRef.current = closeFromEscape;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.select-content[data-state="open"]')) {
        window.dispatchEvent(new Event(CLOSE_OPEN_SELECT));
        return;
      }
      if (!document.querySelector('.settings-dialog[data-state="open"]')) return;
      closeFromEscapeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const draftError = settingsWriteError(values);
  const dirty = !sameSettings(values, savedRef.current);
  const saveDisabled = pending || !dirty || draftError !== null;
  const explained = draftError
    ? explainError(translate, draftError)
    : note.kind === 'error'
      ? explainError(translate, note.code)
      : null;
  const statusText = explained?.summary ?? translate(note.kind === 'key' ? note.key : 'settings.saveFailed');
  const invalidFields = draftError === 'Settings cannot store a secret' ? secretBearingFields(values) : [];
  const fieldError = (name: string) => (
    invalidFields.includes(name)
      ? { 'aria-invalid': true as const, 'aria-describedby': 'settings-draft-error' }
      : {}
  );

  const holdSession = async () => {
    const held = await window.electronAPI.llmSetSessionKey(sessionKey);
    setSessionKey('');
    setSessionNote(String(t(held.held ? 'settings.sessionHeld' : 'settings.sessionCleared')));
    onSessionRef.current(held.source);
  };
  const clearSession = async () => {
    const held = await window.electronAPI.llmSetSessionKey('');
    setSessionKey('');
    setSessionNote(String(t('settings.sessionCleared')));
    onSessionRef.current(held.source);
  };
  const storeOsKey = async () => {
    const saved = await window.electronAPI.saveSecret(osKey);
    setOsKey('');
    const status = await window.electronAPI.secretStatus();
    setSecretReason(status.reason);
    setSecretPersist(status.persist);
    setSecretStored(status.stored);
    if (saved.status !== 'stored') {
      setActionNote(explainError(translate, status.reason).summary);
      return;
    }
    const session = await window.electronAPI.llmSessionStatus();
    onSessionRef.current(session.source);
  };
  const removeStoredKey = async () => {
    await window.electronAPI.forgetSecret();
    setSecretStored(false);
    setOsKey('');
    onSessionRef.current('none');
    setSessionNote(String(t('settings.storedRemoved')));
  };
  const readCatalog = async () => {
    const result = await window.electronAPI.readComfy();
    if (!result.ok) {
      setActionNote(explainError(translate, result.error).summary);
      return;
    }
    setActionNote(String(t('settings.comfyRead', { version: result.version, devices: result.devices, nodes: result.nodes })));
  };
  const readMcp = async () => {
    setActionNote(String(t('settings.saving')));
    const result = await window.electronAPI.readMcp();
    if (!result.ok) {
      setActionNote(explainError(translate, result.error).summary);
      return;
    }
    const objectInfo = String(t(
      result.objectInfo === 'mcp' ? 'settings.mcpObjectInfoMcp' : result.objectInfo === 'native' ? 'settings.mcpObjectInfoNative' : 'settings.mcpObjectInfoNone',
    ));
    const summary = String(t('settings.mcpRead', { tools: result.tools, nodes: result.nodes, models: result.models, objectInfo }));
    const skipped = result.skipped.length > 0 ? ` ${String(t('settings.mcpSkipped', { items: result.skipped.join(', ') }))}` : '';
    setActionNote(`${summary}${skipped}`);
  };
  const holdMcpToken = async () => {
    const held = await window.electronAPI.mcpSetToken(mcpTokenDraft);
    setMcpTokenDraft('');
    setMcpNote(String(t(held.held ? 'settings.mcpTokenHeld' : 'settings.mcpTokenCleared')));
  };
  const clearMcpToken = async () => {
    await window.electronAPI.mcpSetToken('');
    setMcpTokenDraft('');
    setMcpNote(String(t('settings.mcpTokenCleared')));
  };
  const checkGraph = async () => {
    const result = await window.electronAPI.graphCompatibility();
    if (!result.ok) {
      setActionNote(explainError(translate, result.error).summary);
      return;
    }
    const none = String(t('settings.noneMissing'));
    const models = result.missingModels.map((model) => `${model.directory}/${model.name}`);
    setActionNote(String(t('settings.graphChecked', {
      nodes: result.missingNodes.length > 0 ? result.missingNodes.join(', ') : none,
      models: models.length > 0 ? models.join(', ') : none,
    })));
  };

  const save = async () => {
    if (saveDisabled) return;
    setPending(true);
    try {
      const result = await window.electronAPI.saveSettings(values);
      if (!result.ok) {
        setNote({ kind: 'error', code: result.error });
        return;
      }
      savedRef.current = result.values;
      setValues(result.values);
      setNote({ kind: 'key', key: 'settings.saved' });
      applyMotion(result.values.motion);
      applyLanguage(result.values.language);
      onSavedRef.current(result.values);
      setOpen(false);
    } catch {
      setNote({ kind: 'key', key: 'settings.saveFailed' });
    } finally {
      setPending(false);
    }
  };

  const providers = [
    { value: '', label: String(t('settings.providerNone')) },
    { value: 'test', label: String(t('settings.providerTest')) },
    { value: 'openai', label: String(t('settings.providerOpenAI')) },
    { value: 'anthropic', label: String(t('settings.providerAnthropic')) },
    { value: 'google', label: String(t('settings.providerGoogle')) },
    { value: 'local', label: String(t('settings.providerLocal')) },
  ];
  const providerHint = values.provider === 'local'
    ? String(t('settings.providerLocalHint'))
    : values.provider === 'openai' || values.provider === 'anthropic' || values.provider === 'google'
      ? String(t('settings.cloudBaseUrlHint'))
      : '';
  const motionOptions = [
    { value: 'system', label: String(t('settings.motionSystem')) },
    { value: 'on', label: String(t('settings.motionOn')) },
    { value: 'reduced', label: String(t('settings.motionReduced')) },
    { value: 'off', label: String(t('settings.motionOff')) },
  ];
  const languages = [
    { value: 'en', label: String(t('settings.languageEnglish')) },
    { value: 'ru', label: String(t('settings.languageRussian')) },
  ];
  const panelClass = cx(styles.panel, 'settings-panel');
  const fieldClass = cx(styles.field, 'field');
  const hintClass = cx(styles.hint, 'field-hint');
  const rowClass = cx(styles.buttons, 'settings-buttons');

  return (
    <DialogRoot
      modal
      open={open}
      onOpenChange={(next) => {
        if (!next) discard();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" icon={triggerIcon}>{t('shell.settings')}</Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          ref={setContainer}
          className={cx(styles.dialog, 'settings-dialog')}
          aria-describedby="settings-lead"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const panel = document.querySelector('.settings-panel[data-state="active"]');
            panel?.querySelector<HTMLElement>('input:not([disabled]), [role="combobox"]')?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (!document.querySelector('.select-content[data-state="open"]')) return;
            event.preventDefault();
            window.dispatchEvent(new Event(CLOSE_OPEN_SELECT));
          }}
          onPointerDownOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('.select-content')) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('.select-content')) event.preventDefault();
          }}
        >
          <header className={cx(styles.header, 'settings-header')}>
            <DialogTitle className={cx(styles.heading, 'settings-heading')}>{t('settings.title')}</DialogTitle>
            <DialogDescription id="settings-lead" className={cx(styles.lead, 'settings-lead')}>
              {t('settings.lead')}
            </DialogDescription>
          </header>
          <TabsRoot
            value={section}
            onValueChange={(next) => setSection(next as Section)}
            orientation="vertical"
            className={cx(styles.layout, 'settings-layout')}
          >
            <TabsList className={cx(styles.nav, 'settings-nav')} aria-label={String(t('settings.sections'))} tabIndex={-1}>
              {SECTIONS.map((item) => (
                <TabsTrigger key={item} className={cx(styles.tab, 'settings-tab')} value={item} tabIndex={section === item ? 0 : -1}>
                  {t(SECTION_LABELS[item])}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent className={panelClass} value="connection" tabIndex={-1}>
              <h3>{t('settings.connection')}</h3>
              <label className={fieldClass}>
                {t('settings.comfyOrigin')}
                <input
                  aria-label={String(t('settings.comfyOrigin'))}
                  value={values.comfyOrigin}
                  onChange={(event) => setValues((current) => ({ ...current, comfyOrigin: event.target.value }))}
                  {...fieldError('comfyOrigin')}
                />
              </label>
              <p className={hintClass}>{t('settings.comfyOriginHint')}</p>
              <label className={fieldClass}>
                {t('settings.mcpUrl')}
                <input
                  aria-label={String(t('settings.mcpUrl'))}
                  value={values.mcpUrl}
                  onChange={(event) => setValues((current) => ({ ...current, mcpUrl: event.target.value }))}
                  {...fieldError('mcpUrl')}
                />
              </label>
              <p className={hintClass}>{t('settings.mcpUrlHint')}</p>
              <label className={fieldClass}>
                {t('settings.mcpToken')}
                <input
                  type="password"
                  autoComplete="off"
                  aria-label={String(t('settings.mcpToken'))}
                  value={mcpTokenDraft}
                  onChange={(event) => setMcpTokenDraft(event.target.value)}
                />
              </label>
              <div className={rowClass}>
                <Button size="sm" disabled={mcpTokenDraft.length === 0} onClick={() => void holdMcpToken()}>
                  {t('settings.useMcpToken')}
                </Button>
                <Button size="sm" onClick={() => void clearMcpToken()}>
                  {t('settings.clearMcpToken')}
                </Button>
              </div>
              {mcpNote ? <p className={hintClass} role="status">{mcpNote}</p> : null}
              <div className={rowClass}>
                <Button size="sm" variant="subtle" disabled={pending || dirty || values.mcpUrl.trim() === ''} onClick={() => void readMcp()}>
                  {t('settings.readMcp')}
                </Button>
                <Button size="sm" variant="subtle" disabled={pending || dirty || values.comfyOrigin.trim() === ''} onClick={() => void readCatalog()}>
                  {t('settings.readComfy')}
                </Button>
                <Button size="sm" variant="subtle" disabled={pending} onClick={() => void checkGraph()}>
                  {t('settings.checkGraph')}
                </Button>
              </div>
              {actionNote ? <p className={hintClass} role="status">{actionNote}</p> : null}
              {secretPersist ? (
                <>
                  <label className={fieldClass}>
                    {t('settings.osKey')}
                    <input
                      type="password"
                      autoComplete="off"
                      aria-label={String(t('settings.osKey'))}
                      value={osKey}
                      onChange={(event) => setOsKey(event.target.value)}
                    />
                  </label>
                  <div className={rowClass}>
                    <Button size="sm" disabled={osKey.length === 0} onClick={() => void storeOsKey()}>
                      {t('settings.saveStoredKey')}
                    </Button>
                    {secretStored ? (
                      <Button size="sm" variant="danger" onClick={() => void removeStoredKey()}>
                        {t('settings.removeStored')}
                      </Button>
                    ) : null}
                  </div>
                  {secretStored ? <p className={hintClass} role="status">{t('settings.storedKey')}</p> : null}
                </>
              ) : (
                <>
                  <label className={fieldClass}>
                    {t('settings.apiKey')}
                    <input
                      type="password"
                      aria-label={String(t('settings.apiKey'))}
                      aria-describedby="key-unavailable"
                      value=""
                      disabled
                      readOnly
                    />
                  </label>
                  <p id="key-unavailable" className={hintClass}>{t('settings.keyReason')}</p>
                  <Button size="sm" className={styles.single} disabled>
                    {t('settings.saveKey')}
                  </Button>
                </>
              )}
              <label className={fieldClass}>
                {t('settings.sessionKey')}
                <input
                  type="password"
                  autoComplete="off"
                  aria-label={String(t('settings.sessionKey'))}
                  value={sessionKey}
                  onChange={(event) => setSessionKey(event.target.value)}
                />
              </label>
              <p className={hintClass}>{secretReason ? explainError(translate, secretReason).summary : ''}</p>
              <div className={rowClass}>
                <Button size="sm" disabled={sessionKey.length === 0} onClick={() => void holdSession()}>
                  {t('settings.useSession')}
                </Button>
                <Button size="sm" onClick={() => void clearSession()}>
                  {t('settings.clearSession')}
                </Button>
              </div>
              {sessionNote ? <p className={hintClass} role="status">{sessionNote}</p> : null}
            </TabsContent>
            <TabsContent className={panelClass} value="assistant" tabIndex={-1}>
              <h3>{t('settings.assistant')}</h3>
              <SelectField
                label={String(t('settings.provider'))}
                value={values.provider}
                options={providers}
                container={container}
                onChange={(provider) => setValues((current) => ({ ...current, provider: provider as NonSecretSettings['provider'] }))}
              />
              {providerHint ? <p className={hintClass}>{providerHint}</p> : null}
              <label className={fieldClass}>
                {t('settings.model')}
                <input
                  aria-label={String(t('settings.model'))}
                  value={values.model}
                  onChange={(event) => setValues((current) => ({ ...current, model: event.target.value }))}
                  {...fieldError('model')}
                />
              </label>
              <label className={fieldClass}>
                {t('settings.baseUrl')}
                <input
                  aria-label={String(t('settings.baseUrl'))}
                  value={values.baseURL}
                  onChange={(event) => setValues((current) => ({ ...current, baseURL: event.target.value }))}
                  {...fieldError('baseURL')}
                />
              </label>
              <p className={hintClass}>{t('settings.baseUrlHint')}</p>
            </TabsContent>
            <TabsContent className={panelClass} value="appearance" tabIndex={-1}>
              <h3>{t('settings.appearance')}</h3>
              <SelectField
                label={String(t('settings.motion'))}
                value={values.motion}
                options={motionOptions}
                container={container}
                onChange={(motion) => setValues((current) => ({ ...current, motion: motion as NonSecretSettings['motion'] }))}
              />
              <p className={hintClass}>{t('settings.motionHint')}</p>
              <SelectField
                id="settings-language"
                label={String(t('settings.language'))}
                value={values.language}
                options={languages}
                container={container}
                onChange={(language) => {
                  const next = language as AppLanguage;
                  setValues((current) => ({ ...current, language: next }));
                  applyLanguage(next);
                }}
              />
              <p className={hintClass}>{t('settings.languageHint')}</p>
            </TabsContent>
            <TabsContent className={panelClass} value="sync" tabIndex={-1}>
              <h3>{t('settings.sync')}</h3>
              <SyncSection fieldClass={fieldClass} hintClass={hintClass} rowClass={rowClass} />
            </TabsContent>
          </TabsRoot>
          <footer className={cx(styles.actions, 'settings-actions')}>
            <p id="settings-draft-error" className={cx(styles.status, 'provider-note')} role="status">{statusText}</p>
            <p className={hintClass}>{t('settings.keyReason')}</p>
            <div className={rowClass}>
              <Button variant="primary" className={cx(styles.save, 'settings-save')} disabled={saveDisabled} onClick={() => void save()}>
                <span className={styles.saveReserve} aria-hidden="true">{t('settings.save')}</span>
                <span className="settings-save-current">{pending ? t('settings.saving') : t('settings.save')}</span>
              </Button>
              <DialogClose asChild>
                <Button>{t('settings.cancel')}</Button>
              </DialogClose>
            </div>
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  );
}
