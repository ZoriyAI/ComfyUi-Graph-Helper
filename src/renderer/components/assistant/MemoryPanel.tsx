/** Shows verified assistant memory status and controls release or explicit resumption of requests. */
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryStick } from 'lucide-react';
import type { AssistantMemoryState } from '../../../shared/contracts/localModels';
import Button from '../../ui/Button';
import styles from './MemoryPanel.module.css';

/** Main owns the pause across every connected device. Merely opening this card never loads a model. */
export default function MemoryPanel({ active = true }: { active?: boolean }) {
  const { t } = useTranslation();
  const [state, setState] = useState<AssistantMemoryState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const reading = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const ticket = ++generation.current;
    if (!active) return;
    const read = () => {
      if (pending.current) return;
      const query = ++reading.current;
      void window.electronAPI.assistantMemoryStatus().then(result => {
        if (ticket === generation.current && query === reading.current && !pending.current) { setState(result); setFailed(false); }
      }).catch(() => { if (ticket === generation.current && query === reading.current && !pending.current) setFailed(true); });
    };
    read(); const timer = window.setInterval(read, 3000);
    return () => { generation.current += 1; clearInterval(timer); };
  }, [active]);
  const act = async (release: boolean) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailed(false);
    reading.current += 1;
    const ticket = generation.current;
    if (release) setState(previous => ({ phase: 'releasing', paused: true, models: previous?.models ?? [] }));
    try {
      const result = await (release ? window.electronAPI.assistantMemoryRelease() : window.electronAPI.assistantMemoryResume());
      if (ticket === generation.current) setState(result);
    } catch { if (ticket === generation.current) { setFailed(true); setState(null); } }
    finally { pending.current = false; setBusy(false); }
  };
  const releasing = busy || state?.phase === 'releasing';
  return <section className={styles.panel} aria-label={String(t('assistantMemory.title'))}>
    <h3><MemoryStick size={18} aria-hidden="true" />{t('assistantMemory.title')}</h3>
    <p>{t('assistantMemory.lead')}</p>
    <p className={styles.status} role="status" aria-live="polite">{t(failed ? 'assistantMemory.unavailable' : state ? `assistantMemory.${state.error === 'stop-failed' ? 'stopFailed' : state.phase}` : 'assistantMemory.checking')}</p>
    {state && state.phase !== 'active' && state.models.length > 0 ? <ul>{state.models.map((model, i) => <li key={`${model.name}-${i}`}><strong>{model.name}</strong> — {t(model.released ? 'assistantMemory.modelReleased' : state.phase === 'releasing' ? 'assistantMemory.modelWaiting' : 'assistantMemory.modelUnconfirmed')}</li>)}</ul> : null}
    <div className={styles.actions}>
      <Button size="sm" variant="primary" disabled={releasing} onClick={() => void act(true)}>{t(releasing ? 'assistantMemory.releasingButton' : state?.phase === 'partial' ? 'assistantMemory.retry' : 'assistantMemory.release')}</Button>
      {state?.paused && !releasing ? <Button size="sm" onClick={() => void act(false)}>{t('assistantMemory.resume')}</Button> : null}
    </div>
    <p>{t('assistantMemory.closeHint')}</p>
  </section>;
}
