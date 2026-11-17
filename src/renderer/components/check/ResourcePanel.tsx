/** Explain resource uncertainty alongside graph validation; an on-demand refresh only reads system_stats. */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, RefreshCw } from 'lucide-react';
import type { GraphResources } from '../../../shared/contracts/resources';
import { useProjectionStore } from '../../services/commands/projection';
import { requestAsk } from '../../services/ask';
import Button from '../../ui/Button';
import { useUiStore } from '../../state/uiState';
import styles from './ResourcePanel.module.css';
const gib = (bytes: number | null) => bytes == null ? '—' : `${(bytes / 1024 ** 3).toLocaleString(undefined, { maximumFractionDigits: 1 })} GiB`;
export default function ResourcePanel({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation(); const revision = useProjectionStore((s) => s.currentRevisionId);
  const [report, setReport] = useState<GraphResources | null>(null); const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  useEffect(() => { let alive = true; const timer = setTimeout(() => { void window.electronAPI.graphResources(projectId).then((value) => { if (alive) { setReport(value); setFailed(false); } }).catch(() => { if (alive) setFailed(true); }); }, 250); return () => { alive = false; clearTimeout(timer); }; }, [projectId, revision]);
  const refresh = async () => { setBusy(true); try { setReport(await window.electronAPI.graphResources(projectId, true)); setFailed(false); } catch { setFailed(true); } finally { setBusy(false); } };
  return <section className={styles.root} aria-label={String(t('resources.title'))}><h3><Cpu size={16} />{t('resources.title')}</h3><p className={styles.hint}>{t('resources.lead')}</p>
    <Button size="sm" disabled={busy} icon={<RefreshCw size={14} />} onClick={() => void refresh()}>{t(busy ? 'resources.reading' : 'resources.refresh')}</Button>
    {failed ? <p role="status">{t('resources.failed')}</p> : null}
    {report ? <><p className={styles.verdict} role="status" data-resource-verdict={report.verdict}>{t(`resources.verdict.${report.verdict}`)}</p>
      {report.hardware ? <><p>{t('resources.measured', { time: new Date(report.hardware.measuredAt).toLocaleString() })}</p><p>{t('resources.ram')}: {gib(report.hardware.ramFree)} / {gib(report.hardware.ramTotal)}</p>{report.hardware.devices.map((device, i) => <p key={i}>{device.name || device.type} · {t('resources.memory')}: {gib(device.free)} / {gib(device.total)}</p>)}</> : <p>{t('resources.noHardware')}</p>}
      <dl className={styles.facts}><div><dt>{t('resources.modelFiles')}</dt><dd>{report.models.length}</dd></div><div><dt>{t('resources.weights')}</dt><dd>{gib(report.totalWeightFileBytes)}</dd></div><div><dt>{t('resources.largest')}</dt><dd>{gib(report.largestWeightFileBytes)}</dd></div><div><dt>{t('resources.unknownSizes')}</dt><dd>{report.unknownSizes}</dd></div></dl>
      <p className={styles.hint}>{t('resources.estimateLimit')}</p>
      <p>{t('resources.dimensions', { width: report.resolution.width || '—', height: report.resolution.height || '—', frames: report.resolution.frames, batch: report.resolution.batch })}</p>
      <Button size="sm" variant="subtle" onClick={() => useUiStore.getState().showHelp('concepts/Graphics-Card-Memory')}>{t('resources.measuredExample')}</Button>
      {report.reasons.length ? <ul>{[...new Set(report.reasons)].map((reason) => <li key={reason}>{t(`resources.reason.${reason}`)}</li>)}</ul> : null}
      {report.missingClasses.length || report.missingModels.length ? <details><summary>{t('resources.missing')}</summary><ul>{report.missingClasses.map((c) => <li key={c}>{c}</li>)}{report.missingModels.map((m) => <li key={`${m.directory}/${m.name}`}>{m.directory}/{m.name}</li>)}</ul></details> : null}
      <details onToggle={event => setStagesOpen(event.currentTarget.open)}><summary>{t('resources.stages', { count: report.stages.length })}</summary>{stagesOpen ? <ol>{report.stages.map((stage, index) => <li key={`${stage.subgraphId ?? ''}:${stage.nodeId}:${index}`}><strong>{stage.title}</strong> · {stage.classType}<small>{stage.models.join(', ')}</small></li>)}</ol> : null}</details>
      <Button size="sm" variant="subtle" onClick={() => requestAsk({ context: { intent: 'ask', selection: [], language: i18n.language.startsWith('en') ? 'en' : 'ru', objectRef: { kind: 'process', id: 'process' } }, message: String(t('resources.ask')) })}>{t('resources.askButton')}</Button>
    </> : null}
  </section>;
}
