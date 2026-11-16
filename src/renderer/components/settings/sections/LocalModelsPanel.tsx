/** Model lifecycle controls on the configured server; status is read while this settings section is visible. */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalModelStatus } from '../../../../shared/contracts/localModels';
import type { ChatRuntimeConfig } from '../../../../shared/config/schema';
import Button from '../../../ui/Button';
import { useChatStore } from '../../../state/chatState';
import { getChatService } from '../../../services/llm/chatService';
import styles from './ProviderAdvice.module.css';

export default function LocalModelsPanel({ runtime, active }: { runtime: ChatRuntimeConfig; active: boolean }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LocalModelStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const streaming = useChatStore(state => state.isStreaming);
  const generation = useRef(0);
  const readSequence = useRef(0);
  const pending = useRef(false);
  const current = useRef(runtime); current.current = runtime;
  const read = async () => {
    if (pending.current) return;
    const ticket = generation.current;
    const sequence = ++readSequence.current;
    const valid = () => ticket === generation.current && sequence === readSequence.current && !pending.current;
    try { const result = await window.electronAPI.llmLocalStatus(current.current); if (valid()) setStatus(result); }
    catch { if (valid()) setStatus({ ok: false, error: '' }); }
  };
  useEffect(() => {
    generation.current += 1; setStatus(null);
    if (!active) return;
    void read();
    const timer = window.setInterval(() => void read(), 10_000);
    return () => { generation.current += 1; clearInterval(timer); };
  }, [runtime.provider, runtime.baseURL, active]);
  const control = async (model: string, action: 'load' | 'unload') => {
    if (pending.current) return;
    readSequence.current += 1;
    const ticket = generation.current; pending.current = true; setBusy(true);
    try {
      const result = await window.electronAPI.llmLocalControl(current.current, model, action);
      if (ticket === generation.current) setStatus(result);
    } catch { if (ticket === generation.current) setStatus({ ok: false, error: '' }); }
    finally { pending.current = false; setBusy(false); }
  };
  const memory = (bytes: number | null) => bytes === null ? String(t('localModels.unknown')) : `${(bytes / 1024 ** 3).toFixed(1)} ${String(t('localModels.gib'))}`;
  return <section className={`${styles.block} local-models-panel`} aria-label={String(t('localModels.title'))}>
    <h3 className={styles.title}>{t('localModels.title')}</h3>
    <p className={styles.line}>{t('localModels.lead')}</p>
    <div className="local-model-actions">
      <Button size="sm" variant="subtle" disabled={busy} onClick={() => void read()}>{t('localModels.refresh')}</Button>
      <Button size="sm" variant="subtle" disabled={busy || streaming || !runtime.model.trim() || !status?.ok} onClick={() => void control(runtime.model, 'load')}>{t('localModels.load')}</Button>
      {streaming ? <Button size="sm" variant="subtle" onClick={() => void getChatService().cancelAndWait()}>{t('localModels.stopAnswer')}</Button> : null}
    </div>
    {!status ? <p role="status">{t('localModels.checking')}</p> : !status.ok ? <p role="status">{t(status.error === 'Ollama did not confirm the model action.' ? 'localModels.actionFailed' : 'localModels.unavailable')}</p>
      : status.models.length === 0 ? <p role="status">{t('localModels.idle')}</p> : <ul className="local-model-list">
        {status.models.map(model => <li key={model.name}>
          <strong>{model.name}</strong>
          <p>{t('localModels.usage', { total: memory(model.bytes), vram: memory(model.vramBytes), context: model.contextTokens?.toLocaleString() ?? String(t('localModels.unknown')) })}</p>
          <Button size="sm" variant="subtle" disabled={busy || streaming} onClick={() => void control(model.name, 'unload')}>{t('localModels.unload')}</Button>
        </li>)}
      </ul>}
    <p className={styles.line}>{t('localModels.effects')}</p>
  </section>;
}
