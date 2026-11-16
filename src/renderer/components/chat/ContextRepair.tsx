/** Apply a verified Ollama window from the warning itself, without asking the person to edit a service. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import { useChatStore } from '../../state/chatState';
import { useUiStore } from '../../state/uiState';
import { usePreferencesStore } from '../../state/preferencesState';
import { useProviderStore } from '../../state/providerState';
import { SETTINGS_CHANGED } from '../../commands/events';
import { translateKnownError, type Translator } from '../../../shared/i18n';

export default function ContextRepair({ model }: { model: string }) {
  const { t } = useTranslation();
  const streaming = useChatStore(state => state.isStreaming);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const translate: Translator = (key, values) => String(t(key, values ?? {}));
  const apply = async () => {
    setBusy(true); setNote('');
    try {
      const read = await window.electronAPI.getSettings();
      if (!('values' in read) || !read.values || read.values.provider !== 'local' || read.values.model !== model) {
        setNote(String(t('contextSetup.changed'))); return;
      }
      const before = read.values;
      const result = await window.electronAPI.llmOllamaWindow(before, 0);
      if (!result.ok) { setNote(translateKnownError(translate, result.error) ?? String(t('contextSetup.failed'))); return; }
      const current = await window.electronAPI.getSettings();
      if (!('values' in current) || !current.values || ['provider', 'model', 'baseURL'].some(key => current.values[key as keyof typeof before] !== before[key as keyof typeof before])) {
        setNote(String(t('contextSetup.changed'))); return;
      }
      const saved = await window.electronAPI.saveSettings({ ...current.values, model: result.model,
        preferences: { assistant: { contextTokens: 0 }, providers: { local: { model: result.model, baseURL: before.baseURL } } } });
      if (!saved.ok) { setNote(String(t('contextSetup.failed'))); return; }
      if (saved.preferences) usePreferencesStore.getState().setPreferences(saved.preferences);
      await useProviderStore.getState().showStored(saved.values, true);
      window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED, { detail: saved.values }));
      setNote(String(t('contextSetup.saved', { window: result.contextTokens })));
    } catch { setNote(String(t('contextSetup.failed'))); }
    finally { setBusy(false); }
  };
  return <div className="context-repair">
    <p>{t('contextSetup.lead')}</p>
    <Button size="sm" variant="primary" loading={busy} disabled={busy || streaming} onClick={() => void apply()}>{t('contextSetup.autoButton')}</Button>
    <Button size="sm" variant="ghost" disabled={busy} onClick={() => useUiStore.getState().openSettings('assistant')}>{t('contextSetup.settings')}</Button>
    {note ? <p role="status">{note}</p> : null}
  </div>;
}
