import React, { useEffect, useState } from 'react';
import { Radar } from 'lucide-react';
import type { ConnectionSuggestions, McpOAuthStatus } from '../../../../shared/contracts';
import { useTranslation } from 'react-i18next';
import { explainError, type Translator } from '../../../../shared/i18n';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import SuggestField from '../../../ui/SuggestField';
import { refreshSyncStatus, useKnowledgeStore } from '../../../state/knowledgeState';
import { formatSyncTime, syncView } from '../../sync/syncView';
import { mcpUrlNeedsHttps } from '../../../../shared/mcp/loopback';
import styles from '../SettingsPanel.module.css';
import { fieldClass, hintClass, rowClass, SectionHead, type DraftProps } from './common';
import { addressSuggestions } from './pickerItems';

const STATE_TONES = { never: 'neutral', idle: 'ok', running: 'accent', error: 'danger' } as const;

/** Settings ▸ Connection: the MCP server URL, the Comfy origin, and the read-only checks. */
export default function ConnectionSection({ values, setValues, fieldError, pending, dirty, container }: DraftProps) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const status = useKnowledgeStore((state) => state.sync);
  const view = syncView(status);
  const [actionNote, setActionNote] = useState('');
  const [known, setKnown] = useState<ConnectionSuggestions | null>(null);
  const [looking, setLooking] = useState(false);
  // Addresses to pick from: what the MCP server named, what is saved, what was used before, what answers here.
  // Opening the section reads only what the app already knows; the button also looks on this computer.
  const lookForAddresses = (probe: boolean) => {
    setLooking(true);
    window.electronAPI.connectionSuggestions(probe)
      .then(setKnown)
      .catch(() => setKnown({ comfyOrigins: [], mcpUrls: [] }))
      .finally(() => setLooking(false));
  };
  useEffect(() => {
    lookForAddresses(false);
  }, []);
  const comfyOptions = addressSuggestions(known?.comfyOrigins ?? [], translate);
  const mcpOptions = addressSuggestions(known?.mcpUrls ?? [], translate);
  const addressAction = { label: String(t('picker.lookAgain')), onClick: () => lookForAddresses(true), loading: looking, disabled: pending, icon: <Radar size={14} aria-hidden="true" /> };
  const addressStatus = looking ? { text: String(t('picker.addressesLoading')) } : null;

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

  return (
    <>
      <SectionHead title={String(t('preferences.connectionTitle'))} lead={String(t('preferences.lead.connection'))} />
      <SuggestField
        className={fieldClass}
        label={String(t('settings.comfyOrigin'))}
        value={values.comfyOrigin}
        onChange={(text) => setValues((current) => ({ ...current, comfyOrigin: text }))}
        inputProps={fieldError('comfyOrigin')}
        suggestions={comfyOptions}
        pickerLabel={String(t('picker.comfyList'))}
        placeholder={String(t('picker.addressPlaceholder', { count: comfyOptions.length }))}
        emptyText={String(t('picker.addressEmpty'))}
        action={addressAction}
        status={addressStatus}
        container={container}
      />
      <p className={hintClass}>{t('settings.comfyOriginHint')}</p>
      <SuggestField
        className={fieldClass}
        label={String(t('settings.mcpUrl'))}
        value={values.mcpUrl}
        onChange={(text) => setValues((current) => ({ ...current, mcpUrl: text }))}
        inputProps={fieldError('mcpUrl')}
        suggestions={mcpOptions}
        pickerLabel={String(t('picker.mcpList'))}
        placeholder={String(t('picker.addressPlaceholder', { count: mcpOptions.length }))}
        emptyText={String(t('picker.addressEmpty'))}
        container={container}
      />
      <p className={hintClass}>{t('settings.mcpUrlHint')}</p>
      {mcpUrlNeedsHttps(values.mcpUrl) ? <p className={styles.errorNote} role="alert">{t('errors.mcpHttps')}</p> : null}
      <McpSignIn savedUrl={!dirty && values.mcpUrl.trim() !== ''} disabled={pending} />
      <div className={styles.stateLine}>
        <Badge tone={STATE_TONES[view.state]}>{t('preferences.connectionState', { state: t(view.labelKey) })}</Badge>
        {view.blocked ? <span className={hintClass}>{t(view.blocked === 'noUrl' ? 'sync.noUrl' : 'sync.noToken')}</span> : null}
      </div>
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
    </>
  );
}

/**
 * "Sign in through the browser": OAuth to the saved MCP URL. Main opens the system browser and keeps the tokens;
 * this row only shows the status. The manual token in Models & keys stays as the alternative.
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
    <div className="mcp-sign-in" data-oauth-state={state}>
      <p className={hintClass}><strong>{t('settings.oauthTitle')}</strong> {t('settings.oauthHint')}</p>
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
      {note ? <p className={styles.errorNote} role="alert">{note}</p> : null}
    </div>
  );
}
