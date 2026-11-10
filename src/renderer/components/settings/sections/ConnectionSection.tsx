import React, { useEffect, useState } from 'react';
import { Radar, ShieldCheck } from 'lucide-react';
import type { ConnectionSuggestions } from '../../../../shared/contracts';
import { useTranslation } from 'react-i18next';
import { explainError, type Translator } from '../../../../shared/i18n';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import SuggestField from '../../../ui/SuggestField';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { syncView } from '../../sync/syncView';
import { accessErrorText, detectionNote, type DetectionNote } from '../mcpAccess';
import McpAccess from './McpAccess';
import { mcpUrlNeedsHttps } from '../../../../shared/mcp/loopback';
import styles from '../SettingsPanel.module.css';
import { fieldClass, hintClass, rowClass, SectionHead, type DraftProps } from './common';
import { addressSuggestions } from './pickerItems';

const STATE_TONES = { never: 'neutral', idle: 'ok', running: 'accent', error: 'danger' } as const;

/**
 * Settings ▸ Connection: the Comfy origin, the MCP server address with "Check", how the app gets into that server
 * (no sign-in, a token, or a browser sign-in), and the read-only checks.
 */
export default function ConnectionSection({ values, setValues, saved, fieldError, pending, dirty, container }: DraftProps) {
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

  // "Check" asks the server at the typed address (saved or not) what it wants, and selects that in the draft.
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectionNote | null>(null);
  const [checkedUrl, setCheckedUrl] = useState('');
  const [focusToken, setFocusToken] = useState(0);
  const mcpUrl = values.mcpUrl.trim();
  const checkAccess = async () => {
    setDetecting(true);
    setDetected(null);
    try {
      const note = detectionNote(await window.electronAPI.mcpDetectAuth(mcpUrl), translate);
      const mode = note.mode;
      if (mode) setValues((current) => ({ ...current, mcpAuth: mode }));
      // The server wants a token and none is accepted yet: the next thing to do is paste it, so the field takes focus.
      if (mode === 'token' && note.tone !== 'good') setFocusToken((count) => count + 1);
      else if (mode === 'token' && !status?.tokenHeld) setFocusToken((count) => count + 1);
      setDetected(note);
    } catch {
      setDetected({ mode: null, text: explainError(translate, 'MCP server was not read.').summary, tone: 'bad' });
    } finally {
      setCheckedUrl(mcpUrl);
      setDetecting(false);
    }
  };
  // The sentence is about the address it checked; a new address makes it stale.
  const detectStatus = detecting
    ? { text: String(t('settings.checkingAccess')) }
    : detected && checkedUrl === mcpUrl ? { text: detected.text, tone: detected.tone } : null;
  const checkAction = {
    label: String(t('settings.checkAccess')),
    onClick: () => void checkAccess(),
    loading: detecting,
    disabled: pending || mcpUrl === '',
    icon: <ShieldCheck size={14} aria-hidden="true" />,
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
      setActionNote(accessErrorText(result.error, status, translate));
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
        label={String(t('settings.mcpUrl'))}
        value={values.mcpUrl}
        onChange={(text) => setValues((current) => ({ ...current, mcpUrl: text }))}
        inputProps={fieldError('mcpUrl')}
        suggestions={mcpOptions}
        pickerLabel={String(t('picker.mcpList'))}
        placeholder={String(t('picker.addressPlaceholder', { count: mcpOptions.length }))}
        emptyText={String(t('picker.addressEmpty'))}
        action={checkAction}
        status={detectStatus}
        container={container}
      />
      <p className={hintClass}>{t('settings.mcpUrlHint')}</p>
      {mcpUrlNeedsHttps(values.mcpUrl) ? <p className={styles.errorNote} role="alert">{t('errors.mcpHttps')}</p> : null}
      <McpAccess
        value={values.mcpAuth}
        savedValue={saved.mcpAuth}
        onChange={(mcpAuth) => setValues((current) => ({ ...current, mcpAuth }))}
        mcpUrl={values.mcpUrl}
        savedUrl={mcpUrl !== '' && mcpUrl === saved.mcpUrl.trim()}
        disabled={pending}
        focusToken={focusToken}
      />
      {/* The ComfyUI address itself is optional: the server names it. It comes after the things everyone needs. */}
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
      <div className={styles.stateLine}>
        {/* The label can carry numbers (the metadata counter): it is translated with the view's own values. */}
        <Badge tone={STATE_TONES[view.state]}>{t('preferences.connectionState', { state: t(view.labelKey, view.labelParams ?? {}) })}</Badge>
        {/* "Set the address first" is moot while one is typed right above. */}
        {view.hintKey && !(view.hintKey === 'sync.noUrl' && mcpUrl !== '') ? <span className={hintClass}>{t(view.hintKey)}</span> : null}
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
