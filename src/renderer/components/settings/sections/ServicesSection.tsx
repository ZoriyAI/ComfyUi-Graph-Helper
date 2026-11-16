import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalService, ServiceAction, ServicesStatus } from '../../../../shared/contracts/services';
import { useUiStore } from '../../../state/uiState';
import Button from '../../../ui/Button';
import ConfirmDialog from './ConfirmDialog';
import { SectionHead, hintClass, rowClass } from './common';
import styles from './ServicesSection.module.css';

const NOTICE_KEYS = { pending: 'services.pending', done: 'services.done', invalid: 'services.errors.invalid', unavailable: 'services.errors.unavailable', changed: 'services.errors.changed', busy: 'services.errors.busy', authorization: 'services.errors.authorization', timeout: 'services.errors.timeout', failed: 'services.errors.failed', unconfirmed: 'services.errors.unconfirmed' } as const;

export default function ServicesSection({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ServicesStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<keyof typeof NOTICE_KEYS | ''>('');
  const [confirmation, setConfirmation] = useState<{ service: LocalService; action: ServiceAction } | null>(null);
  const epoch = useRef(0);
  const changing = useRef(false);
  const read = useCallback(async () => {
    if (!active || changing.current) return;
    const generation = ++epoch.current;
    try {
      const next = await window.electronAPI.servicesStatus();
      if (generation === epoch.current) setStatus(next);
    } catch { if (generation === epoch.current) setNote('unavailable'); }
  }, [active]);
  useEffect(() => {
    if (!active) return;
    void read(); const timer = window.setInterval(() => void read(), 10_000);
    return () => { window.clearInterval(timer); epoch.current++; };
  }, [active, read]);

  const control = async (service: LocalService, action: ServiceAction) => {
    if (changing.current) return;
    changing.current = true; setBusy(true); setNote('pending');
    ++epoch.current;
    try {
      const result = await window.electronAPI.servicesControl({ id: service.id, revision: service.revision, action });
      if (result.status) setStatus(result.status);
      setNote(result.ok ? 'done' : result.error);
    } catch { setNote('failed'); }
    finally { changing.current = false; setBusy(false); }
  };
  const memory = (value: number | null) => value === null ? String(t('services.unknownMemory'))
    : value < 1024 ** 3 ? `${Math.round(value / 1024 ** 2)} MiB` : `${(value / 1024 ** 3).toFixed(1)} GiB`;
  return <section className={styles.section} aria-label={String(t('services.title'))}>
    <SectionHead title={String(t('services.title'))} lead={String(t('services.lead'))} />
    {status ? <strong>{t('services.host', { host: status.host })}</strong> : null}
    <p className={hintClass}>{t('services.hostOnly')}</p>
    <div className={rowClass}><Button disabled={busy} onClick={() => void read()}>{t('services.refresh')}</Button></div>
    <p role="status" className={styles.note}>{note ? t(NOTICE_KEYS[note]) : !status ? t('services.checking') : ''}</p>
    {status && !status.supported ? <p>{t('services.unavailable')}</p> : null}
    {status?.unavailableScopes.map(scope => <p key={scope} role="status">{t('services.scopeUnavailable', { scope: t(`services.scope.${scope}`) })}</p>)}
    {status?.supported && !status.services.length && !status.unavailableScopes.length ? <p>{t('services.empty')}</p> : null}
    <ul className={styles.list}>{status?.services.map(service => <li key={service.id} className={styles.card} data-service={service.id}>
      <div className={styles.heading}><h3>{t(`services.kind.${service.kind}`)}</h3><span className={styles.state} data-state={service.state}>{t(`services.state.${service.state}`)}</span></div>
      <p className={styles.unit}>{service.unit} · {t(`services.scope.${service.scope}`)}</p>
      <p>{t('services.memory', { value: memory(service.memoryBytes) })}{service.restarts ? ` · ${String(t('services.restarts', { count: service.restarts }))}` : ''}</p>
      <div className={styles.actions}>
        <Button size="sm" disabled={busy || !service.canStart || ['running', 'starting', 'stopping'].includes(service.state)} onClick={() => void control(service, 'start')}>{t('services.start')}</Button>
        <Button size="sm" variant="subtle" disabled={busy || !service.canStop || ['stopped', 'starting', 'stopping'].includes(service.state)} onClick={() => setConfirmation({ service, action: 'stop' })}>{t('services.stop')}</Button>
        <Button size="sm" variant="subtle" disabled={busy || !service.canStart || !service.canStop || ['starting', 'stopping'].includes(service.state)} onClick={() => setConfirmation({ service, action: 'restart' })}>{t('services.restart')}</Button>
      </div>
    </li>)}</ul>
    <p className={hintClass}>{t('services.privileged')}</p><p className={hintClass}>{t('services.ready')}</p>
    <div className={styles.actions}>
      <Button variant="subtle" onClick={() => useUiStore.getState().openSettings('connection')}>{t('services.connections')}</Button>
      <Button variant="subtle" onClick={() => useUiStore.getState().openSettings('assistant')}>{t('services.models')}</Button>
    </div>
    <p className={hintClass}>{t('services.supported')}</p>
    <ConfirmDialog open={Boolean(confirmation)} onOpenChange={open => { if (!open) setConfirmation(null); }} className="service-confirm"
      title={String(t('services.effectTitle', { action: t(`services.${confirmation?.action ?? 'stop'}`), name: confirmation?.service.unit ?? '' }))}
      lead={String(t('services.effect'))} confirmLabel={String(t(`services.${confirmation?.action ?? 'stop'}`))} cancelLabel={String(t('services.cancel'))}
      onConfirm={() => { if (confirmation) void control(confirmation.service, confirmation.action); }} />
  </section>;
}
