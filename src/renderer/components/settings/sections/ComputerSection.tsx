/** Useful host facts and next steps, also available before ComfyUI exists and from a paired phone. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HostHardwareSnapshot } from '../../../../shared/contracts/resources';
import { hostReadiness } from '../../../../shared/knowledge/hostReadiness';
import { useUiStore } from '../../../state/uiState';
import Button from '../../../ui/Button';
import type { JourneyLink } from '../../../../shared/journeyLinks';
import { SectionHead, hintClass } from './common';
import styles from './ServicesSection.module.css';

export default function ComputerSection({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<HostHardwareSnapshot | null>(null);
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const openLink = async (kind: JourneyLink) => {
    const result = await window.electronAPI.openJourneyLink(kind).catch(() => ({ ok: false }));
    setLinkFailed(!result.ok);
  };
  const epoch = useRef(0);
  const read = useCallback(async () => {
    if (!active) return;
    const current = ++epoch.current; setPending(true); setFailed(false);
    try { const next = await window.electronAPI.hostHardware(); if (current === epoch.current) setSnapshot(next); }
    catch { if (current === epoch.current) setFailed(true); }
    finally { if (current === epoch.current) setPending(false); }
  }, [active]);
  useEffect(() => { const requests = epoch; if (active) void read(); return () => { requests.current++; }; }, [active, read]);
  const memory = (value: number | null) => value === null ? String(t('hostHardware.unknown')) : `${(value / 1024 ** 3).toFixed(1)} ${String(t('hostHardware.unit'))}`;
  const advice = snapshot ? hostReadiness(snapshot) : null;
  const startText = advice?.start === 'unified' ? 'unifiedText' : advice?.start === 'unknown' ? 'unknownText' : advice?.start ?? 'unknownText';
  const guide = snapshot?.platform === 'win32' ? 'windows' : snapshot?.platform === 'darwin' && snapshot.arch === 'arm64' ? 'mac' : 'manual';
  return <section className={styles.section} aria-label={String(t('hostHardware.title'))} data-host-hardware>
    <SectionHead title={String(t('hostHardware.open'))} lead={String(t('hostHardware.lead'))} />
    <p className={hintClass}>{t('hostHardware.host')}</p>
    <div className={styles.actions}><Button disabled={pending} onClick={() => void read()}>{t('hostHardware.refresh')}</Button></div>
    {pending ? <p role="status">{t('hostHardware.reading')}</p> : null}
    {failed ? <p role="alert">{t('hostHardware.failed')}</p> : null}
    {snapshot ? <>
      <p className={hintClass}>{t('hostHardware.measured', { time: new Date(snapshot.measuredAt).toLocaleTimeString() })}</p>
      <div className={styles.card}><h3>{t('hostHardware.cpu')}</h3><p>{snapshot.cpu.name || t('hostHardware.unknown')}</p><p>{t('hostHardware.cores', { count: snapshot.cpu.logicalCores })} · {snapshot.platform} / {snapshot.arch}</p></div>
      <div className={styles.card}><h3>{t('hostHardware.ram')}</h3><p>{t(snapshot.ram.availableKind === 'available' ? 'hostHardware.ramAmount' : 'hostHardware.ramFree', { available: memory(snapshot.ram.available), total: memory(snapshot.ram.total) })}</p><p className={hintClass}>{t('hostHardware.ramHelp')}</p></div>
      <div className={styles.card}><h3>{t('hostHardware.gpu')}</h3>
        {snapshot.gpus.length ? snapshot.gpus.map((gpu, index) => <div key={index}><strong>{gpu.name}</strong><p>{gpu.memoryKind === 'unified' ? t('hostHardware.unified') : gpu.total === null ? t('hostHardware.gpuUnknown') : t('hostHardware.gpuAmount', { free: memory(gpu.free), total: memory(gpu.total) })}</p></div>) : <p>{t('hostHardware.gpuNone')}</p>}
        <p className={hintClass}>{t('hostHardware.perCard')} {snapshot.gpuSource === 'nvidia-smi' ? t('hostHardware.nvidia') : ''}</p>
      </div>
      <div className={styles.card}><h3>{t('hostHardware.disk')}</h3><p>{snapshot.disk ? t('hostHardware.diskAmount', { available: memory(snapshot.disk.available), total: memory(snapshot.disk.total) }) : t('hostHardware.unknown')}</p><p className={hintClass}>{t('hostHardware.diskHelp')}</p>{advice?.lowDisk ? <p>{t('hostHardware.diskLow')}</p> : null}</div>
    </> : null}
    <h3>{t('hostHardware.next')}</h3>
    <div className={styles.card}><h3>{t('hostHardware.nowTitle')}</h3><p>{t('hostHardware.now')}</p><div className={styles.actions}>
      <Button variant="subtle" onClick={() => useUiStore.getState().openSettings('assistant')}>{t('hostHardware.assistant')}</Button>
    </div></div>
    {advice ? <div className={styles.card}><h3>{t(`hostHardware.${advice.start}Title`)}</h3><p>{t(`hostHardware.${startText}`)}</p>{advice.busy ? <p>{t('hostHardware.busy')}</p> : null}<p className={hintClass}>{t('hostHardware.video')}</p><div className={styles.actions}><Button variant="subtle" onClick={() => useUiStore.getState().openSettings('services')}>{t('hostHardware.services')}</Button></div></div> : null}
    {linkFailed ? <p role="alert">{t('journey.noComfy.linkFailed')}</p> : null}
    <div className={styles.card}><h3>{t('hostHardware.install')}</h3><ol><li>{t('hostHardware.step1')} <div className={styles.actions}><Button variant="subtle" onClick={() => void openLink(`comfyui-install-${guide}`)}>{t(`hostHardware.${guide}`)}</Button><Button variant="subtle" onClick={() => void openLink('comfyui-download')}>{t('hostHardware.download')}</Button></div></li><li>{t('hostHardware.step2')}</li><li>{t('hostHardware.step3')}</li></ol><div className={styles.actions}><Button onClick={() => useUiStore.getState().openSettings('connection')}>{t('hostHardware.connect')}</Button></div></div>
  </section>;
}
