import React, { useEffect, useState } from 'react';
import { Radar, ShieldCheck } from 'lucide-react';
import type { ConnectionSuggestions } from '../../../../shared/contracts';
import { useTranslation } from 'react-i18next';
import { explainError, type Translator } from '../../../../shared/i18n';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import SuggestField from '../../../ui/SuggestField';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { readSummary, sourceSentence, syncView } from '../../sync/syncView';
import { accessErrorText, detectionNote, type DetectionNote } from '../mcpAccess';
import McpAccess from './McpAccess';
import { isLoopbackHost, isPlausibleHost, mcpUrlNeedsHttps, withLoopbackScheme } from '../../../../shared/mcp/loopback';
import styles from '../SettingsPanel.module.css';
import { fieldClass, Group, hintClass, rowClass, SectionHead, type DraftProps } from './common';
import { addressSuggestions } from './pickerItems';

const STATE_TONES = { never: 'neutral', idle: 'ok', running: 'accent', error: 'danger' } as const;

/** Where a typed ComfyUI address points: this computer, another one (over http or https), or nowhere yet. */
export function comfyAddressPlace(value: string): 'empty' | 'local' | 'remoteHttp' | 'remoteHttps' | 'unknown' {
  const text = withLoopbackScheme(value);
  if (text === '') return 'empty';
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unknown';
    if (isLoopbackHost(url.hostname)) return 'local';
    if (!isPlausibleHost(url.hostname)) return 'unknown';
    return url.protocol === 'https:' ? 'remoteHttps' : 'remoteHttp';
  } catch {
    return 'unknown';
  }
}

type ComfyCheckNote = { text: string; tone: 'good' | 'bad' };

/**
 * Settings ▸ Connection. The ComfyUI address comes first: with it alone the app reads everything ComfyUI serves
 * (nodes, packs, model files, model headers and pictures). "Find on this computer" looks at the usual ports, "Check"
 * asks ComfyUI at the typed address. An MCP server is a second, optional section: it adds what ComfyUI does not
 * serve (descriptions next to models, pack README files, fingerprints), with its own address, access and "Check".
 */
export default function ConnectionSection({ values, setValues, saved, fieldError, pending, dirty, container }: DraftProps) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const status = useKnowledgeStore((state) => state.sync);
  const view = syncView(status);
  const [actionNote, setActionNote] = useState('');
  const [known, setKnown] = useState<ConnectionSuggestions | null>(null);
  const [looking, setLooking] = useState(false);
  const [foundNote, setFoundNote] = useState('');
  // Addresses to pick from: what is saved, what was used before, what answers here. Opening the section reads only
  // what the app already knows; "Find on this computer" also looks at the usual ports.
  const lookForAddresses = (probe: boolean) => {
    setLooking(true);
    if (probe) setFoundNote('');
    window.electronAPI.connectionSuggestions(probe)
      .then((next) => {
        setKnown(next);
        if (!probe) return;
        const found = next.comfyOrigins.filter((item) => item.source === 'probe').map((item) => item.value);
        // One ComfyUI found and the field empty: it takes that address. More than one: the person picks.
        if (found.length === 1 && values.comfyOrigin.trim() === '') setValues((current) => ({ ...current, comfyOrigin: found[0] }));
        setFoundNote(found.length > 0 ? String(t('settings.comfyFound', { list: found.join(', ') })) : String(t('settings.comfyFoundNone')));
      })
      .catch(() => setKnown({ comfyOrigins: [], mcpUrls: [] }))
      .finally(() => setLooking(false));
  };
  useEffect(() => {
    lookForAddresses(false);
  }, []);
  const comfyOptions = addressSuggestions(known?.comfyOrigins ?? [], translate);
  const mcpOptions = addressSuggestions(known?.mcpUrls ?? [], translate);

  // ComfyUI ▸ "Check": one read-only question to ComfyUI at the typed address (saved or not).
  const comfyOrigin = values.comfyOrigin.trim();
  const [comfyChecking, setComfyChecking] = useState(false);
  const [comfyChecked, setComfyChecked] = useState<{ address: string; note: ComfyCheckNote } | null>(null);
  const checkComfy = async () => {
    setComfyChecking(true);
    const address = comfyOrigin;
    try {
      const result = await window.electronAPI.checkComfy(address);
      if (result.ok) {
        // `127.0.0.1:8188` was checked as `http://127.0.0.1:8188`: the field takes the address that worked.
        if (result.origin !== address) setValues((current) => ({ ...current, comfyOrigin: result.origin }));
        setComfyChecked({ address: result.origin, note: { tone: 'good', text: String(t('settings.comfyAnswers', { version: result.version })) } });
      } else {
        setComfyChecked({ address, note: { tone: 'bad', text: explainError(translate, result.error).summary } });
      }
    } catch {
      setComfyChecked({ address, note: { tone: 'bad', text: explainError(translate, 'Comfy origin was not read.').summary } });
    } finally {
      setComfyChecking(false);
    }
  };
  const comfyStatus = comfyChecking
    ? { text: String(t('settings.comfyChecking')) }
    : comfyChecked && comfyChecked.address === comfyOrigin ? comfyChecked.note : looking ? { text: String(t('picker.addressesLoading')) } : null;
  const comfyAction = {
    label: String(t('settings.comfyCheck')),
    onClick: () => void checkComfy(),
    loading: comfyChecking,
    disabled: pending || comfyOrigin === '',
    icon: <ShieldCheck size={14} aria-hidden="true" />,
  };
  const place = comfyAddressPlace(values.comfyOrigin);

  // MCP ▸ "Check" asks the server at the typed address (saved or not) what it wants, and selects that in the draft.
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectionNote | null>(null);
  const [checkedUrl, setCheckedUrl] = useState('');
  const [focusToken, setFocusToken] = useState(0);
  const mcpUrl = values.mcpUrl.trim();
  const checkAccess = async () => {
    setDetecting(true);
    setDetected(null);
    let checkedFor = mcpUrl;
    try {
      const note = detectionNote(await window.electronAPI.mcpDetectAuth(mcpUrl), translate);
      const mode = note.mode;
      if (mode) setValues((current) => ({ ...current, mcpAuth: mode }));
      const completed = note.completedUrl;
      if (completed) {
        setValues((current) => ({ ...current, mcpUrl: completed }));
        checkedFor = completed;
      }
      // The server wants a token and none is accepted yet: the next thing to do is paste it, so the field takes focus.
      if (mode === 'token' && note.tone !== 'good') setFocusToken((count) => count + 1);
      else if (mode === 'token' && !status?.tokenHeld) setFocusToken((count) => count + 1);
      setDetected(note);
    } catch {
      setDetected({ mode: null, text: explainError(translate, 'MCP server was not read.').summary, tone: 'bad' });
    } finally {
      setCheckedUrl(checkedFor);
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
  // After a read through this server: what kind of server it is, in plain words (never a green "connected" for one
  // the app cannot read).
  const profile = status?.mcpUrl.trim() === mcpUrl && mcpUrl !== '' ? status?.mcpProfile ?? null : null;

  const readNow = async () => {
    setActionNote(String(t('settings.saving')));
    const result = await window.electronAPI.readMcp();
    if (!result.ok) {
      setActionNote(accessErrorText(result.error, status, translate));
      return;
    }
    // The read is the ordinary sync: the same summary and warnings as its toast.
    const summary = readSummary(result);
    const source = sourceSentence(useKnowledgeStore.getState().sync);
    const warnings = result.warnings.map((warning) => ` ${explainError(translate, warning).summary}`).join('');
    setActionNote(`${source ? `${String(t(source.key, { host: source.host }))} ` : ''}${String(t(summary.key, summary.params))}${warnings}`);
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
        action={comfyAction}
        status={comfyStatus}
        container={container}
      />
      <div className={rowClass}>
        <Button size="sm" variant="subtle" icon={<Radar size={14} aria-hidden="true" />} loading={looking} disabled={pending} onClick={() => lookForAddresses(true)}>
          {t('settings.comfyFind')}
        </Button>
      </div>
      {foundNote ? <p className={hintClass} role="status">{foundNote}</p> : null}
      <p className={hintClass}>{t('settings.comfyOriginHint')}</p>
      {place === 'remoteHttp' || place === 'remoteHttps' ? <p className={hintClass} data-hint="comfy-remote">{t('settings.comfyRemoteHint')}</p> : null}
      {place === 'remoteHttp' ? <p className={hintClass} data-hint="comfy-http">{t('settings.comfyHttpHint')}</p> : null}

      <div className={styles.stateLine}>
        {/* The label can carry numbers (the metadata counter): it is translated with the view's own values. */}
        <Badge tone={STATE_TONES[view.state]}>{t('preferences.connectionState', { state: t(view.labelKey, view.labelParams ?? {}) })}</Badge>
        {/* "Set the address first" is moot while one is typed right above. */}
        {view.hintKey && !(view.hintKey === 'sync.noUrl' && (mcpUrl !== '' || comfyOrigin !== '')) ? <span className={hintClass}>{t(view.hintKey)}</span> : null}
      </div>
      <div className={rowClass}>
        <Button size="sm" variant="subtle" disabled={pending || dirty || (mcpUrl === '' && comfyOrigin === '')} onClick={() => void readNow()}>
          {t('settings.readMcp')}
        </Button>
        <Button size="sm" variant="subtle" disabled={pending} onClick={() => void checkGraph()}>
          {t('settings.checkGraph')}
        </Button>
      </div>
      {actionNote ? <p className={hintClass} role="status">{actionNote}</p> : null}

      <Group title={String(t('settings.mcpSection'))}>
        <p className={hintClass}>{t('settings.mcpSectionLead')}</p>
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
        {profile ? <p className={profile === 'unknown' ? styles.errorNote : hintClass} data-mcp-profile={profile}>{t(`settings.mcpProfile.${profile}`)}</p> : null}
        <McpAccess
          value={values.mcpAuth}
          savedValue={saved.mcpAuth}
          onChange={(mcpAuth) => setValues((current) => ({ ...current, mcpAuth }))}
          mcpUrl={values.mcpUrl}
          savedUrl={mcpUrl !== '' && mcpUrl === saved.mcpUrl.trim()}
          disabled={pending}
          focusToken={focusToken}
        />
      </Group>
    </>
  );
}
