import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { explainError, type Translator } from '../../../../shared/i18n';
import Badge from '../../../ui/Badge';
import Button from '../../../ui/Button';
import { useKnowledgeStore } from '../../../state/knowledgeState';
import { syncView } from '../../sync/syncView';
import styles from '../SettingsPanel.module.css';
import { fieldClass, hintClass, rowClass, SectionHead, type DraftProps } from './common';

const STATE_TONES = { never: 'neutral', idle: 'ok', running: 'accent', error: 'danger' } as const;

/** Settings ▸ Connection: the MCP server URL, the Comfy origin, and the read-only checks. */
export default function ConnectionSection({ values, setValues, fieldError, pending, dirty }: DraftProps) {
  const { t } = useTranslation();
  const translate: Translator = (key, options) => (options ? String(t(key, options)) : String(t(key)));
  const status = useKnowledgeStore((state) => state.sync);
  const view = syncView(status);
  const [actionNote, setActionNote] = useState('');

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
      <label className={fieldClass}>
        {t('settings.comfyOrigin')}
        <input
          aria-label={String(t('settings.comfyOrigin'))}
          value={values.comfyOrigin}
          spellCheck={false}
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
          spellCheck={false}
          onChange={(event) => setValues((current) => ({ ...current, mcpUrl: event.target.value }))}
          {...fieldError('mcpUrl')}
        />
      </label>
      <p className={hintClass}>{t('settings.mcpUrlHint')}</p>
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
