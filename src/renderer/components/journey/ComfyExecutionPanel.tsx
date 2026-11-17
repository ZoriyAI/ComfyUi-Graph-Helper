/** Explicit read-only queue observation with prompt selection and resource-specific recovery explanations. */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { comfyExecutionRequest, executionReason, executionStage, type ComfyExecutionSnapshot } from '../../../shared/contracts/comfyExecution';
import { executionReport } from '../../../shared/journey/executionReport';
import { useJourneyStore } from '../../state/journeyState';
import { useUiStore } from '../../state/uiState';
import { useDockStore } from '../../state/dockState';
import { getChatService } from '../../services/llm/chatService';
import { writeClipboard } from '../../services/diagnostics/diagnostics';
import Button from '../../ui/Button';
import MemoryPanel from '../assistant/MemoryPanel';
import styles from './Journey.module.css';

export default function ComfyExecutionPanel() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [snapshot, setSnapshot] = useState<ComfyExecutionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'failed' | 'invalid' | 'copied' | 'copyFailed' | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const pending = useRef(false);
  const read = async (selected = prompt) => {
    if (pending.current) return;
    const parsed = comfyExecutionRequest.safeParse(selected.trim() ? { promptId: selected.trim() } : {});
    if (!parsed.success) { setSnapshot(null); setNotice('invalid'); return; }
    pending.current = true; setBusy(true); setNotice(null);
    // Clear stale evidence before starting: a failed refresh must not leave an old idle result as current.
    setSnapshot(null);
    try { setSnapshot(await window.electronAPI.comfyExecution(parsed.data)); }
    catch { setNotice('failed'); }
    finally { pending.current = false; setBusy(false); }
  };
  const report = snapshot ? executionReport(snapshot) : '';
  const guard = snapshot?.guard.ok && snapshot.guard.value.installed ? snapshot.guard.value : null;
  const choices = snapshot?.queue.ok ? [...new Set([...snapshot.queue.value.running, ...snapshot.queue.value.pending])].slice(0, 10) : [];
  const memory = (bytes: number | null) => bytes === null ? String(t('comfyExecution.unknown')) : `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  const budgetKeys = ['vram_available_bytes', 'vram_required_bytes', 'ram_available_bytes', 'ram_required_bytes', 'ram_floor_bytes'] as const;
  return <section className={styles.execution} aria-label={String(t('comfyExecution.title'))}>
    <h3>{t('comfyExecution.title')}</h3><p>{t('comfyExecution.lead')}</p>
    <label className={styles.label} htmlFor="comfy-execution-prompt">{t('comfyExecution.prompt')}</label>
    <input id="comfy-execution-prompt" className={styles.promptId} value={prompt} maxLength={128} spellCheck={false}
      aria-describedby="comfy-execution-prompt-help" onChange={event => setPrompt(event.target.value)} />
    <p id="comfy-execution-prompt-help" className={styles.note}>{t('comfyExecution.promptHelp')}</p>
    <div className={styles.row}><Button size="sm" disabled={busy} onClick={() => void read()}>{t(busy ? 'comfyExecution.reading' : snapshot ? 'comfyExecution.refresh' : 'comfyExecution.check')}</Button>
      <Button size="sm" variant="subtle" onClick={() => { useJourneyStore.getState().close(); useUiStore.getState().openSettings('connection'); }}>{t('comfyExecution.connections')}</Button></div>
    <p role="status">{notice ? t(`comfyExecution.${notice}`) : busy ? t('comfyExecution.reading') : ''}</p>
    {snapshot ? <div className={styles.stepText} data-execution-stage={executionStage(snapshot)}>
      <strong role="status">{t(`comfyExecution.stage.${executionStage(snapshot)}`)}</strong>
      <p className={styles.note}>{t('comfyExecution.measured', { time: new Date(snapshot.measuredAt).toLocaleTimeString() })}</p>
      {snapshot.queue.ok ? <p>{t('comfyExecution.pending', { count: snapshot.queue.value.pending.length })} · {t('comfyExecution.running', { count: snapshot.queue.value.running.length })}</p> : null}
      <div className={styles.row}>{choices.map(id => <Button key={id} size="sm" variant="subtle" disabled={busy}
        onClick={() => { setPrompt(id); void read(id); }}>{t('comfyExecution.select', { id })}</Button>)}</div>
      {guard ? <div className={styles.noteItem}>
        {guard.promptId && snapshot.promptId && guard.promptId !== snapshot.promptId ? <strong>{t('comfyExecution.guardOther', { id: guard.promptId })}</strong> : null}
        {!guard.checkedAt || Date.now() - guard.checkedAt > 30_000 ? <p>{t('comfyExecution.stale')}</p> : null}
        <p>{t(`comfyExecution.reason.${executionReason(guard)}`)}</p>
        {guard.reasonCode ? <p>{t('comfyExecution.code')}: <code>{guard.reasonCode}</code></p> : null}
        {guard.reason ? <p>{t('comfyExecution.exact')}: <code>{guard.reason}</code></p> : null}
      </div> : <p>{t('comfyExecution.guardMissing')}</p>}
      {guard && budgetKeys.some(key => guard.budgets[key] !== undefined) ? <div>
        <h4>{t('comfyExecution.budgetsTitle')}</h4>
        <dl className={styles.budgets}>{budgetKeys.filter(key => guard.budgets[key] !== undefined).map(key => <div key={key}>
          <dt>{t(`comfyExecution.budgets.${key}`)}</dt><dd>{memory(guard.budgets[key])}</dd>
        </div>)}</dl>
        <p className={styles.note}>{t('comfyExecution.budgetsHelp')}</p>
      </div> : null}
      <h4>{t('comfyExecution.hardwareTitle')}</h4>
      {snapshot.hardware ? <ul>
        <li>{t('comfyExecution.hardwareRam', { free: memory(snapshot.hardware.ramFree), total: memory(snapshot.hardware.ramTotal) })}</li>
        {snapshot.hardware.devices.map((device, index) => <li key={index}>{t('comfyExecution.hardwareGpu', { name: device.name || device.type, free: memory(device.free), total: memory(device.total) })}</li>)}
      </ul> : <p>{t('comfyExecution.hardwareMissing')}</p>}
      {(['queue', 'guard', 'history'] as const).map(part => {
        const got = snapshot[part];
        return got && !got.ok ? <p key={part}>{t('comfyExecution.readError', { part: t(`comfyExecution.${part}`), reason: t(`comfyExecution.errors.${got.error}`, { defaultValue: t('comfyExecution.failed') }) })}</p> : null;
      })}
      {snapshot.history?.ok && snapshot.history.value.error ? <p>{snapshot.history.value.error}</p> : null}
      <h4>{t('comfyExecution.configuredAssistant')}</h4>
      {!snapshot.assistant ? <p>{t('comfyExecution.noAssistant')}</p> : !snapshot.assistant.status.ok ? <p>{t('comfyExecution.unknownAssistant')}</p>
        : snapshot.assistant.status.models.length === 0 ? <p>{t('comfyExecution.idleAssistant')}</p>
        : <ul>{snapshot.assistant.status.models.slice(0, 20).map(model => <li key={model.name}>{t('comfyExecution.resident', { name: model.name, memory: memory(model.vramBytes) })}</li>)}</ul>}
      <p className={styles.note}>{t('comfyExecution.assistantScope')}</p>
      <p>{t('comfyExecution.preserve')}</p>
      <div className={styles.row}><Button size="sm" onClick={() => void writeClipboard(report).then(ok => setNotice(ok ? 'copied' : 'copyFailed'))}>{t('comfyExecution.copy')}</Button>
        <Button size="sm" variant="subtle" onClick={() => {
          useJourneyStore.getState().close(); useDockStore.getState().show('assistant');
          void getChatService().sendMessage(String(t('comfyExecution.askMessage', { report: report.slice(0, 10_000) })));
        }}>{t('comfyExecution.ask')}</Button></div>
      <details><summary>{t('comfyExecution.details')}</summary><pre className={styles.report}>{report}</pre></details>
    </div> : null}
    <details onToggle={event => setMemoryOpen(event.currentTarget.open)}><summary>{t('comfyExecution.memory')}</summary>{memoryOpen ? <MemoryPanel /> : null}</details>
  </section>;
}
